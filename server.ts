import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";
import puppeteer from "puppeteer";
import fs from "fs-extra";
import cors from "cors";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument as PDFLib, rgb, degrees } from "pdf-lib";
import JSZip from "jszip";
import { createRequire } from "module";
import dotenv from "dotenv";

dotenv.config();

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
  });

  // Indian Rail API Proxy
  app.get("/api/train/status/:trainNo/:date", async (req, res) => {
    try {
      const { trainNo, date } = req.params;
      const apiKey = process.env.INDIAN_RAIL_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Indian Rail API key is not configured." });
      }

      const apiUrl = `http://indianrailapi.com/api/v2/livetrainstatus/apikey/${apiKey}/trainnumber/${trainNo}/date/${date}/`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      res.json(data);
    } catch (error) {
      console.error("Train API Error:", error);
      res.status(500).json({ error: "Failed to fetch train status from Indian Rail API" });
    }
  });

  // API Routes
  app.post("/api/convert", upload.array("files"), async (req, res) => {
    const conversionType = req.body.type || "word-to-pdf";
    const url = req.body.url;
    const password = req.body.password;
    const rotation = parseInt(req.body.rotation || "0");
    
    const files = req.files as Express.Multer.File[];
    const firstFile = files?.[0];
    
    if (!firstFile && conversionType !== "url-to-pdf" && conversionType !== "merge-pdf") {
      console.error("No file uploaded in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    let browser: any;
    try {
      console.log(`[Conversion] Starting ${conversionType} for: ${firstFile?.originalname || url || "multiple files"}`);
      
      if (conversionType === "word-to-pdf" && firstFile) {
        const { value: html } = await mammoth.convertToHtml({ buffer: firstFile.buffer });
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 40px; color: #333; } img { max-width: 100%; height: auto; display: block; margin: 10px 0; } table { border-collapse: collapse; width: 100%; margin: 15px 0; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }</style></head><body>${html || "<p>No content</p>"}</body></html>`;
        
        const pdfBuffer = await generatePdf(fullHtml, firstFile.buffer);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${firstFile.originalname.replace(".docx", ".pdf")}"`);
        return res.send(pdfBuffer);
      } 
      
      else if (conversionType === "xls-to-pdf" && firstFile) {
        const workbook = XLSX.read(firstFile.buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const html = XLSX.utils.sheet_to_html(worksheet);
        
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: sans-serif; padding: 20px; } table { border-collapse: collapse; width: 100%; font-size: 12px; } th, td { border: 1px solid #ccc; padding: 4px; text-align: left; } th { background: #f4f4f4; }</style></head><body>${html}</body></html>`;
        
        const pdfBuffer = await generatePdf(fullHtml, firstFile.buffer);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${firstFile.originalname.replace(/\.[^/.]+$/, ".pdf")}"`);
        return res.send(pdfBuffer);
      }

      else if (conversionType === "pdf-to-word" && firstFile) {
        const data = await pdfParse(firstFile.buffer);
        const doc = new Document({
          sections: [{
            properties: {},
            children: data.text.split("\n").map(line => 
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          }],
        });

        const docxBuffer = await Packer.toBuffer(doc);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${firstFile.originalname.replace(".pdf", ".docx")}"`);
        return res.send(docxBuffer);
      }

      else if (conversionType === "url-to-pdf" && url) {
        const pdfBuffer = await generatePdf("", Buffer.from(""), url);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="website.pdf"`);
        return res.send(pdfBuffer);
      }

      else if (conversionType === "merge-pdf" && files && files.length > 0) {
        const mergedPdf = await PDFLib.create();
        for (const file of files) {
          const pdf = await PDFLib.load(file.buffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="merged.pdf"`);
        return res.send(Buffer.from(pdfBytes));
      }

      else if (conversionType === "split-pdf" && firstFile) {
        const pdf = await PDFLib.load(firstFile.buffer);
        const zip = new JSZip();
        for (let i = 0; i < pdf.getPageCount(); i++) {
          const newPdf = await PDFLib.create();
          const [page] = await newPdf.copyPages(pdf, [i]);
          newPdf.addPage(page);
          const pdfBytes = await newPdf.save();
          zip.file(`page_${i + 1}.pdf`, pdfBytes);
        }
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="split_pages.zip"`);
        return res.send(zipBuffer);
      }

      else if (conversionType === "rotate-pdf" && firstFile) {
        const pdf = await PDFLib.load(firstFile.buffer);
        const pages = pdf.getPages();
        pages.forEach(page => {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + rotation) % 360));
        });
        const pdfBytes = await pdf.save();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="rotated.pdf"`);
        return res.send(Buffer.from(pdfBytes));
      }

      else if (conversionType === "protect-pdf" && firstFile && password) {
        // pdf-lib doesn't support encryption directly yet, but we can use it for other things
        // For now, we'll just return the original or a modified one
        // Note: Real encryption usually requires a library like 'qpdf' or 'hummus'
        // We'll use a simple "protected" metadata for now or skip if not easily possible
        res.status(400).json({ error: "Password protection requires additional server tools" });
      }

      else if (conversionType === "jpg-to-pdf" && files && files.length > 0) {
        const pdfDoc = await PDFLib.create();
        for (const file of files) {
          let image;
          if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
            image = await pdfDoc.embedJpg(file.buffer);
          } else if (file.mimetype === "image/png") {
            image = await pdfDoc.embedPng(file.buffer);
          }
          
          if (image) {
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
              x: 0,
              y: 0,
              width: image.width,
              height: image.height,
            });
          }
        }
        const pdfBytes = await pdfDoc.save();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="images_to.pdf"`);
        return res.send(Buffer.from(pdfBytes));
      }

      res.status(400).json({ error: "Unsupported conversion type or missing data" });

    } catch (error) {
      console.error("[Conversion] FATAL ERROR:", error);
      res.status(500).json({ error: "Failed to convert document", details: error instanceof Error ? error.message : String(error) });
    } finally {
      if (browser) await browser.close().catch(err => console.error(err));
    }

    async function generatePdf(html: string, originalBuffer: Buffer, targetUrl?: string): Promise<Buffer> {
      try {
        browser = await puppeteer.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote", "--single-process"],
          headless: true,
        });
        const page = await browser.newPage();
        if (targetUrl) {
          await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 });
        } else {
          await page.setContent(html, { waitUntil: "domcontentloaded" });
        }
        const pdf = await page.pdf({ format: "A4", margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }, printBackground: true });
        if (pdf && pdf.slice(0, 4).toString() === "%PDF") return pdf;
        throw new Error("Invalid PDF");
      } catch (e) {
        if (targetUrl) throw e; // Fallback doesn't make sense for URL
        console.warn("Puppeteer failed, using PDFKit fallback");
        const { value: text } = await mammoth.extractRawText({ buffer: originalBuffer }).catch(() => ({ value: html.replace(/<[^>]*>/g, "") }));
        return await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument();
          const chunks: Buffer[] = [];
          doc.on("data", (c) => chunks.push(c));
          doc.on("end", () => resolve(Buffer.concat(chunks)));
          doc.on("error", reject);
          doc.fontSize(10).text(text);
          doc.end();
        });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
