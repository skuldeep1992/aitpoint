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
  ArrowUpDown,
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
  User as UserIcon,
  Bot as BotIcon,
  Search,
  Calculator,
  Wrench
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GoogleGenAI } from "@google/genai";
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "./firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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

type AiToolId = "train-status" | "video-gen" | "image-gen" | "content-gen" | "translator" | "search-gpt";

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
    description: "Translate between any languages with auto-detection",
    icon: Languages,
    color: "bg-green-500",
    prompt: "Enter text to translate..."
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
  },
  {
    id: "search-gpt",
    label: "Search GPT",
    description: "AI-powered web search with real-time info",
    icon: Search,
    color: "bg-cyan-500",
    prompt: "Search for anything on the web..."
  }
];

const SUPPORTED_LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", 
  "Arabic", "Portuguese", "Russian", "Italian", "Dutch", "Turkish", "Bengali", "Marathi", 
  "Telugu", "Tamil", "Gujarati", "Urdu", "Kannada", "Odia", "Malayalam", "Punjabi"
];

const UTILITY_TOOLS = [
  {
    id: "tax-calculator",
    label: "Income Tax Calculator",
    description: "Calculate tax for Old & New regimes (FY 2024-25)",
    icon: Calculator,
    color: "bg-indigo-600"
  }
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [conversionType, setConversionType] = useState<ConversionType>("word-to-pdf");
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [rotation, setRotation] = useState(90);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [targetLang, setTargetLang] = useState("English");
  const [sourceLang, setSourceLang] = useState("Auto-detect");

  const activeTab = location.pathname.startsWith("/ai") ? "ai-agent" : "home";

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        // Sync user data to Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp(),
            role: "user"
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully logged in!");
    } catch (error: any) {
      console.error("Login Error:", error);
      toast.error(error.message || "Failed to login");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Logout Error:", error);
      toast.error("Failed to logout");
    }
  };

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

  const handleAiAction = async (toolId: AiToolId, overrideInput?: string) => {
    const input = overrideInput || aiInput;
    if (!input.trim()) return;

    setIsAiLoading(true);
    setAiOutput(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        // If the key is missing or is the placeholder from .env.example
        if (typeof (window as any).aistudio !== 'undefined') {
          if (!(await (window as any).aistudio.hasSelectedApiKey())) {
            toast.info("Please select an API key to use AI features.");
            await (window as any).aistudio.openSelectKey();
            setIsAiLoading(false);
            return;
          }
        } else {
          throw new Error("Gemini API key is missing. Please configure it in the AI Studio Secrets panel.");
        }
      }

      const ai = new GoogleGenAI({ apiKey: apiKey || "" });
      
      if (toolId === "image-gen") {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: input }] },
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setAiOutput({ type: "image", data: `data:image/png;base64,${part.inlineData.data}` });
            break;
          }
        }
      } else if (toolId === "video-gen") {
        // Check for API key selection for Veo
        if (!(await (window as any).aistudio.hasSelectedApiKey())) {
          await (window as any).aistudio.openSelectKey();
          setIsAiLoading(false);
          return;
        }

        const operation = await ai.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: input,
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
      } else if (toolId === "train-status" || toolId === "search-gpt") {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: toolId === "train-status" 
            ? `Find the current real-time status of train: ${input}. Provide details like current station, delay, and expected arrival.`
            : input,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        setAiOutput({ type: "text", data: response.text });
      } else {
        // Content Gen or Translator
        const systemPrompt = toolId === "translator" 
          ? `You are a world-class polyglot and professional translator. Your task is to translate the provided text from ${sourceLang} to ${targetLang}. Maintain the original tone, nuances, and context. Output ONLY the translated text without any explanations.`
          : "You are a creative content generator. Generate high-quality content based on the user's request.";

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: input,
          config: { systemInstruction: systemPrompt }
        });
        setAiOutput({ type: "text", data: response.text });
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      let errorMessage = error.message || "AI processing failed";
      
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "The Gemini API key is invalid. Please check your AI Studio Secrets or select a new key.";
        if (typeof (window as any).aistudio !== 'undefined') {
          (window as any).aistudio.openSelectKey();
        }
      }
      
      toast.error(errorMessage);
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
            <Link 
              to="/"
              onClick={() => { setFileState(null); }}
              className="flex items-center gap-2 text-red-600 font-bold text-xl"
            >
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              AiTpoint
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link 
                to="/"
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                  activeTab === "home" ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Home className="w-4 h-4" />
                Home
              </Link>

              <Link 
                to="/ai"
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                  activeTab === "ai-agent" ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Bot className="w-4 h-4" />
                AI Agent
              </Link>

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
                      className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 grid grid-cols-1 gap-1 z-50"
                    >
                      {CONVERSION_OPTIONS.map((option) => (
                        <Link
                          key={option.id}
                          to={`/pdf/${option.id}`}
                          onClick={() => {
                            setConversionType(option.id);
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
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onMouseEnter={() => setIsToolsMenuOpen(true)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                    isToolsMenuOpen ? "bg-gray-50 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Wrench className="w-4 h-4" />
                  Tools
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isToolsMenuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isToolsMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onMouseLeave={() => setIsToolsMenuOpen(false)}
                      className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 grid grid-cols-1 gap-1 z-50"
                    >
                      {UTILITY_TOOLS.map((tool) => (
                        <Link
                          key={tool.id}
                          to={`/tools/${tool.id}`}
                          onClick={() => {
                            setIsToolsMenuOpen(false);
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left group"
                        >
                          <div className={cn("p-2 rounded-lg text-white transition-colors", tool.color)}>
                            <tool.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900">{tool.label}</div>
                            <div className="text-[10px] text-gray-400">{tool.description}</div>
                          </div>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAuthLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm font-bold text-gray-700">{user.displayName || user.email?.split("@")[0]}</span>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="rounded-xl font-bold text-gray-600 hover:text-red-600 hover:bg-red-50">Logout</Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" onClick={handleLogin} className="rounded-xl font-bold text-gray-600">Login</Button>
                <Button onClick={handleLogin} className="rounded-xl bg-red-600 hover:bg-red-700 font-bold shadow-md">Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl space-y-8">
          <Routes>
            <Route path="/" element={<HomeView setConversionType={setConversionType} setFileState={setFileState} />} />
            <Route path="/pdf/:toolId" element={<PdfToolView conversionType={conversionType} setConversionType={setConversionType} fileState={fileState} setFileState={setFileState} urlInput={urlInput} setUrlInput={setUrlInput} handleConvert={handleConvert} handleFileChange={handleFileChange} handleDrop={handleDrop} rotation={rotation} setRotation={setRotation} reset={reset} />} />
            <Route path="/ai" element={<AiAgentHomeView />} />
            <Route path="/ai/train-status" element={<TrainStatusView handleAiAction={handleAiAction} isAiLoading={isAiLoading} aiOutput={aiOutput} setAiOutput={setAiOutput} />} />
            <Route path="/ai/:toolId" element={<AiToolView aiInput={aiInput} setAiInput={setAiInput} aiOutput={aiOutput} setAiOutput={setAiOutput} isAiLoading={isAiLoading} handleAiAction={handleAiAction} sourceLang={sourceLang} setSourceLang={setSourceLang} targetLang={targetLang} setTargetLang={setTargetLang} />} />
            <Route path="/tools/tax-calculator" element={<TaxCalculatorView />} />
          </Routes>

          <footer className="text-center text-gray-400 text-xs pt-8 font-light">
            <p>© 2026 AiTpoint. All rights reserved.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

function HomeView({ setConversionType, setFileState }: { setConversionType: (t: ConversionType) => void, setFileState: (s: FileState | null) => void }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/ai/search-gpt?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
      <header className="text-center space-y-2">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-red-600 text-white mb-4 shadow-xl"
        >
          <Bot className="w-8 h-8" />
        </motion.div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">AiTpoint</h1>
        <p className="text-gray-500 font-medium">Your universal AI-powered assistant</p>
      </header>

      {/* Custom Search GPT Bar */}
      <div className="max-w-2xl mx-auto w-full pt-4">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-red-600 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Ask Search GPT anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-12 pr-24 py-5 bg-white border-2 border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50 shadow-sm transition-all"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <Button 
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 h-11 font-bold shadow-lg"
            >
              Search
            </Button>
          </div>
        </form>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {["Latest news", "Weather today", "Stock market", "AI trends"].map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setSearchQuery(tag);
                navigate(`/ai/search-gpt?q=${encodeURIComponent(tag)}`);
              }}
              className="px-3 py-1.5 bg-white border border-gray-100 rounded-full text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
        {AI_TOOLS.map((tool) => (
          <Link
            key={tool.id}
            to={`/ai/${tool.id}`}
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
          </Link>
        ))}
      </div>

      <div className="pt-12">
        <div className="flex items-center gap-3 mb-8">
          <Wrench className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">Utility Tools</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {UTILITY_TOOLS.map((tool) => (
            <Link
              key={tool.id}
              to={`/tools/${tool.id}`}
              className="group flex items-center gap-6 p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left"
            >
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0", tool.color)}>
                <tool.icon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{tool.label}</h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                <ArrowRightLeft className="w-5 h-5 rotate-180" />
              </div>
            </Link>
          ))}
        </div>
      </div>

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
  );
}

function PdfToolView({ 
  conversionType, 
  setConversionType,
  fileState, 
  setFileState, 
  urlInput, 
  setUrlInput, 
  handleConvert, 
  handleFileChange, 
  handleDrop, 
  rotation, 
  setRotation, 
  reset 
}: any) {
  const { toolId } = useParams<{ toolId: string }>();
  
  React.useEffect(() => {
    if (toolId && toolId !== conversionType) {
      setConversionType(toolId as ConversionType);
    }
  }, [toolId, conversionType, setConversionType]);

  const currentOption = CONVERSION_OPTIONS.find(o => o.id === (toolId || conversionType))!;

  return (
    <AnimatePresence mode="wait">
      {!fileState ? (
        <motion.div
          key="selection"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-400" />
            </Link>
            <h2 className="text-2xl font-bold text-gray-900">{currentOption.label}</h2>
          </div>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardContent className="pt-12 pb-12">
              {toolId === "url-to-pdf" ? (
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
                  {toolId === "rotate-pdf" && (
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
                {toolId === "url-to-pdf" ? urlInput : `${fileState.files.length} file(s) selected`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {toolId === "url-to-pdf" ? (
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
                  fileState.files.map((file: any, i: number) => (
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
                      toolId === "split-pdf" ? "split_pages.zip" :
                      toolId === "pdf-to-word" ? "converted.docx" :
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
  );
}

function AiAgentHomeView() {
  return (
    <motion.div
      key="ai-agent"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
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
          <Link
            key={tool.id}
            to={`/ai/${tool.id}`}
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
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function TaxCalculatorView() {
  const [income, setIncome] = useState<string>("");
  const [deductions, setDeductions] = useState<string>(""); // For Old Regime
  const [results, setResults] = useState<any>(null);

  const calculateTax = () => {
    const grossIncome = parseFloat(income) || 0;
    const oldDeductions = parseFloat(deductions) || 0;

    // --- Old Regime Calculation ---
    const oldStdDeduction = 50000;
    const oldTaxableIncome = Math.max(0, grossIncome - oldStdDeduction - oldDeductions);
    let oldTax = 0;

    if (oldTaxableIncome > 1000000) {
      oldTax += (oldTaxableIncome - 1000000) * 0.3;
      oldTax += 500000 * 0.2;
      oldTax += 250000 * 0.05;
    } else if (oldTaxableIncome > 500000) {
      oldTax += (oldTaxableIncome - 500000) * 0.2;
      oldTax += 250000 * 0.05;
    } else if (oldTaxableIncome > 250000) {
      oldTax += (oldTaxableIncome - 250000) * 0.05;
    }

    // Rebate u/s 87A for Old Regime
    if (oldTaxableIncome <= 500000) {
      oldTax = Math.max(0, oldTax - 12500);
    }
    const oldCess = oldTax * 0.04;
    const totalOldTax = oldTax + oldCess;

    // --- New Regime Calculation (FY 2024-25) ---
    const newStdDeduction = 75000;
    const newTaxableIncome = Math.max(0, grossIncome - newStdDeduction);
    let newTax = 0;

    if (newTaxableIncome > 1500000) {
      newTax += (newTaxableIncome - 1500000) * 0.3;
      newTax += 300000 * 0.2;
      newTax += 200000 * 0.15;
      newTax += 300000 * 0.1;
      newTax += 400000 * 0.05;
    } else if (newTaxableIncome > 1200000) {
      newTax += (newTaxableIncome - 1200000) * 0.2;
      newTax += 200000 * 0.15;
      newTax += 300000 * 0.1;
      newTax += 400000 * 0.05;
    } else if (newTaxableIncome > 1000000) {
      newTax += (newTaxableIncome - 1000000) * 0.15;
      newTax += 300000 * 0.1;
      newTax += 400000 * 0.05;
    } else if (newTaxableIncome > 700000) {
      newTax += (newTaxableIncome - 700000) * 0.1;
      newTax += 400000 * 0.05;
    } else if (newTaxableIncome > 300000) {
      newTax += (newTaxableIncome - 300000) * 0.05;
    }

    // Rebate u/s 87A for New Regime (up to 7L)
    if (newTaxableIncome <= 700000) {
      newTax = Math.max(0, newTax - 25000);
    }
    const newCess = newTax * 0.04;
    const totalNewTax = newTax + newCess;

    setResults({
      old: {
        taxable: oldTaxableIncome,
        tax: oldTax,
        cess: oldCess,
        total: totalOldTax
      },
      new: {
        taxable: newTaxableIncome,
        tax: newTax,
        cess: newCess,
        total: totalNewTax
      }
    });
  };

  return (
    <div className="space-y-6">
      <Link 
        to="/ai"
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
      >
        <ArrowRightLeft className="w-4 h-4" />
        Back to all tools
      </Link>

      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-indigo-600 text-white p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Income Tax Calculator</CardTitle>
              <CardDescription className="text-indigo-100">FY 2024-25 (Assessment Year 2025-26)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Gross Annual Income (₹)</label>
              <input 
                type="number"
                placeholder="e.g. 1200000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-medium text-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Deductions (80C, 80D, etc. - Old Regime Only) (₹)</label>
              <input 
                type="number"
                placeholder="e.g. 150000"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-medium text-lg"
              />
            </div>
          </div>

          <Button 
            onClick={calculateTax}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xl shadow-lg transition-all active:scale-[0.98]"
          >
            Calculate Tax
          </Button>

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              {/* Old Regime Card */}
              <div className="bg-gray-50 rounded-3xl p-6 border-2 border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-900">Old Regime</h4>
                  <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">Standard</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Taxable Income</span>
                    <span className="font-bold">₹{results.old.taxable.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Income Tax</span>
                    <span className="font-bold">₹{results.old.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Health & Edu Cess (4%)</span>
                    <span className="font-bold">₹{results.old.cess.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Tax</span>
                    <span className="text-2xl font-black text-indigo-600">₹{results.old.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* New Regime Card */}
              <div className="bg-indigo-50 rounded-3xl p-6 border-2 border-indigo-100 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2">
                  <Sparkles className="w-6 h-6 text-indigo-200" />
                </div>
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-indigo-900">New Regime</h4>
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold">Recommended</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-600/60">Taxable Income</span>
                    <span className="font-bold text-indigo-900">₹{results.new.taxable.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-600/60">Income Tax</span>
                    <span className="font-bold text-indigo-900">₹{results.new.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-600/60">Health & Edu Cess (4%)</span>
                    <span className="font-bold text-indigo-900">₹{results.new.cess.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-indigo-200 flex justify-between items-center">
                    <span className="font-bold text-indigo-900">Total Tax</span>
                    <span className="text-2xl font-black text-indigo-600">₹{results.new.total.toLocaleString()}</span>
                  </div>
                </div>
                {results.new.total < results.old.total && (
                  <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-xl text-xs font-bold text-center">
                    You save ₹{(results.old.total - results.new.total).toLocaleString()} with New Regime!
                  </div>
                )}
                {results.old.total < results.new.total && (
                  <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-xl text-xs font-bold text-center">
                    You save ₹{(results.new.total - results.old.total).toLocaleString()} with Old Regime!
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-gray-50 p-6 text-xs text-gray-400 text-center">
          * This is an estimate based on standard rates for FY 2024-25. Please consult a tax professional for accurate filing.
        </CardFooter>
      </Card>
    </div>
  );
}

function TrainStatusView({ handleAiAction, isAiLoading, aiOutput, setAiOutput }: any) {
  const [trainNo, setTrainNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0].replace(/-/g, ''));
  const [displayDate, setDisplayDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromStation, setFromStation] = useState("");
  const [toStation, setToStation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckStatus = async () => {
    if (!trainNo.trim()) return;
    
    setIsLoading(true);
    setAiOutput(null);

    try {
      const response = await fetch(`/api/train/status/${trainNo}/${date}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Format the API response for display
      let formattedResult = "";
      if (data.ResponseCode === "200") {
        formattedResult = `Train: ${data.TrainNumber}\nStatus: ${data.Message}\n\n`;
        if (data.TrainHistory && data.TrainHistory.length > 0) {
          formattedResult += "Recent Stations:\n";
          data.TrainHistory.slice(0, 5).forEach((h: any) => {
            formattedResult += `- ${h.StationName}: ${h.Status}\n`;
          });
        }
      } else {
        formattedResult = data.Message || "No status found for this train and date.";
      }

      setAiOutput({ type: "text", data: formattedResult });
    } catch (error: any) {
      console.error("Train API Error:", error);
      toast.error(error.message || "Failed to fetch train status. Falling back to AI search...");
      // Fallback to AI search if API fails or is not configured
      handleAiAction("train-status", `Check real-time status of train: ${trainNo} for date ${displayDate}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckTrains = () => {
    if (!fromStation.trim() || !toStation.trim()) return;
    handleAiAction("train-status", `Find trains from ${fromStation} to ${toStation} and their current status.`);
  };

  const swapStations = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  return (
    <div className="space-y-6">
      <Link 
        to="/ai"
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
      >
        <ArrowRightLeft className="w-4 h-4" />
        Back to all AI tools
      </Link>

      <div className="bg-red-600 rounded-3xl overflow-hidden shadow-2xl p-8 space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Check Train Status</h2>
          <div className="h-1 w-20 bg-white/50 mx-auto rounded-full" />
        </div>

        <div className="space-y-8">
          {/* Search by Train */}
          <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Search by Train</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Train Number/Name</label>
                  <input 
                    type="text"
                    placeholder="Select Train No."
                    value={trainNo}
                    onChange={(e) => setTrainNo(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-600 transition-all font-medium text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Date of Journey</label>
                  <input 
                    type="date"
                    value={displayDate}
                    onChange={(e) => {
                      setDisplayDate(e.target.value);
                      setDate(e.target.value.replace(/-/g, ''));
                    }}
                    className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-600 transition-all font-medium text-lg"
                  />
                </div>
              </div>
              <Button 
                onClick={handleCheckStatus}
                disabled={isAiLoading || isLoading || !trainNo.trim()}
                className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xl shadow-lg transition-all active:scale-[0.98]"
              >
                {isAiLoading || isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Check Status"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="h-px bg-white/30 flex-1" />
            <span className="text-white font-bold text-lg uppercase tracking-widest opacity-80">or</span>
            <div className="h-px bg-white/30 flex-1" />
          </div>

          {/* Search by Station */}
          <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Search by Station</h3>
            <div className="space-y-6">
              <div className="relative space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">From</label>
                  <input 
                    type="text"
                    placeholder="Enter Station"
                    value={fromStation}
                    onChange={(e) => setFromStation(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-600 transition-all font-medium text-lg"
                  />
                </div>
                
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10">
                  <button 
                    onClick={swapStations}
                    className="w-12 h-12 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center text-red-600 shadow-xl hover:border-red-600 hover:scale-110 transition-all active:rotate-180"
                  >
                    <ArrowUpDown className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">To</label>
                  <input 
                    type="text"
                    placeholder="Enter Station"
                    value={toStation}
                    onChange={(e) => setToStation(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-600 transition-all font-medium text-lg"
                  />
                </div>
              </div>
              <Button 
                onClick={handleCheckTrains}
                disabled={isAiLoading || !fromStation.trim() || !toStation.trim()}
                className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xl shadow-lg transition-all active:scale-[0.98]"
              >
                {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Check Trains"}
              </Button>
            </div>
          </div>
        </div>

        {aiOutput && (
          <div className="p-6 bg-white border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Result</h4>
              <Button variant="ghost" size="sm" onClick={() => setAiOutput(null)} className="rounded-xl text-red-600 font-bold">Clear</Button>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {aiOutput.data}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AiToolView({ 
  aiInput, 
  setAiInput, 
  aiOutput, 
  setAiOutput, 
  isAiLoading, 
  handleAiAction,
  sourceLang,
  setSourceLang,
  targetLang,
  setTargetLang
}: any) {
  const { toolId } = useParams<{ toolId: AiToolId }>();
  const location = useLocation();
  const tool = AI_TOOLS.find(t => t.id === toolId);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("q");
    if (query && toolId === "search-gpt") {
      setAiInput(query);
      handleAiAction("search-gpt", query);
    }
  }, [location.search, toolId]);

  if (!tool) return <div>Tool not found</div>;

  return (
    <div className="space-y-6">
      <Link 
        to="/ai"
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
      >
        <ArrowRightLeft className="w-4 h-4" />
        Back to all AI tools
      </Link>

      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md", tool.color)}>
                <tool.icon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  {tool.label}
                </CardTitle>
                <CardDescription>
                  {tool.description}
                </CardDescription>
              </div>
            </div>

            {toolId === "translator" && (
              <div className="flex items-center gap-2">
                <select 
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option>Auto-detect</option>
                  {SUPPORTED_LANGUAGES.map(lang => <option key={lang}>{lang}</option>)}
                </select>
                <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                <select 
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {SUPPORTED_LANGUAGES.map(lang => <option key={lang}>{lang}</option>)}
                </select>
              </div>
            )}
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
                <p className="text-sm text-gray-500">Enter your request below and I'll generate the {toolId?.replace("-", " ")} for you.</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-6 bg-gray-50/50 border-t border-gray-100">
          <div className="flex w-full gap-3">
            <textarea
              rows={1}
              placeholder={tool.prompt}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              className="flex-1 min-h-[56px] max-h-32 p-4 rounded-2xl border-2 border-gray-100 focus:outline-none focus:border-red-600 transition-all resize-none bg-white text-gray-900"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAiAction(toolId);
                }
              }}
            />
            <Button 
              disabled={isAiLoading || !aiInput.trim()}
              onClick={() => handleAiAction(toolId)}
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
  );
}
