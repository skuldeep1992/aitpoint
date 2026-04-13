import React, { useState, useCallback } from "react";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  RefreshCw,
  FileSpreadsheet,
  FileCode,
  ArrowRightLeft,
  X,
  FileUp,
  Files,
  Scissors,
  RotateCw,
  Image as ImageIcon,
  Lock,
  Unlock as UnlockIcon,
  Globe,
  ChevronDown,
  Bot,
  Home,
  LayoutGrid,
  MessageSquare,
  Sparkles,
  Train,
  Video,
  Languages,
  PenTool,
  Send,
  User,
  Bot as BotIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GoogleGenAI } from "@google/genai";

type ConversionType = 
  | "word-to-pdf" 
  | "xls-to-pdf" 
  | "pdf-to-word" 
  | "url-to-pdf"
  | "merge-pdf"
  | "split-pdf"
  | "rotate-pdf"
  | "jpg-to-pdf";

interface ConversionOption {
  id: ConversionType;
  label: string;
  icon: any;
  accept: string;
  description: string;
  multiple?: boolean;
}

const CONVERSION_OPTIONS: ConversionOption[] = [
  { 
    id: "word-to-pdf", 
    label: "Word to PDF", 
    icon: FileText, 
    accept: ".docx", 
    description: "Convert Word to PDF." 
  },
  { 
    id: "xls-to-pdf", 
    label: "Excel to PDF", 
    icon: FileSpreadsheet, 
    accept: ".xlsx,.xls", 
    description: "Convert Excel to PDF." 
  },
  { 
    id: "pdf-to-word", 
    label: "PDF to Word", 
    icon: FileCode, 
    accept: ".pdf", 
    description: "Convert PDF to Word." 
  },
  { 
    id: "url-to-pdf", 
    label: "HTML to PDF", 
    icon: Globe, 
    accept: "url", 
    description: "Convert URL to PDF." 
  },
  { 
    id: "merge-pdf", 
    label: "Merge PDF", 
    icon: Files, 
    accept: ".pdf", 
    description: "Combine multiple PDFs.",
    multiple: true
  },
  { 
    id: "split-pdf", 
    label: "Split PDF", 
    icon: Scissors, 
    accept: ".pdf", 
    description: "Split PDF into pages." 
  },
  { 
    id: "rotate-pdf", 
    label: "Rotate PDF", 
    icon: RotateCw, 
    accept: ".pdf", 
    description: "Rotate PDF pages." 
  },
  { 
    id: "jpg-to-pdf", 
    label: "JPG to PDF", 
    icon: ImageIcon, 
    accept: ".jpg,.jpeg,.png", 
    description: "Convert images to PDF.",
    multiple: true
  },
];

interface FileState {
  files: File[];
  status: "idle" | "uploading" | "converting" | "completed" | "error";
  progress: number;
  error?: string;
  resultUrl?: string;
}

type AiToolId = "train-status" | "video-gen" | "image-gen" | "content-gen" | "translator";

interface AiTool {
  id: AiToolId;
  label: string;
  description: string;
  icon: any;
  color: string;
  prompt: string;
}

const AI_TOOLS: AiTool[] = [
  {
    id: "content-gen",
    label: "Content Generator",
    description: "Write blogs, emails, and creative stories",
    icon: PenTool,
    color: "bg-blue-500",
    prompt: "Write a professional blog post about..."
  },
  {
    id: "translator",
    label: "All Lang Translator",
    description: "Translate any language to English perfectly",
    icon: Languages,
    color: "bg-green-500",
    prompt: "Translate this text to English: "
  },
  {
    id: "image-gen",
    label: "Image Generator",
    description: "Create stunning visuals from text descriptions",
    icon: ImageIcon,
    color: "bg-purple-500",
    prompt: "A futuristic city with flying cars..."
  },
  {
    id: "video-gen",
    label: "Video Generator",
    description: "Generate short cinematic video clips",
    icon: Video,
    color: "bg-orange-500",
    prompt: "A sunset over a calm ocean with waves..."
  },
  {
    id: "train-status",
    label: "Train Status Checker",
    description: "Check real-time status of any train",
    icon: Train,
    color: "bg-red-500",
    prompt: "What is the current status of train number..."
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "ai-agent">("home");
  const [activeAiTool, setActiveAiTool] = useState<AiToolId | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [conversionType, setConversionType] = useState<ConversionType>("word-to-pdf");
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [rotation, setRotation] = useState(90);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const currentOption = CONVERSION_OPTIONS.find(o => o.id === conversionType)!;

  const validateFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return [];
    const validFiles: File[] = [];
    const allowedExtensions = currentOption.accept.split(",").map(ext => ext.replace(".", "").toLowerCase());

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (allowedExtensions.includes(extension || "") || currentOption.accept === "url") {
        validFiles.push(file);
      } else {
        toast.error(`Invalid file type: ${file.name}`);
      }
    }
    return validFiles;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files);
    if (validFiles.length > 0) {
      setFileState({ files: validFiles, status: "idle", progress: 0 });
    }
  }, [currentOption]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const validFiles = validateFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      setFileState({ files: validFiles, status: "idle", progress: 0 });
    }
  };

  const handleConvert = async () => {
    if (!fileState && conversionType !== "url-to-pdf") return;
    if (conversionType === "url-to-pdf" && !urlInput) {
      toast.error("Please enter a valid URL");
      return;
    }

    setFileState(prev => prev ? { ...prev, status: "uploading", progress: 10 } : {
      files: [],
      status: "uploading",
      progress: 10
    });

    const formData = new FormData();
    if (fileState?.files) {
      fileState.files.forEach(file => formData.append("files", file));
    }
    formData.append("type", conversionType);
    if (urlInput) formData.append("url", urlInput);
    if (conversionType === "rotate-pdf") formData.append("rotation", rotation.toString());

    try {
      const interval = setInterval(() => {
        setFileState(prev => {
          if (!prev || prev.status !== "uploading") {
            clearInterval(interval);
            return prev;
          }
          const nextProgress = Math.min(prev.progress + 5, 90);
          return { ...prev, progress: nextProgress, status: nextProgress === 90 ? "converting" : "uploading" };
        });
      }, 800);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Conversion failed" }));
        throw new Error(errorData.error || "Conversion failed");
      }

      const blob = await response.blob();
      if (blob.size < 100) throw new Error("Received an invalid file");

      const url = window.URL.createObjectURL(blob);

      setFileState(prev => prev ? { 
        ...prev, 
        status: "completed", 
        progress: 100,
        resultUrl: url 
      } : null);
      
      toast.success("Success!");
    } catch (err) {
      console.error(err);
      setFileState(prev => prev ? { 
        ...prev, 
        status: "error", 
        error: err instanceof Error ? err.message : "An unexpected error occurred" 
      } : null);
      toast.error("Failed");
    }
  };

  const reset = () => {
    if (fileState?.resultUrl) {
      window.URL.revokeObjectURL(fileState.resultUrl);
    }
    setFileState(null);
    setUrlInput("");
  };

  const handleAiAction = async () => {
    if (!aiInput.trim() || !activeAiTool) return;

    setIsAiLoading(true);
    setAiOutput(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const tool = AI_TOOLS.find(t => t.id === activeAiTool)!;

      if (activeAiTool === "image-gen") {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: aiInput }] },
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setAiOutput({ type: "image", data: `data:image/png;base64,${part.inlineData.data}` });
            break;
          }
        }
      } else if (activeAiTool === "video-gen") {
        // Check for API key selection for Veo
        if (!(await (window as any).aistudio.hasSelectedApiKey())) {
          await (window as any).aistudio.openSelectKey();
          setIsAiLoading(false);
          return;
        }

        const operation = await ai.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: aiInput,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });

        let currentOp = operation;
        while (!currentOp.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          currentOp = await ai.operations.getVideosOperation({ operation: currentOp });
        }

        const videoUri = currentOp.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
          const videoResponse = await fetch(videoUri, {
            headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! }
          });
          const blob = await videoResponse.blob();
          setAiOutput({ type: "video", data: URL.createObjectURL(blob) });
        }
      } else if (activeAiTool === "train-status") {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Find the current real-time status of train: ${aiInput}. Provide details like current station, delay, and expected arrival.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        setAiOutput({ type: "text", data: response.text });
      } else {
        // Content Gen or Translator
        const systemPrompt = activeAiTool === "translator" 
          ? "You are a professional translator. Translate the following text to English accurately, maintaining tone and context."
          : "You are a creative content generator. Generate high-quality content based on the user's request.";

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: aiInput,
          config: { systemInstruction: systemPrompt }
        });
        setAiOutput({ type: "text", data: response.text });
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      toast.error(error.message || "AI processing failed");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col font-sans">
      <Toaster position="top-center" />
      
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => { setActiveTab("home"); setFileState(null); }}
              className="flex items-center gap-2 text-red-600 font-bold text-xl"
            >
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
                <FileText className="w-5 h-5" />
              </div>
              DocuMorph
            </button>

            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => setActiveTab("home")}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                  activeTab === "home" ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Home className="w-4 h-4" />
                Home
              </button>

              <div className="relative">
                <button 
                  onMouseEnter={() => setIsMenuOpen(true)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                    isMenuOpen ? "bg-gray-50 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  ALL PDF Tools
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isMenuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onMouseLeave={() => setIsMenuOpen(false)}
                      className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 grid grid-cols-1 gap-1"
                    >
                      {CONVERSION_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setConversionType(option.id);
                            setActiveTab("home");
                            setFileState(null);
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left group"
                        >
                          <div className="p-2 bg-gray-50 rounded-lg text-gray-500 group-hover:bg-white group-hover:text-red-600 transition-colors">
                            <option.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900">{option.label}</div>
                            <div className="text-[10px] text-gray-400">{option.description}</div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setActiveTab("ai-agent")}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                  activeTab === "ai-agent" ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Bot className="w-4 h-4" />
                AI Agent
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-xl font-bold text-gray-600">Login</Button>
            <Button className="rounded-xl bg-red-600 hover:bg-red-700 font-bold shadow-md">Sign Up</Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl space-y-8">
          {activeTab === "home" ? (
            <>
              <header className="text-center space-y-2">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-red-600 text-white mb-4 shadow-xl"
                >
                  <FileText className="w-8 h-8" />
                </motion.div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">DocuMorph</h1>
                <p className="text-gray-500 font-medium">Every tool you need to work with PDFs in one place</p>
              </header>

              <AnimatePresence mode="wait">
                {!fileState ? (
                  <motion.div
                    key="selection"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {CONVERSION_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setConversionType(option.id);
                            setFileState(null);
                          }}
                          className={cn(
                            "flex flex-col items-center p-6 rounded-2xl border-none transition-all text-center space-y-4 shadow-sm group",
                            conversionType === option.id 
                              ? "bg-white ring-2 ring-red-600" 
                              : "bg-white hover:bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "p-4 rounded-xl transition-colors",
                            conversionType === option.id ? "bg-red-600 text-white" : "bg-gray-100 text-red-600 group-hover:bg-red-50"
                          )}>
                            <option.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{option.label}</div>
                            <div className="text-[10px] text-gray-400 mt-1 leading-tight">{option.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
                      <CardContent className="pt-12 pb-12">
                        {conversionType === "url-to-pdf" ? (
                          <div className="flex flex-col items-center justify-center space-y-8">
                            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                              <Globe className="w-12 h-12" />
                            </div>
                            <div className="text-center w-full max-w-lg">
                              <p className="text-xl font-bold text-gray-900 mb-6">
                                Enter website URL to convert
                              </p>
                              <div className="flex gap-3">
                                <input 
                                  type="url"
                                  placeholder="https://example.com"
                                  value={urlInput}
                                  onChange={(e) => setUrlInput(e.target.value)}
                                  className="flex-1 h-14 px-6 rounded-2xl border-2 border-gray-100 focus:outline-none focus:border-red-600 transition-all text-lg"
                                />
                                <Button 
                                  onClick={handleConvert}
                                  className="h-14 rounded-2xl bg-red-600 hover:bg-red-700 px-8 text-lg font-bold"
                                >
                                  Convert
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="flex flex-col items-center justify-center space-y-8"
                          >
                            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                              <FileUp className="w-12 h-12" />
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {currentOption.multiple ? "Select PDF files" : "Select PDF file"}
                              </p>
                              <p className="text-gray-400 mt-2">
                                or drag and drop here
                              </p>
                            </div>
                            <label className={cn(buttonVariants({ variant: "default" }), "cursor-pointer rounded-2xl h-16 px-12 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg transition-all")}>
                              Select Files
                              <input 
                                type="file" 
                                className="hidden" 
                                multiple={currentOption.multiple}
                                accept={currentOption.accept}
                                onChange={handleFileChange}
                              />
                            </label>
                            {conversionType === "rotate-pdf" && (
                              <div className="flex items-center gap-4 pt-4">
                                <span className="text-sm font-medium text-gray-600">Rotation:</span>
                                {[90, 180, 270].map(deg => (
                                  <Button 
                                    key={deg}
                                    variant={rotation === deg ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setRotation(deg)}
                                    className="rounded-xl"
                                  >
                                    {deg}°
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-2xl mx-auto"
                  >
                    <Card className="shadow-2xl border-none rounded-3xl bg-white overflow-hidden">
                      <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                        <CardTitle className="flex items-center gap-3 text-xl font-bold">
                          {fileState.status === "completed" ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : fileState.status === "error" ? (
                            <AlertCircle className="w-6 h-6 text-red-500" />
                          ) : (
                            <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
                          )}
                          {fileState.status === "idle" && "Ready to Process"}
                          {fileState.status === "uploading" && "Uploading..."}
                          {fileState.status === "converting" && "Processing..."}
                          {fileState.status === "completed" && "Task Complete!"}
                          {fileState.status === "error" && "Error Occurred"}
                        </CardTitle>
                        <CardDescription className="font-medium">
                          {conversionType === "url-to-pdf" ? urlInput : `${fileState.files.length} file(s) selected`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8 pt-8">
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {conversionType === "url-to-pdf" ? (
                            <div className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="p-3 bg-white rounded-xl shadow-sm mr-4 text-purple-600">
                                <Globe className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{urlInput}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Website URL</p>
                              </div>
                            </div>
                          ) : (
                            fileState.files.map((file, i) => (
                              <div key={i} className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="p-3 bg-white rounded-xl shadow-sm mr-4 text-red-600">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-900 truncate">{file.name}</p>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                {fileState.status === "idle" && (
                                  <Button variant="ghost" size="icon" onClick={() => {
                                    const newFiles = [...fileState.files];
                                    newFiles.splice(i, 1);
                                    if (newFiles.length === 0) setFileState(null);
                                    else setFileState({ ...fileState, files: newFiles });
                                  }} className="rounded-full hover:bg-red-50 hover:text-red-600">
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {(fileState.status === "uploading" || fileState.status === "converting") && (
                          <div className="space-y-4">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                              <span>{fileState.status === "uploading" ? "Uploading" : "Processing"}</span>
                              <span>{fileState.progress}%</span>
                            </div>
                            <Progress value={fileState.progress} className="h-2 bg-gray-100" />
                          </div>
                        )}

                        {fileState.status === "error" && (
                          <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-100 text-red-700 text-sm font-medium">
                            {fileState.error}
                          </div>
                        )}

                        {fileState.status === "completed" && (
                          <div className="flex flex-col items-center py-6 space-y-4">
                            <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                              <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-gray-900">Success!</p>
                              <p className="text-sm text-gray-500 mt-1">Your files have been processed successfully.</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex gap-4 p-8 bg-gray-50/50 border-t border-gray-100">
                        {fileState.status === "idle" && (
                          <>
                            <Button variant="outline" className="flex-1 h-14 rounded-2xl border-2 border-gray-200 font-bold" onClick={reset}>Cancel</Button>
                            <Button className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg" onClick={handleConvert}>
                              Process Now
                            </Button>
                          </>
                        )}
                        {fileState.status === "completed" && (
                          <>
                            <Button variant="outline" className="flex-1 h-14 rounded-2xl border-2 border-gray-200 font-bold" onClick={reset}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Start Over
                            </Button>
                            <a 
                              href={fileState.resultUrl} 
                              download={
                                conversionType === "split-pdf" ? "split_pages.zip" :
                                conversionType === "pdf-to-word" ? "converted.docx" :
                                "processed.pdf"
                              }
                              className={cn(buttonVariants(), "flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 no-underline flex items-center justify-center text-lg font-bold shadow-lg")}
                            >
                              <Download className="w-5 h-5 mr-2" />
                              Download
                            </a>
                          </>
                        )}
                        {fileState.status === "error" && (
                          <Button className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 font-bold" onClick={reset}>Try Again</Button>
                        )}
                        {(fileState.status === "uploading" || fileState.status === "converting") && (
                          <Button disabled className="w-full h-14 rounded-2xl bg-gray-100 text-gray-400 cursor-not-allowed font-bold">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Please wait...
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-3 gap-8 text-center pt-8">
                <div className="space-y-2">
                  <div className="text-gray-900 font-medium">Fast</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest">Instant Processing</div>
                </div>
                <div className="space-y-2">
                  <div className="text-gray-900 font-medium">Secure</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest">Encrypted Transfer</div>
                </div>
                <div className="space-y-2">
                  <div className="text-gray-900 font-medium">Free</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest">No Subscriptions</div>
                </div>
              </div>
            </>
          ) : (
            <motion.div
              key="ai-agent"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {!activeAiTool ? (
                <>
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 text-red-600 mb-2">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">AI Document Agent</h2>
                    <p className="text-gray-500 max-w-lg mx-auto">
                      Select an AI tool to get started. Our advanced agents can generate content, images, videos, and more.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {AI_TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveAiTool(tool.id);
                          setAiInput("");
                          setAiOutput(null);
                        }}
                        className="group relative flex flex-col p-8 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left overflow-hidden"
                      >
                        <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110", tool.color)} />
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg", tool.color)}>
                          <tool.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{tool.label}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                        <div className="mt-6 flex items-center text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                          Try now
                          <ArrowRightLeft className="w-4 h-4 ml-2 rotate-180" />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setActiveAiTool(null)}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Back to all AI tools
                  </button>

                  <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md", AI_TOOLS.find(t => t.id === activeAiTool)?.color)}>
                          {(() => {
                            const Icon = AI_TOOLS.find(t => t.id === activeAiTool)?.icon;
                            return Icon ? <Icon className="w-6 h-6" /> : null;
                          })()}
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold">
                            {AI_TOOLS.find(t => t.id === activeAiTool)?.label}
                          </CardTitle>
                          <CardDescription>
                            {AI_TOOLS.find(t => t.id === activeAiTool)?.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8 min-h-[400px]">
                      {aiOutput ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Result</h4>
                            <Button variant="ghost" size="sm" onClick={() => setAiOutput(null)} className="rounded-xl text-red-600 font-bold">Clear</Button>
                          </div>
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            {aiOutput.type === "text" && (
                              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {aiOutput.data}
                              </div>
                            )}
                            {aiOutput.type === "image" && (
                              <div className="flex flex-col items-center space-y-4">
                                <img src={aiOutput.data} alt="Generated" className="rounded-2xl shadow-xl max-w-full h-auto" referrerPolicy="no-referrer" />
                                <a href={aiOutput.data} download="generated-image.png" className={cn(buttonVariants(), "rounded-xl bg-red-600")}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Image
                                </a>
                              </div>
                            )}
                            {aiOutput.type === "video" && (
                              <div className="flex flex-col items-center space-y-4">
                                <video src={aiOutput.data} controls className="rounded-2xl shadow-xl w-full max-w-2xl" />
                                <a href={aiOutput.data} download="generated-video.mp4" className={cn(buttonVariants(), "rounded-xl bg-red-600")}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Video
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                          <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                            <BotIcon className="w-10 h-10" />
                          </div>
                          <div className="max-w-md">
                            <p className="text-lg font-bold text-gray-900">Ready to help</p>
                            <p className="text-sm text-gray-500">Enter your request below and I'll generate the {activeAiTool?.replace("-", " ")} for you.</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-6 bg-gray-50/50 border-t border-gray-100">
                      <div className="flex w-full gap-3">
                        <textarea
                          rows={1}
                          placeholder={AI_TOOLS.find(t => t.id === activeAiTool)?.prompt}
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          className="flex-1 min-h-[56px] max-h-32 p-4 rounded-2xl border-2 border-gray-100 focus:outline-none focus:border-red-600 transition-all resize-none bg-white text-gray-900"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAiAction();
                            }
                          }}
                        />
                        <Button 
                          disabled={isAiLoading || !aiInput.trim()}
                          onClick={handleAiAction}
                          className="h-14 w-14 rounded-2xl bg-red-600 hover:bg-red-700 shadow-lg flex-shrink-0"
                        >
                          {isAiLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Send className="w-6 h-6" />
                          )}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          <footer className="text-center text-gray-400 text-xs pt-8 font-light">
            <p>© 2026 DocuMorph. All rights reserved.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
