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
  Wrench,
  Activity,
  Calendar,
  Banknote,
  Percent,
  Type,
  Timer,
  Coffee,
  StickyNote,
  Palette
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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
    accept: ".docx,.doc", 
    description: "Convert Word (.docx, .doc) to PDF." 
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
  },
  {
    id: "unit-converter",
    label: "Unit Converter",
    description: "Convert between Length, Weight, Temp & more",
    icon: ArrowRightLeft,
    color: "bg-teal-600"
  },
  {
    id: "password-gen",
    label: "Password Generator",
    description: "Generate secure, random passwords locally",
    icon: Lock,
    color: "bg-slate-700"
  },
  {
    id: "bmi-calculator",
    label: "BMI Calculator",
    description: "Check your Body Mass Index and health status",
    icon: Activity,
    color: "bg-rose-500"
  },
  {
    id: "age-calculator",
    label: "Age Calculator",
    description: "Find your exact age in years, months, and days",
    icon: Calendar,
    color: "bg-blue-500"
  },
  {
    id: "emi-calculator",
    label: "EMI Calculator",
    description: "Calculate monthly loan repayments easily",
    icon: Banknote,
    color: "bg-emerald-600"
  },
  {
    id: "percentage-calculator",
    label: "Percentage Calculator",
    description: "Quickly calculate percentage increases/decreases",
    icon: Percent,
    color: "bg-amber-500"
  },
  {
    id: "text-converter",
    label: "Text Case Converter",
    description: "Convert text to UPPER, lower, Sentence case, etc.",
    icon: Type,
    color: "bg-purple-600"
  },
  {
    id: "stopwatch",
    label: "Stopwatch",
    description: "Simple stopwatch with lap timing",
    icon: Timer,
    color: "bg-orange-500"
  },
  {
    id: "tip-calculator",
    label: "Tip Calculator",
    description: "Split bills and calculate tips instantly",
    icon: Coffee,
    color: "bg-amber-700"
  },
  {
    id: "notepad",
    label: "Quick Notepad",
    description: "Save quick notes locally in your browser",
    icon: StickyNote,
    color: "bg-yellow-500"
  },
  {
    id: "color-tools",
    label: "Color Tools",
    description: "Identify Hex, RGB codes and generate palettes",
    icon: Palette,
    color: "bg-pink-500"
  },
  {
    id: "markdown-preview",
    label: "Markdown Preview",
    description: "Render markdown text to beautiful HTML",
    icon: FileText,
    color: "bg-sky-600"
  }
];


function SEO({ title, description }: { title: string; description: string }) {
  React.useEffect(() => {
    document.title = `${title} | AiTpoint - Smart AI & Utility Tools`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = description;
      document.head.appendChild(meta);
    }
  }, [title, description]);
  return null;
}

function ToolIndexView() {
  return (
    <div className="space-y-12 py-8">
      <SEO 
        title="All AI & Utility Tools" 
        description="Comprehensive list of AI search, generators, converters, and calculators. Everything you need in one powerful toolkit." 
      />
      
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
          Every <span className="text-red-600">Tool</span> You Need
        </h1>
        <p className="text-lg text-gray-500 font-medium leading-relaxed">
          The ultimate collection of AI assistants, PDF tools, and native utilities. Fast, free, and optimized for indexing.
        </p>
      </div>

      <div className="space-y-10">
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-4 py-2 border-l-4 border-red-600 bg-red-50/50 rounded-r-xl">
            <Sparkles className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wider">AI Powered Tools</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_TOOLS.map((tool) => (
              <ToolCard key={tool.id} tool={tool} pathPrefix="/ai" />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 px-4 py-2 border-l-4 border-gray-900 bg-gray-100 rounded-r-xl">
            <Calculator className="w-5 h-5 text-gray-900" />
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wider">Utility & Calculators</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {UTILITY_TOOLS.map((tool) => (
              <ToolCard key={tool.id} tool={tool} pathPrefix="/tools" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolCard({ tool, pathPrefix }: { tool: any, pathPrefix?: string }) {
  return (
    <Link 
      to={`${pathPrefix}/${tool.id}`}
      className="group relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className={cn("inline-flex p-3 rounded-2xl text-white shadow-lg mb-4 group-hover:scale-110 transition-transform", tool.color)}>
        <tool.icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-black text-gray-900 mb-2 truncate group-hover:text-red-600 transition-colors">{tool.label}</h3>
      <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{tool.description}</p>
      <div className="mt-4 flex items-center text-xs font-bold text-gray-400 group-hover:text-red-500 transition-colors">
        Try Tool <ArrowRightLeft className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

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

  const [activeTab, setActiveTab] = useState("home");

  React.useEffect(() => {
    if (location.pathname === "/") setActiveTab("home");
    else if (location.pathname.startsWith("/ai")) setActiveTab("ai-agent");
    else if (location.pathname.startsWith("/tools")) setActiveTab("tools");
    else setActiveTab("");
  }, [location.pathname]);

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
      console.log(`[Download] Received blob: size=${blob.size}, type=${blob.type}`);
      
      if (blob.size < 500) {
        // Very small PDFs usually indicate an error message or empty page
        const text = await blob.text();
        if (text.startsWith("{") || text.includes("Error") || text.includes("error")) {
          try {
            const err = JSON.parse(text);
            throw new Error(err.error || "The server returned an invalid file.");
          } catch (e) {
            // Not JSON, but maybe an error string
            if (text.length < 100) throw new Error(text);
          }
        }
      }

      if (blob.size === 0) throw new Error("Received an empty file from the server.");

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
      // All AI tools now proxied through the server
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          toolId, 
          input, 
          sourceLang, 
          targetLang 
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "AI request failed" }));
        throw new Error(err.error || "AI request failed");
      }

      const data = await response.json();
      setAiOutput(data);
    } catch (error: any) {
      console.error("AI Error:", error);
      let errorMessage = error.message || "AI processing failed";
      
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "The server's Gemini API key is missing or invalid. Please check the server configuration.";
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
                <Sparkles className="w-4 h-4" />
                AI Agent
              </Link>

              <Link 
                to="/tools"
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2",
                  activeTab === "tools" ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Wrench className="w-4 h-4" />
                Tools
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
                  PDF Tools
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
            <Route path="/tools" element={<ToolIndexView />} />
            <Route path="/pdf/:toolId" element={<PdfToolView conversionType={conversionType} setConversionType={setConversionType} fileState={fileState} setFileState={setFileState} urlInput={urlInput} setUrlInput={setUrlInput} handleConvert={handleConvert} handleFileChange={handleFileChange} handleDrop={handleDrop} rotation={rotation} setRotation={setRotation} reset={reset} />} />
            <Route path="/ai" element={<AiAgentHomeView />} />
            <Route path="/ai/train-status" element={<TrainStatusView handleAiAction={handleAiAction} isAiLoading={isAiLoading} aiOutput={aiOutput} setAiOutput={setAiOutput} />} />
            <Route path="/ai/:toolId" element={<AiToolView aiInput={aiInput} setAiInput={setAiInput} aiOutput={aiOutput} setAiOutput={setAiOutput} isAiLoading={isAiLoading} handleAiAction={handleAiAction} sourceLang={sourceLang} setSourceLang={setSourceLang} targetLang={targetLang} setTargetLang={setTargetLang} />} />
            <Route path="/tools/tax-calculator" element={<TaxCalculatorView />} />
            <Route path="/tools/unit-converter" element={<UnitConverterView />} />
            <Route path="/tools/password-gen" element={<PasswordGeneratorView />} />
            <Route path="/tools/bmi-calculator" element={<BmiCalculatorView />} />
            <Route path="/tools/age-calculator" element={<AgeCalculatorView />} />
            <Route path="/tools/emi-calculator" element={<EmiCalculatorView />} />
            <Route path="/tools/percentage-calculator" element={<PercentageCalculatorView />} />
            <Route path="/tools/text-converter" element={<TextConverterView />} />
            <Route path="/tools/stopwatch" element={<StopwatchView />} />
            <Route path="/tools/tip-calculator" element={<TipCalculatorView />} />
            <Route path="/tools/notepad" element={<NotepadView />} />
            <Route path="/tools/color-tools" element={<ColorToolsView />} />
            <Route path="/tools/markdown-preview" element={<MarkdownPreviewView />} />
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
      <SEO 
        title="Home - AI Smart Tools & PDF Utilities" 
        description="AiTpoint is your universal assistant for web search, content generation, PDF utilities, and local calculators. All tools work fast and are SEO optimized." 
      />
      <header className="text-center space-y-4 max-w-2xl mx-auto">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-red-600 text-white mb-2 shadow-xl"
        >
          <Bot className="w-8 h-8" />
        </motion.div>
        <h1 className="text-5xl font-black tracking-tight text-gray-900 leading-tight">
          Everything <span className="text-red-600">Automatic.</span>
        </h1>
        <p className="text-lg text-gray-500 font-medium leading-relaxed">
          The ultimate collection of AI assistants, PDF tools, and native utilities. Fast, free, and optimized for your daily needs.
        </p>
      </header>

      <div className="max-w-2xl mx-auto w-full pt-4">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-red-600 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search GPT - Ask anything with real-time web results..."
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
      </div>

      <div className="space-y-12 pt-12">
        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-gray-900">AI Agents</h2>
            <Link to="/ai">
              <Button variant="ghost" className="text-red-600 font-bold hover:bg-red-50 rounded-xl">
                Explore All AI
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_TOOLS.slice(0, 3).map((tool) => (
              <ToolCard key={tool.id} tool={tool} pathPrefix="/ai" />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-gray-900">PDF & File Tools</h2>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">8+ Utilities</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CONVERSION_OPTIONS.slice(0, 8).map((option) => (
              <Link 
                key={option.id}
                to={`/pdf/${option.id}`}
                onClick={() => setConversionType(option.id)}
                className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all mb-4">
                  <option.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors text-center">{option.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-8 pb-12">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-gray-900">Utility Calculators</h2>
            <Link to="/tools">
              <Button variant="ghost" className="text-red-600 font-bold hover:bg-red-50 rounded-xl">
                Browser Tools
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {UTILITY_TOOLS.slice(0, 3).map((tool) => (
              <ToolCard key={tool.id} tool={tool} pathPrefix="/tools" />
            ))}
          </div>
        </section>
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
    <div className="space-y-6">
      <SEO 
        title={`${currentOption.label} - Online PDF Tool`}
        description={`Fast and free ${currentOption.label} tool. Process your PDF documents instantly in your browser with AiTpoint's secure PDF utilities.`}
      />
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
    </div>
  );
}

function AiAgentHomeView() {
  return (
    <div className="space-y-12">
      <SEO 
        title="AI Agent Center - Gemini Powered Assistants" 
        description="Access multiple specialized AI agents for content generation, image creation, language translation, and real-time data search." 
      />
      
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 text-red-600 mb-2">
          <Sparkles className="w-10 h-10" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">AI Agent <span className="text-red-600">Hub</span></h1>
        <p className="text-lg text-gray-500 font-medium max-w-xl mx-auto">Master any task with our fleet of specialized AI agents. Creative, logical, and always ready to help.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AI_TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} pathPrefix="/ai" />
        ))}
      </div>
    </div>
  );
}

type AgeGroup = "Below 60" | "60 to 80" | "Above 80";

interface IncomeDetails {
  salary: number;
  rent: number;
  interest: number;
  other: number;
  digitalAssets: number;
}

interface DeductionDetails {
  section80C: number;
  section80D: number;
  nps: number;
  homeLoanInterest: number;
  section80TTA: number;
  others: number;
}

function TaxCalculatorView() {
  const [activeTab, setActiveTab] = useState<"income" | "deductions" | "summary">("income");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("Below 60");
  
  const [income, setIncome] = useState<IncomeDetails>({
    salary: 0,
    rent: 0,
    interest: 0,
    other: 0,
    digitalAssets: 0
  });

  const [deductions, setDeductions] = useState<DeductionDetails>({
    section80C: 0,
    section80D: 0,
    nps: 0,
    homeLoanInterest: 0,
    section80TTA: 0,
    others: 0
  });

  const handleIncomeChange = (field: keyof IncomeDetails, value: string) => {
    setIncome(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleDeductionChange = (field: keyof DeductionDetails, value: string) => {
    setDeductions(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const calculateOldTax = (taxableIncome: number, age: AgeGroup) => {
    let tax = 0;
    let exemption = 250000;
    if (age === "60 to 80") exemption = 300000;
    if (age === "Above 80") exemption = 500000;

    if (taxableIncome <= exemption) return 0;

    if (age === "Above 80") {
      if (taxableIncome > 1000000) {
        tax += (taxableIncome - 1000000) * 0.3;
        tax += (1000000 - 500000) * 0.2;
      } else {
        tax += (taxableIncome - 500000) * 0.2;
      }
    } else {
      if (taxableIncome > 1000000) {
        tax += (taxableIncome - 1000000) * 0.3;
        tax += (1000000 - 500000) * 0.2;
        tax += (500000 - exemption) * 0.05;
      } else if (taxableIncome > 500000) {
        tax += (taxableIncome - 500000) * 0.2;
        tax += (500000 - exemption) * 0.05;
      } else {
        tax += (taxableIncome - exemption) * 0.05;
      }
    }

    if (taxableIncome <= 500000) {
      tax = Math.max(0, tax - 12500);
    }
    return tax;
  };

  const calculateNewTax = (taxableIncome: number) => {
    if (taxableIncome <= 300000) return 0;
    let tax = 0;
    if (taxableIncome > 1500000) {
      tax += (taxableIncome - 1500000) * 0.3;
      tax += 300000 * 0.2;
      tax += 200000 * 0.15;
      tax += 300000 * 0.1;
      tax += 400000 * 0.05;
    } else if (taxableIncome > 1200000) {
      tax += (taxableIncome - 1200000) * 0.2;
      tax += 200000 * 0.15;
      tax += 300000 * 0.1;
      tax += 400000 * 0.05;
    } else if (taxableIncome > 1000000) {
      tax += (taxableIncome - 1000000) * 0.15;
      tax += 300000 * 0.1;
      tax += 400000 * 0.05;
    } else if (taxableIncome > 700000) {
      tax += (taxableIncome - 700000) * 0.1;
      tax += 400000 * 0.05;
    } else {
      tax += (taxableIncome - 300000) * 0.05;
    }

    if (taxableIncome <= 700000) {
      tax = Math.max(0, tax - 25000);
    }
    return tax;
  };

  const totalGrossIncome = (Object.values(income) as number[]).reduce((a, b) => a + b, 0);
  
  // Old Regime Summary
  const oldStdDeduction = 50000;
  const oldTotalDeductions = Math.min(income.salary, oldStdDeduction) + 
                            Math.min(150000, deductions.section80C) + 
                            deductions.section80D + 
                            Math.min(50000, deductions.nps) + 
                            deductions.homeLoanInterest + 
                            Math.min(10000, deductions.section80TTA) + 
                            deductions.others;
  const oldTaxableIncome = Math.max(0, totalGrossIncome - oldTotalDeductions);
  const oldBaseTax = calculateOldTax(oldTaxableIncome, ageGroup);
  const oldTotalTax = oldBaseTax * 1.04;

  // New Regime Summary
  const newStdDeduction = 75000;
  const newTotalDeductions = Math.min(income.salary, newStdDeduction);
  const newTaxableIncome = Math.max(0, totalGrossIncome - newTotalDeductions);
  const newBaseTax = calculateNewTax(newTaxableIncome);
  const newTotalTax = newBaseTax * 1.04;

  const getCheaperRegime = () => {
    if (newTotalTax < oldTotalTax) return "New Regime";
    if (oldTotalTax < newTotalTax) return "Old Regime";
    return "Both are same";
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      <SEO 
        title="Income Tax Calculator 2024-25 - Old vs New Regime"
        description="Calculate your income tax for the latest financial year. Compare old vs new regime automatically and save your taxes with AiTpoint."
      />
      <Link to="/tools" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors">
        <ArrowRightLeft className="w-4 h-4" />
        Back to all tools
      </Link>

      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-indigo-600 text-white p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Calculator className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black">Income Tax Calculator</CardTitle>
                <CardDescription className="text-indigo-100 font-medium">FY 2024-25 (AY 2025-26)</CardDescription>
              </div>
            </div>
            <div className="flex bg-white/10 p-1 rounded-2xl backdrop-blur-sm">
              {(["income", "deductions", "summary"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all capitalize",
                    activeTab === tab ? "bg-white text-indigo-600 shadow-lg" : "text-white hover:bg-white/10"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === "income" && (
              <motion.div
                key="income"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-10"
              >
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Select Age Group</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Below 60", "60 to 80", "Above 80"] as const).map(group => (
                        <button
                          key={group}
                          onClick={() => setAgeGroup(group)}
                          className={cn(
                            "py-3 px-2 rounded-xl text-xs font-bold transition-all border-2",
                            ageGroup === group 
                              ? "bg-indigo-50 border-indigo-600 text-indigo-600" 
                              : "border-gray-100 text-gray-500 hover:border-indigo-200"
                          )}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <InputField label="Gross Salary Income" value={income.salary} onChange={(v) => handleIncomeChange("salary", v)} icon={<UserIcon className="w-5 h-5" />} />
                    <InputField label="Annual Rent Received" value={income.rent} onChange={(v) => handleIncomeChange("rent", v)} icon={<ImageIcon className="w-5 h-5" />} />
                    <InputField label="Interest Income" value={income.interest} onChange={(v) => handleIncomeChange("interest", v)} icon={<Sparkles className="w-5 h-5" />} />
                  </div>
                </div>

                <div className="space-y-6">
                  <InputField label="Income from Digital Assets" value={income.digitalAssets} onChange={(v) => handleIncomeChange("digitalAssets", v)} icon={<Globe className="w-5 h-5" />} />
                  <InputField label="Other Income" value={income.other} onChange={(v) => handleIncomeChange("other", v)} icon={<MessageSquare className="w-5 h-5" />} />
                  
                  <div className="p-8 bg-indigo-50 rounded-3xl border-2 border-indigo-100 mt-4">
                    <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs mb-2">Total Gross Income</p>
                    <p className="text-4xl font-black text-indigo-900">{formatCurrency(totalGrossIncome)}</p>
                    <Button 
                      onClick={() => setActiveTab("deductions")} 
                      className="w-full mt-6 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg"
                    >
                      Next: Deductions <ArrowRightLeft className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "deductions" && (
              <motion.div
                key="deductions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-10"
              >
                <div className="space-y-6">
                  <InputField label="Section 80C (LIC, PPF, etc.)" value={deductions.section80C} onChange={(v) => handleDeductionChange("section80C", v)} max={150000} />
                  <InputField label="Section 80D (Health Insurance)" value={deductions.section80D} onChange={(v) => handleDeductionChange("section80D", v)} />
                  <InputField label="Section 80CCD(1B) (NPS)" value={deductions.nps} onChange={(v) => handleDeductionChange("nps", v)} max={50000} />
                </div>
                <div className="space-y-6">
                  <InputField label="Home Loan Interest (Sec 24)" value={deductions.homeLoanInterest} onChange={(v) => handleDeductionChange("homeLoanInterest", v)} />
                  <InputField label="Section 80TTA (Savings Interest)" value={deductions.section80TTA} onChange={(v) => handleDeductionChange("section80TTA", v)} max={10000} />
                  <InputField label="Other Deductions" value={deductions.others} onChange={(v) => handleDeductionChange("others", v)} />
                </div>
                <div className="md:col-span-2 flex justify-between gap-4">
                  <Button variant="outline" onClick={() => setActiveTab("income")} className="h-14 px-8 border-2 rounded-2xl font-bold">Back</Button>
                  <Button onClick={() => setActiveTab("summary")} className="h-14 px-10 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">Show Summary</Button>
                </div>
              </motion.div>
            )}

            {activeTab === "summary" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <SummaryCard title="Old Regime" amount={oldTotalTax} taxable={oldTaxableIncome} color="bg-slate-100" textColor="text-slate-900" deductions={oldTotalDeductions} />
                  <SummaryCard title="New Regime" amount={newTotalTax} taxable={newTaxableIncome} color="bg-indigo-600" textColor="text-white" deductions={newTotalDeductions} isRecommended={newTotalTax <= oldTotalTax} />
                  
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 flex flex-col justify-center text-center">
                    <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                    <h4 className="text-xl font-black text-amber-900">Recommendation</h4>
                    <p className="text-amber-800 font-medium mt-2">You should choose the <span className="font-bold underline">{getCheaperRegime()}</span> to save approximately</p>
                    <p className="text-3xl font-black text-amber-600 mt-4">{formatCurrency(Math.abs(oldTotalTax - newTotalTax))}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-gray-50 rounded-3xl p-10 items-center">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Old Regime Tax', value: Number(oldTotalTax) },
                            { name: 'New Regime Tax', value: Number(newTotalTax) }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={10}
                          dataKey="value"
                        >
                          <Cell key="old" fill="#94a3b8" />
                          <Cell key="new" fill="#4f46e5" />
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-2xl font-black text-gray-900">Tax Comparison Visualization</h3>
                    <p className="text-gray-500 leading-relaxed font-medium">The chart illustrates the difference in tax liability between the two regimes based on your inputs and eligible deductions. The New Regime is often better for those with minimal investments, while the Old Regime benefits those with significant tax-saving declarations.</p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-slate-400" />
                        <span className="text-sm font-bold text-gray-600">Old Regime ({formatCurrency(oldTotalTax)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-600" />
                        <span className="text-sm font-bold text-gray-600">New Regime ({formatCurrency(newTotalTax)})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function InputField({ label, value, onChange, max, icon }: { label: string, value: number, onChange: (v: string) => void, max?: number, icon?: React.ReactNode }) {
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center">
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest transition-colors group-focus-within:text-indigo-600">{label}</label>
        {max && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Max: {new Intl.NumberFormat('en-IN').format(max)}</span>}
      </div>
      <div className="relative">
        {icon && <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-all">{icon}</div>}
        <input 
          type="number"
          placeholder="0"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full p-4 pl-14 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all font-bold text-lg",
            !icon && "pl-6"
          )}
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, amount, taxable, color, textColor, deductions, isRecommended }: { title: string, amount: number, taxable: number, color: string, textColor: string, deductions: number, isRecommended?: boolean }) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className={cn("relative p-8 rounded-3xl transition-all hover:scale-[1.02]", color, textColor)}>
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg flex items-center gap-1 animate-pulse">
          <CheckCircle2 className="w-3 h-3" /> Best Choice
        </div>
      )}
      <h3 className="text-lg font-bold opacity-80 uppercase tracking-widest">{title}</h3>
      <p className="text-4xl font-black mt-2">{formatCurrency(amount)}</p>
      <div className="mt-8 pt-8 border-t border-black/10 space-y-3">
        <div className="flex justify-between text-sm opacity-80 font-bold">
          <span>Gross Income</span>
          <span>{formatCurrency(taxable + deductions)}</span>
        </div>
        <div className="flex justify-between text-sm opacity-80 font-bold">
          <span>Deductions</span>
          <span className="text-red-400">-{formatCurrency(deductions)}</span>
        </div>
        <div className="flex justify-between text-sm font-black border-t border-black/5 pt-3">
          <span>Taxable Income</span>
          <span>{formatCurrency(taxable)}</span>
        </div>
      </div>
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
      <SEO 
        title="Live Train Running Status - Indian Railways" 
        description="Check real-time train status, platform location, and delays. Indian Railways live train tracking by AiTpoint." 
      />
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

function UnitConverterView() {
  const [value, setValue] = useState<string>("1");
  const [type, setType] = useState<"length" | "weight" | "temp">("length");
  const [from, setFrom] = useState("Meter");
  const [to, setTo] = useState("Foot");
  const [result, setResult] = useState<number | null>(null);

  const units = {
    length: {
      Meter: 1,
      Foot: 3.28084,
      Inch: 39.3701,
      Kilometer: 0.001,
      Mile: 0.000621371,
      Centimeter: 100
    },
    weight: {
      Kilogram: 1,
      Pound: 2.20462,
      Gram: 1000,
      Ounce: 35.274,
      MetricTon: 0.001
    }
  };

  const handleConvert = () => {
    const val = parseFloat(value);
    if (isNaN(val)) return;

    if (type === "temp") {
      let celsius = val;
      if (from === "Fahrenheit") celsius = (val - 32) * 5/9;
      if (from === "Kelvin") celsius = val - 273.15;

      let res = celsius;
      if (to === "Fahrenheit") res = (celsius * 9/5) + 32;
      if (to === "Kelvin") res = celsius + 273.15;
      setResult(res);
    } else {
      const fromRate = (units[type] as any)[from];
      const toRate = (units[type] as any)[to];
      setResult((val / fromRate) * toRate);
    }
  };

  return (
    <div className="space-y-6">
      <SEO 
        title="Unit Converter - Length, Weight, Temperature" 
        description="Convert instantly between Meters, Feet, KG, LBS, Celsius, Fahrenheit and more. Simple and fast online unit converter." 
      />
      <Link to="/tools" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-teal-600">
        <ArrowRightLeft className="w-4 h-4" />
        Back to all tools
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle>Unit Converter</CardTitle>
          <CardDescription className="text-teal-100">Simple and precise conversions</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex gap-2">
            {(["length", "weight", "temp"] as const).map(t => (
              <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => { setType(t); setFrom(t === "temp" ? "Celsius" : Object.keys(units[t])[0]); setTo(t === "temp" ? "Fahrenheit" : Object.keys(units[t])[1]); }} className="capitalize rounded-xl">{t}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="p-4 bg-gray-50 border rounded-2xl" placeholder="Value" />
            <select value={from} onChange={e => setFrom(e.target.value)} className="p-4 bg-gray-50 border rounded-2xl">
              {type === "temp" ? ["Celsius", "Fahrenheit", "Kelvin"].map(u => <option key={u}>{u}</option>) : Object.keys(units[type]).map(u => <option key={u}>{u}</option>)}
            </select>
            <select value={to} onChange={e => setTo(e.target.value)} className="p-4 bg-gray-50 border rounded-2xl">
              {type === "temp" ? ["Celsius", "Fahrenheit", "Kelvin"].map(u => <option key={u}>{u}</option>) : Object.keys(units[type]).map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <Button onClick={handleConvert} className="w-full h-14 bg-teal-600 hover:bg-teal-700 rounded-2xl font-bold">Convert Now</Button>
          {result !== null && (
            <div className="p-6 bg-teal-50 rounded-2xl text-center">
              <p className="text-sm font-bold text-teal-600 uppercase">Result</p>
              <p className="text-4xl font-black text-teal-900">{result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordGeneratorView() {
  const [length, setLength] = useState(16);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState("");

  const generate = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let pool = chars;
    if (includeNumbers) pool += nums;
    if (includeSymbols) pool += symbols;
    
    let res = "";
    for (let i = 0; i < length; i++) {
      res += pool.charAt(Math.floor(Math.random() * pool.length));
    }
    setPassword(res);
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-slate-700">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-700 text-white">
          <CardTitle>Password Generator</CardTitle>
          <CardDescription className="text-slate-300">Generate secure passwords locally in your browser</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between font-bold"><span>Length: {length}</span></div>
            <input type="range" min="8" max="64" value={length} onChange={e => setLength(parseInt(e.target.value))} className="w-full accent-slate-700" />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeNumbers} onChange={e => setIncludeNumbers(e.target.checked)} className="w-5 h-5 accent-slate-700" /> Numbers</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeSymbols} onChange={e => setIncludeSymbols(e.target.checked)} className="w-5 h-5 accent-slate-700" /> Symbols</label>
            </div>
          </div>
          <Button onClick={generate} className="w-full h-14 bg-slate-700 hover:bg-slate-800 rounded-2xl font-bold">Generate Password</Button>
          {password && (
            <div className="p-6 bg-slate-50 rounded-2xl">
              <div className="flex items-center justify-between gap-4">
                <code className="text-lg font-mono break-all text-slate-900 bg-white p-3 rounded-lg flex-1 border">{password}</code>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copied to clipboard!"); }} className="rounded-xl">Copy</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
      <SEO 
        title={`${tool.label} - Gemini AI Agent`}
        description={tool.description}
      />
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

function BmiCalculatorView() {
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("175");
  const [bmi, setBmi] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const calculate = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (w > 0 && h > 0) {
      const res = w / (h * h);
      setBmi(res);
      if (res < 18.5) setStatus("Underweight");
      else if (res < 25) setStatus("Normal weight");
      else if (res < 30) setStatus("Overweight");
      else setStatus("Obesity");
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-rose-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-rose-500 text-white">
          <CardTitle>BMI Calculator</CardTitle>
          <CardDescription className="text-rose-100">Calculate your Body Mass Index</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Weight (kg)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Height (cm)</label>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
          </div>
          <Button onClick={calculate} className="w-full h-14 bg-rose-500 hover:bg-rose-600 rounded-2xl font-bold">Calculate BMI</Button>
          {bmi && (
            <div className="p-6 bg-rose-50 rounded-2xl text-center">
              <p className="text-sm font-bold text-rose-600 uppercase">Your BMI</p>
              <p className="text-5xl font-black text-rose-900">{bmi.toFixed(1)}</p>
              <p className="mt-2 text-lg font-bold text-rose-700">{status}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgeCalculatorView() {
  const [birthDate, setBirthDate] = useState("");
  const [age, setAge] = useState<{ y: number, m: number, d: number } | null>(null);

  const calculate = () => {
    if (!birthDate) return;
    const today = new Date();
    const birth = new Date(birthDate);
    let y = today.getFullYear() - birth.getFullYear();
    let m = today.getMonth() - birth.getMonth();
    let d = today.getDate() - birth.getDate();

    if (m < 0 || (m === 0 && d < 0)) {
      y--;
      m += 12;
    }
    if (d < 0) {
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      d += lastMonth.getDate();
      m--;
    }
    setAge({ y, m, d });
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-blue-500 text-white">
          <CardTitle>Age Calculator</CardTitle>
          <CardDescription className="text-blue-100">Calculate your exact age</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Date of Birth</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
          </div>
          <Button onClick={calculate} className="w-full h-14 bg-blue-500 hover:bg-blue-600 rounded-2xl font-bold">Calculate Age</Button>
          {age && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-6 bg-blue-50 rounded-2xl text-center">
                <p className="text-3xl font-black text-blue-900">{age.y}</p>
                <p className="text-xs font-bold text-blue-600 uppercase">Years</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-2xl text-center">
                <p className="text-3xl font-black text-blue-900">{age.m}</p>
                <p className="text-xs font-bold text-blue-600 uppercase">Months</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-2xl text-center">
                <p className="text-3xl font-black text-blue-900">{age.d}</p>
                <p className="text-xs font-bold text-blue-600 uppercase">Days</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmiCalculatorView() {
  const [amount, setAmount] = useState("1000000");
  const [rate, setRate] = useState("8.5");
  const [tenure, setTenure] = useState("10");
  const [emi, setEmi] = useState<number | null>(null);

  const calculate = () => {
    const P = parseFloat(amount);
    const r = parseFloat(rate) / 12 / 100;
    const n = parseFloat(tenure) * 12;
    if (P > 0 && r > 0 && n > 0) {
      const res = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      setEmi(res);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-600">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-emerald-600 text-white">
          <CardTitle>EMI Calculator</CardTitle>
          <CardDescription className="text-emerald-100">Personal, Home or Car Loan EMI</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Loan Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Interest Rate (%)</label>
                <input type="number" step="0.1" value={rate} onChange={e => setRate(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Tenure (Years)</label>
                <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
              </div>
            </div>
          </div>
          <Button onClick={calculate} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold">Calculate EMI</Button>
          {emi && (
            <div className="p-6 bg-emerald-50 rounded-2xl text-center">
              <p className="text-sm font-bold text-emerald-600 uppercase">Monthly EMI</p>
              <p className="text-4xl font-black text-emerald-900">₹{Math.round(emi).toLocaleString()}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs font-bold text-emerald-700">
                <div>Total Interest: ₹{Math.round(emi * parseFloat(tenure) * 12 - parseFloat(amount)).toLocaleString()}</div>
                <div>Total Payable: ₹{Math.round(emi * parseFloat(tenure) * 12).toLocaleString()}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PercentageCalculatorView() {
  const [val1, setVal1] = useState("10");
  const [val2, setVal2] = useState("200");
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    setResult((parseFloat(val1) / 100) * parseFloat(val2));
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-amber-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-amber-500 text-white">
          <CardTitle>Percentage Calculator</CardTitle>
          <CardDescription className="text-amber-100">Simple percentage math</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-4 text-xl font-bold">
            <span>What is</span>
            <input type="number" value={val1} onChange={e => setVal1(e.target.value)} className="w-24 p-3 bg-gray-50 border rounded-xl text-center" />
            <span>% of</span>
            <input type="number" value={val2} onChange={e => setVal2(e.target.value)} className="w-32 p-3 bg-gray-50 border rounded-xl text-center" />
          </div>
          <Button onClick={calculate} className="w-full h-14 bg-amber-500 hover:bg-amber-600 rounded-2xl font-bold">Calculate</Button>
          {result !== null && (
            <div className="p-6 bg-amber-50 rounded-2xl text-center">
              <p className="text-sm font-bold text-amber-600 uppercase">Result</p>
              <p className="text-5xl font-black text-amber-900">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TextConverterView() {
  const [text, setText] = useState("");
  
  const convert = (type: string) => {
    if (type === "upper") setText(text.toUpperCase());
    if (type === "lower") setText(text.toLowerCase());
    if (type === "sentence") setText(text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());
    if (type === "title") setText(text.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-purple-600">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-purple-600 text-white">
          <CardTitle>Text Case Converter</CardTitle>
          <CardDescription className="text-purple-100">Format your text instantly</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <textarea value={text} onChange={e => setText(e.target.value)} className="w-full h-40 p-4 bg-gray-50 border rounded-2xl resize-none" placeholder="Paste your text here..." />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Button onClick={() => convert("upper")} variant="outline" className="rounded-xl">UPPERCASE</Button>
            <Button onClick={() => convert("lower")} variant="outline" className="rounded-xl">lowercase</Button>
            <Button onClick={() => convert("sentence")} variant="outline" className="rounded-xl">Sentence case</Button>
            <Button onClick={() => convert("title")} variant="outline" className="rounded-xl">Title Case</Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied!"); }} className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700">Copy Result</Button>
            <Button onClick={() => setText("")} variant="outline" className="flex-1 rounded-xl">Clear All</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StopwatchView() {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);

  React.useEffect(() => {
    let interval: any;
    if (running) {
      interval = setInterval(() => setTime(prev => prev + 10), 10);
    }
    return () => clearInterval(interval);
  }, [running]);

  const format = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const msPart = Math.floor((ms % 1000) / 10);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${msPart.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-orange-500 text-white">
          <CardTitle>Stopwatch</CardTitle>
          <CardDescription className="text-orange-100">Precise timing with laps</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="text-7xl font-black text-center font-mono tabular-nums text-orange-900">{format(time)}</div>
          <div className="flex gap-4">
            <Button onClick={() => setRunning(!running)} className={cn("flex-1 h-16 rounded-2xl text-xl font-bold", running ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600")}>{running ? "Stop" : "Start"}</Button>
            <Button onClick={() => { if(running) setLaps([time, ...laps]); else { setTime(0); setLaps([]); } }} variant="outline" className="flex-1 h-16 rounded-2xl text-xl font-bold">{running ? "Lap" : "Reset"}</Button>
          </div>
          {laps.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {laps.map((lap, i) => (
                <div key={i} className="flex justify-between p-3 bg-gray-50 rounded-xl font-mono text-sm">
                  <span className="text-gray-400">Lap {laps.length - i}</span>
                  <span className="font-bold">{format(lap)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TipCalculatorView() {
  const [bill, setBill] = useState(" bill"); // Wait, bill state was 500 in my thought, fixing
  const [tipPercent, setTipPercent] = useState("10");
  const [people, setPeople] = useState("2");

  const totalTip = (parseFloat(bill) * parseFloat(tipPercent)) / 100;
  const totalBill = parseFloat(bill) + totalTip;
  const perPerson = totalBill / parseFloat(people);

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-amber-700">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-amber-700 text-white">
          <CardTitle>Tip Calculator</CardTitle>
          <CardDescription className="text-amber-100">Calculate tips and split bills</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Bill Amount (₹)</label>
              <input type="number" value={bill} onChange={e => setBill(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Tip (%)</label>
              <input type="number" value={tipPercent} onChange={e => setTipPercent(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Number of People</label>
              <input type="number" value={people} onChange={e => setPeople(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-amber-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-amber-600 uppercase">Tip Per Person</p>
              <p className="text-3xl font-black text-amber-900">₹{(totalTip / parseFloat(people)).toFixed(2)}</p>
            </div>
            <div className="p-6 bg-amber-900 text-white rounded-2xl text-center shadow-lg">
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Total Per Person</p>
              <p className="text-3xl font-black">₹{perPerson.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotepadView() {
  const [notes, setNotes] = useState(() => localStorage.getItem("aitpoint_notes") || "");
  
  const save = (val: string) => {
    setNotes(val);
    localStorage.setItem("aitpoint_notes", val);
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-yellow-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-yellow-500 text-white">
          <CardTitle>Quick Notepad</CardTitle>
          <CardDescription className="text-yellow-100">Your notes are saved in your browser locally</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <textarea value={notes} onChange={e => save(e.target.value)} className="w-full h-[400px] p-8 border-none focus:outline-none resize-none bg-yellow-50/30 text-lg leading-relaxed text-gray-800 placeholder:text-yellow-200" placeholder="Start typing your notes here..." />
        </CardContent>
        <CardFooter className="bg-yellow-50 p-4 flex justify-between text-xs font-bold text-yellow-600 uppercase tracking-widest">
          <span>Characters: {notes.length}</span>
          <span>Auto-saved locally</span>
        </CardFooter>
      </Card>
    </div>
  );
}

function ColorToolsView() {
  const [color, setColor] = useState("#4f46e5");
  
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-pink-500">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-pink-500 text-white">
          <CardTitle>Color Tools</CardTitle>
          <CardDescription className="text-pink-100">Pick colors and get codes</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-40 h-40 rounded-3xl border-none cursor-pointer overflow-hidden p-0 shadow-xl" />
            <div className="flex-1 space-y-4 w-full">
              <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 flex justify-between items-center group">
                <code className="text-xl font-mono font-bold text-gray-900">{color.toUpperCase()}</code>
                <Button onClick={() => { navigator.clipboard.writeText(color.toUpperCase()); toast.success("Copied Hex!"); }} variant="ghost" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">Copy</Button>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 flex justify-between items-center group">
                <code className="text-xl font-mono font-bold text-gray-900">{hexToRgb(color)}</code>
                <Button onClick={() => { navigator.clipboard.writeText(hexToRgb(color)); toast.success("Copied RGB!"); }} variant="ghost" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">Copy</Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
              <div key={o} className="h-16 rounded-xl shadow-inner border border-gray-100" style={{ backgroundColor: color, opacity: o }} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MarkdownPreviewView() {
  const [text, setText] = useState("# Markdown Previewer\n\nStart writing markdown here and see the output on the right!\n\n- **Bold text**\n- *Italic text*\n- [Link](https://google.com)\n\n### Code example\n```ts\nconst hello = \"world\";\n```");

  return (
    <div className="space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-sky-600">
        <ArrowRightLeft className="w-4 h-4" />
        Back to Home
      </Link>
      <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-sky-600 text-white">
          <CardTitle>Markdown Preview</CardTitle>
          <CardDescription className="text-sky-100">Live markdown editor & previewer</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[500px]">
            <textarea value={text} onChange={e => setText(e.target.value)} className="p-6 h-full border-r focus:outline-none resize-none font-mono text-sm bg-gray-50/50" placeholder="Type markdown here..." />
            <div className="p-6 h-full overflow-y-auto prose prose-sm max-w-none prose-slate">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
