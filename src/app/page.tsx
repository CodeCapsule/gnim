"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  SquarePen,
  Trash2,
  PanelLeft,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe,
  Check,
  MoreHorizontal,
  Share,
  ChevronRight,
  Settings,
  X,
  Zap,
  Github,
} from "lucide-react";
import ChatWindow from "@/components/ChatWindow";

// ---------- Types ----------
export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: StoredMessage[];
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// ---------- Helpers ----------
export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem("chatbot_conversations");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConversations(convos: Conversation[]) {
  localStorage.setItem("chatbot_conversations", JSON.stringify(convos));
}

function createBlankConversation(): Conversation {
  return {
    id: generateId(),
    title: "New Chat",
    createdAt: Date.now(),
    messages: [],
  };
}

// ---------- Main Page ----------
export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"About" | "Me">("About");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadConversations();
    if (loaded.length > 0) {
      setConversations(loaded);
      setActiveId(loaded[0].id);
    } else {
      // Always start with a blank conversation so ChatWindow never gets key="new"
      const blank = createBlankConversation();
      setConversations([blank]);
      setActiveId(blank.id);
    }

    // Default sidebar to open on desktop
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }

    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const visibleConversations = conversations.filter((c) => c.messages.length > 0);

  // Create a brand new blank chat and switch to it
  const newChat = () => {
    const blank = createBlankConversation();
    setConversations((prev) => {
      const updated = [blank, ...prev];
      saveConversations(updated);
      return updated;
    });
    setActiveId(blank.id);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    let nextActiveId = activeId;
    const updated = conversations.filter((c) => c.id !== id);
    let finalConversations = updated;

    // If we deleted the active one, pick the next or create a blank
    if (id === activeId) {
      if (updated.length > 0) {
        nextActiveId = updated[0].id;
      } else {
        const blank = createBlankConversation();
        finalConversations = [blank];
        nextActiveId = blank.id;
      }
    }

    setConversations(finalConversations);
    setActiveId(nextActiveId);
    saveConversations(finalConversations);
  };

  const confirmDeleteAll = () => {
    const blank = createBlankConversation();
    setConversations([blank]);
    setActiveId(blank.id);
    saveConversations([blank]);
    setShowDeleteAllModal(false);
  };

  // Called by ChatWindow to update title/messages in the parent
  const updateConversation = (updated: Conversation) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === updated.id);
      const next = exists
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [updated, ...prev];
      saveConversations(next);
      return next;
    });
    // Do NOT call setActiveId here — it would remount ChatWindow mid-stream!
  };

  if (!mounted || !activeConversation) return null;

  return (
    <div className="flex h-screen bg-[#212121] text-white overflow-hidden">
      {/* ===== SIDEBAR ===== */}
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`absolute md:relative z-50 h-full flex flex-col bg-[#171717] transition-all duration-300 ease-in-out flex-shrink-0 border-r border-zinc-800/50 md:border-none ${
          sidebarOpen 
            ? "translate-x-0 w-[280px] md:w-64 shadow-2xl md:shadow-none" 
            : "-translate-x-full w-[280px] md:w-0 md:translate-x-0 overflow-hidden"
        }`}
        style={{ left: 0, top: 0 }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3">
          <button className="p-1.5 rounded-md hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-zinc-200">
            <MessageSquare size={18} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-md hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-zinc-200"
            >
              <PanelLeft size={18} />
            </button>
            <button
              onClick={newChat}
              className="p-1.5 rounded-md hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-zinc-200"
            >
              <SquarePen size={18} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 py-1 space-y-1">
          <button
            onClick={() => {
              newChat();
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] font-semibold text-zinc-200 hover:bg-zinc-900 border border-zinc-800 transition-all duration-200"
          >
            <SquarePen size={15} className="text-zinc-200" />
            New chat
          </button>

          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-900 rounded-lg transition-all duration-200 text-left"
          >
            <Trash2 size={15} className="text-zinc-200" />
            Delete all
          </button>
        </div>

        {/* History section */}
        <div className="flex-1 overflow-y-auto px-3 mt-6">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            History
          </h3>

          {/* Filter out blank untouched "New Chat" conversations from the history list */}
          {visibleConversations.length === 0 ? (
            <p className="text-[13px] text-zinc-400 leading-snug px-2 mt-2">
              Your conversations will appear here<br />once you start chatting!
            </p>
          ) : (
            <div className="space-y-0.5">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-2 mt-4">
                Today
              </h3>
              {visibleConversations.map((c, index, arr) => (
                <div key={c.id}>
                  <div
                    onClick={() => {
                      setActiveId(c.id);
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-[13px] transition-all duration-200 ${
                      c.id === activeId
                        ? "text-zinc-200"
                        : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                    }`}
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.id === activeId && (
                      <div className="relative" ref={activeMenuId === c.id ? menuRef : null}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === c.id ? null : c.id);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        
                        {activeMenuId === c.id && (
                          <div className="absolute right-0 top-6 mt-1 w-40 bg-[#212121] border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                              className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg hover:bg-[#2f2f2f] transition-colors text-left text-[14px] font-medium text-zinc-200"
                            >
                              <div className="flex items-center gap-3">
                                <Share size={16} className="text-zinc-300" strokeWidth={1.5} />
                                <span>Share</span>
                              </div>
                              <ChevronRight size={14} className="text-zinc-500" />
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                deleteConversation(c.id, e);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-[#2f2f2f] transition-colors text-left text-[14px] font-medium text-zinc-200 mt-0.5"
                            >
                              <Trash2 size={16} className="text-zinc-300" strokeWidth={1.5} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Dotted line under the active conversation */}
                  {c.id === activeId && index < arr.length - 1 && (
                    <div className="border-b border-dashed border-zinc-700/60 my-1 mx-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Guest profile section at bottom */}
        <div className="p-3 border-t border-zinc-900/50 mt-auto">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#3d420f] border border-[#5c6317]" />
              <span className="text-[13px] font-medium text-zinc-200">Guest</span>
            </div>
            <Settings size={14} className="text-zinc-500" />
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#212121]">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-900/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1 rounded-md hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white"
                >
                  <PanelLeft size={22} />
                </button>
                <button
                  onClick={newChat}
                  className="p-1 rounded-md hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white"
                >
                  <SquarePen size={22} />
                </button>
              </div>
            )}
            <button className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-zinc-900 transition-colors text-zinc-500">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-[1px]">
                {/* Ears */}
                <rect x="2" y="2" width="3" height="3" fill="#f97316" />
                <rect x="11" y="2" width="3" height="3" fill="#f97316" />
                {/* Head */}
                <rect x="2" y="5" width="12" height="9" rx="1" fill="#f97316" />
                {/* Eyes */}
                <rect x="4" y="7" width="2" height="2" fill="#171717" />
                <rect x="10" y="7" width="2" height="2" fill="#171717" />
                {/* Nose/Mouth */}
                <rect x="7" y="9" width="2" height="2" fill="#171717" />
              </svg>
              <span className="text-[14px] font-semibold text-zinc-300">Gnim AI</span>
              <ChevronDown size={14} className="text-zinc-500" strokeWidth={2.5} />
            </button>
          </div>

          {/* Privacy dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/60 border hover:border-zinc-700 text-zinc-300 hover:text-white text-sm font-semibold cursor-pointer transition-all ${
                dropdownOpen ? "border-zinc-600 bg-zinc-800" : "border-zinc-800/80"
              }`}
            >
              {isPrivate ? <Lock size={14} className="text-zinc-400" /> : <Globe size={14} className="text-zinc-400" />}
              <ChevronDown size={14} className="text-zinc-500" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#121212] border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50">
                <button
                  onClick={() => { setIsPrivate(true); setDropdownOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <div className="py-1">
                    <p className="text-sm font-semibold text-white">Private</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Only you can access this chat</p>
                  </div>
                  {isPrivate && (
                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <Check size={10} className="text-black stroke-[3]" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => { setIsPrivate(false); setDropdownOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <div className="py-1">
                    <p className="text-sm font-semibold text-white">Public</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Anyone with the link can access this chat</p>
                  </div>
                  {!isPrivate && (
                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <Check size={10} className="text-black stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ChatWindow — key is always activeId (never "new"), so it never remounts mid-stream */}
        <ChatWindow
          key={activeId}
          conversation={activeConversation}
          onUpdate={updateConversation}
        />
      </main>

      {/* ===== DELETE ALL MODAL ===== */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#212121] border border-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Delete all chats?</h2>
              <p className="text-sm text-zinc-400">
                This will permanently delete all of your conversation history. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#171717] border-t border-zinc-800">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAll}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== SETTINGS MODAL ===== */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#212121] border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[15px] font-semibold text-white">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center px-4 pt-1 border-b border-zinc-700/50">
              <div 
                onClick={() => setSettingsTab("About")}
                className={`px-4 pb-3 border-b-2 text-[13px] font-medium cursor-pointer transition-colors ${settingsTab === "About" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
              >
                About
              </div>
              <div 
                onClick={() => setSettingsTab("Me")}
                className={`px-4 pb-3 border-b-2 text-[13px] font-medium cursor-pointer transition-colors ${settingsTab === "Me" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
              >
                Me
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-5">
              {settingsTab === "About" ? (
                <>
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Ears */}
                      <rect x="2" y="2" width="3" height="3" fill="#f97316" />
                      <rect x="11" y="2" width="3" height="3" fill="#f97316" />
                      {/* Head */}
                      <rect x="2" y="5" width="12" height="9" rx="1" fill="#f97316" />
                      {/* Eyes */}
                      <rect x="4" y="7" width="2" height="2" fill="#171717" />
                      <rect x="10" y="7" width="2" height="2" fill="#171717" />
                      {/* Nose/Mouth */}
                      <rect x="7" y="9" width="2" height="2" fill="#171717" />
                    </svg>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2.5">Gnim AI</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">
                      A fast, private AI assistant built with the Vercel AI SDK.
                    </p>
                  </div>
                  
                  <hr className="border-zinc-700/60 my-1" />
                  
                  <div className="flex items-center text-[13px] font-semibold text-zinc-200">
                    Made by <span className="text-[#f97316] ml-1">Gnim</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white mb-3">Please decode me ^^ :</h3>
                    <p className="text-[14px] text-zinc-300 leading-relaxed font-mono break-all whitespace-pre-wrap">
                      01010011 01010111 01111000 01110110 01100100 01101101 01010101 01100111 01100101 01010111
                      00111001 00110001 01001001 01001000 01101100 01110000 01011010 01010111 01010110 01101100
                      01011010 01010111 01010101 00111101
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
