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
import WordExtractor from "word-extractor";
import { createRequire } from "module";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const require = createRequire(import.meta.url);
let pdfParse: any;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  console.error("Failed to load pdf-parse:", e);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // AI Proxy Route
  app.post("/api/ai", async (req, res) => {
    try {
      const { toolId, input, sourceLang, targetLang } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      if (toolId === "image-gen") {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: input }] },
        });
        
        let imageData = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageData = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
        return res.json({ type: "image", data: imageData });
      } 
      
      if (toolId === "train-status" || toolId === "search-gpt") {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: toolId === "train-status" 
            ? `Find the current real-time status of train: ${input}. Provide details like current station, delay, and expected arrival.`
            : input,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        return res.json({ type: "text", data: response.text });
      }

      // Content Gen or Translator
      const systemPrompt = toolId === "translator" 
        ? `You are a world-class polyglot and professional translator. Your task is to translate the provided text from ${sourceLang} to ${targetLang}. Maintain the original tone, nuances, and context. Output ONLY the translated text without any explanations.`
        : "You are a creative content generator. Generate high-quality content based on the user's request.";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: input,
        config: { systemInstruction: systemPrompt }
      });
      return res.json({ type: "text", data: response.text });

    } catch (error: any) {
      console.error("Server AI Error:", error);
      res.status(500).json({ error: error.message || "AI processing failed" });
    }
  });

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
        let html = "";
        try {
          console.log(`[Word-to-PDF] Processing ${firstFile.originalname} (${firstFile.size} bytes)`);
          
          // Check for ZIP signature (PK..) - Required for .docx
          const isDocx = firstFile.buffer.length >= 4 && firstFile.buffer.toString('hex', 0, 2) === '504b';
          
          if (isDocx) {
            console.log("[Word-to-PDF] Detected modern .docx format");
            const result = await mammoth.convertToHtml({ buffer: firstFile.buffer });
            html = result.value;
            console.log(`[Word-to-PDF] Mammoth conversion finished. HTML length: ${html?.length || 0}`);
            if (result.messages.length > 0) {
              console.log("[Mammoth Messages]:", result.messages);
            }
          } else {
            console.log("[Word-to-PDF] Trying legacy .doc format with WordExtractor");
            try {
              const extractor = new WordExtractor();
              const document = await extractor.extract(firstFile.buffer);
              const content = document.getBody();
              html = content.split(/\r?\n/).map(line => `<p>${line}</p>`).join('');
              console.log(`[Word-to-PDF] WordExtractor conversion finished. HTML length: ${html?.length || 0}`);
            } catch (extractorErr: any) {
              if (extractorErr.message?.includes("Unable to read this type of file") || extractorErr.message?.includes("not a valid OLE file")) {
                console.log("[Word-to-PDF] Not a valid .doc file, trying plain text fallback");
                // Fallback for plain text or misinterpreted formats (like RTF renamed to .doc)
                const textContent = firstFile.buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, '');
                if (textContent.length > 10) {
                  html = textContent.split(/\r?\n/).map(line => `<p>${line}</p>`).join('');
                } else {
                  throw extractorErr; // Re-throw if text fallback is too short/garbage
                }
              } else {
                throw extractorErr;
              }
            }
          }
        } catch (e: any) {
          console.error("Word Conversion Error:", e);
          let message = "Failed to read Word document. ";
          if (e.message?.includes("end of central directory")) {
            message += "The file appears to be a corrupted .docx or a renamed file.";
          } else if (e.message?.includes("Unable to read this type of file")) {
            message += "The file format is not recognized. If it's a very old .doc or RTF, please try saving it as .docx first.";
          } else {
            message += e.message || "Unknown error";
          }
          throw new Error(message);
        }

        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted Document</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6; 
            padding: 40px; 
            color: #000; 
            background: #fff;
            max-width: 800px;
            margin: 0 auto;
        } 
        p { margin-bottom: 1em; white-space: pre-wrap; word-wrap: break-word; } 
        img { max-width: 100%; height: auto; display: block; margin: 20px 0; } 
        table { border-collapse: collapse; width: 100%; margin: 20px 0; } 
        th, td { border: 1px solid #000; padding: 10px; text-align: left; }
        th { background: #eee; }
    </style>
</head>
<body>${html || "<p>No content found in document.</p>"}</body>
</html>`;
        
        const pdfBuffer = await generatePdf(fullHtml, firstFile.buffer);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(firstFile.originalname.replace(/\.[^/.]+$/, ".pdf"))}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.status(200).send(pdfBuffer);
      } 
      
      else if (conversionType === "xls-to-pdf" && firstFile) {
        let html = "";
        try {
          const workbook = XLSX.read(firstFile.buffer, { type: "buffer" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          html = XLSX.utils.sheet_to_html(worksheet);
        } catch (e) {
          console.error("Excel Error:", e);
          throw new Error("Failed to read Excel file. Please ensure it's a valid .xlsx or .xls file.");
        }
        
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: sans-serif; padding: 20px; } table { border-collapse: collapse; width: 100%; font-size: 12px; } th, td { border: 1px solid #ccc; padding: 4px; text-align: left; } th { background: #f4f4f4; }</style></head><body>${html || "<p>No content found in spreadsheet.</p>"}</body></html>`;
        
        const pdfBuffer = await generatePdf(fullHtml, firstFile.buffer);
        res.type("application/pdf");
        res.attachment(firstFile.originalname.replace(/\.[^/.]+$/, ".pdf"));
        return res.send(pdfBuffer);
      }

      else if (conversionType === "pdf-to-word" && firstFile) {
        let pdfData: any;
        
        try {
          if (typeof pdfParse === "function") {
            // Classic pdf-parse (v1.1.1)
            pdfData = await pdfParse(firstFile.buffer);
            console.log(`[PDF-to-Word] Parsed using classic pdf-parse. Text length: ${pdfData?.text?.length || 0}`);
          } else if (typeof pdfParse?.PDFParse === "function") {
            // Modern pdf-parse (v2.x.x, e.g., mehmet-kozan/pdf-parse)
            console.log("[PDF-to-Word] Detected modern PDFParse class");
            const instance = new pdfParse.PDFParse(new Uint8Array(firstFile.buffer));
            pdfData = await instance.getText();
            console.log(`[PDF-to-Word] Parsed using modern PDFParse.getText(). Text length: ${pdfData?.text?.length || 0}`);
          } else if (typeof pdfParse?.default === "function") {
            // ESM-wrapped classic pdf-parse
            pdfData = await pdfParse.default(firstFile.buffer);
            console.log(`[PDF-to-Word] Parsed using pdfParse.default. Text length: ${pdfData?.text?.length || 0}`);
          } else {
            console.error("[PDF-to-Word] pdf-parse is not a recognized function or class. Type:", typeof pdfParse, "Keys:", Object.keys(pdfParse || {}));
            throw new Error("PDF parsing tool is currently incorrectly configured on the server.");
          }
        } catch (parseErr: any) {
          console.error("[PDF-to-Word] Parse error:", parseErr);
          throw new Error(`Failed to extract text from PDF: ${parseErr.message || "Unknown parsing error"}`);
        }

        let rawText = (pdfData?.pages && Array.isArray(pdfData.pages)) 
          ? pdfData.pages.map((p: any) => p.text).join("\n") 
          : (pdfData?.text || "");

        console.log(`[PDF-to-Word] Extracted sample: "${rawText.substring(0, 100).replace(/\n/g, "\\n")}..."`);

        if (!rawText || rawText.trim().length === 0) {
          console.warn("[PDF-to-Word] No text extracted. PDF might be scanned or image-based.");
          rawText = "Note: This PDF appears to be scanned or contains only images. AiTpoint could not extract text from this document for the conversion. Please try a searchable PDF.";
        }
        
        // Sanitize text for XML/Word compatibility (remove control characters except \n, \r, \t)
        const docText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
        console.log(`[PDF-to-Word] Final docText sanitized length: ${docText.length}`);
        
        const doc = new Document({
          sections: [{
            properties: {},
            children: docText.split(/\r?\n/).map(line => {
              const trimmed = line.trimEnd();
              if (!trimmed) {
                return new Paragraph({ children: [] });
              }
              return new Paragraph({
                children: [new TextRun(trimmed)],
              });
            }),
          }],
        });

        const docxBuffer = await Packer.toBuffer(doc);
        const finalBuffer = Buffer.from(docxBuffer);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(firstFile.originalname.replace(/\.pdf$/i, ".docx"))}"`);
        res.setHeader("Content-Length", finalBuffer.length);
        console.log(`[PDF-to-Word] Sending DOCX buffer: ${finalBuffer.length} bytes`);
        return res.status(200).send(finalBuffer);
      }

      else if (conversionType === "url-to-pdf" && url) {
        const pdfBuffer = await generatePdf("", Buffer.from(""), url);
        res.type("application/pdf");
        res.attachment("website.pdf");
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
        res.type("application/pdf");
        res.attachment("merged.pdf");
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
        res.type("application/zip");
        res.attachment("split_pages.zip");
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
        res.type("application/pdf");
        res.attachment("rotated.pdf");
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
        res.type("application/pdf");
        res.attachment("images_to.pdf");
        return res.send(Buffer.from(pdfBytes));
      }

      res.status(400).json({ error: "Unsupported conversion type or missing data" });

    } catch (error: any) {
      console.error("[Conversion] FATAL ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: errorMessage,
        details: errorMessage 
      });
    } finally {
      if (browser) await browser.close().catch(err => console.error(err));
    }

    async function generatePdf(html: string, originalBuffer: Buffer, targetUrl?: string): Promise<Buffer> {
      try {
        console.log(`[Puppeteer] Launching for ${targetUrl || "HTML Content"}`);
        browser = await puppeteer.launch({
          args: [
            "--no-sandbox", 
            "--disable-setuid-sandbox", 
            "--disable-dev-shm-usage", 
            "--disable-gpu", 
            "--no-zygote", 
            "--disable-extensions",
            "--font-render-hinting=none",
            "--single-process"
          ],
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });
        const page = await browser.newPage();
        
        // Emulate screen to avoid mobile layouts
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

        if (targetUrl) {
          await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 });
        } else {
          await page.setContent(html, { waitUntil: "networkidle0" });
        }
        
        // Wait a bit for layout to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfByteArray = await page.pdf({ 
          format: "A4", 
          margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" }, 
          printBackground: true,
          preferCSSPageSize: true
        });
        
        const pdfBuffer = Buffer.from(pdfByteArray);
        if (pdfBuffer.length > 100 && pdfBuffer.toString('utf8', 0, 4) === "%PDF") {
          console.log(`[Puppeteer] Successfully generated PDF (${pdfBuffer.length} bytes)`);
          return pdfBuffer;
        }
        throw new Error("Puppeteer produced invalid PDF data");
      } catch (e) {
        console.warn("[Puppeteer] Failed, using PDFKit fallback:", e instanceof Error ? e.message : String(e));
        
        let textContent = "";
        try {
          const { value } = await mammoth.extractRawText({ buffer: originalBuffer });
          textContent = value;
        } catch (mErr) {
          textContent = html.replace(/<[^>]*>/g, "");
        }

        return await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument();
          const chunks: Buffer[] = [];
          doc.on("data", (c) => chunks.push(c));
          doc.on("end", () => {
            const result = Buffer.concat(chunks);
            console.log(`[PDFKit] Fallback PDF generated (${result.length} bytes)`);
            resolve(result);
          });
          doc.on("error", reject);
          doc.fontSize(11).text(textContent || "Document content could not be extracted.");
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
