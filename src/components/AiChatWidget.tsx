import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Building2, ExternalLink, HelpCircle, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Business } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sources?: { title: string; uri: string }[];
}

interface AiChatWidgetProps {
  businesses: Business[];
  isAiEnabled: boolean;
}

const STARTER_PROMPTS = [
  "⛅ What is the weather in Celina TX today?",
  "🥧 What is famous to eat on the Square?",
  "🎭 Any fun community events or activities?",
  "💼 Show me some Premium verified businesses"
];

export default function AiChatWidget({ businesses, isAiEnabled }: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Howdy! I'm your **Celina Connection AI Assistant**. 🤠✨\n\nAsk me anything about local business listings, operating hours, current weather on the Square, or upcoming Celina community events!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!isAiEnabled) return null;

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Gather only standard fields of businesses to reduce token payload sizes
      const minimizedBusinesses = businesses.map(b => ({
        id: b.id,
        name: b.name,
        category: b.category,
        description: b.description,
        address: b.address,
        hours: b.hours,
        phone: b.phone,
        website: b.website,
        tier: b.tier,
        rating: b.reviews.length 
          ? (b.reviews.reduce((acc, r) => acc + r.rating, 0) / b.reviews.length).toFixed(1) 
          : "No reviews yet"
      }));

      // Map chat messages format for server
      const chatHistoryForServer = [...messages, userMsg].slice(-8).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: chatHistoryForServer,
          businesses: minimizedBusinesses
        })
      });

      if (!res.ok) {
        throw new Error('Failed to get a response from server');
      }

      const data = await res.json();

      const aiMsg: Message = {
        id: `msg-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        text: data.text || "I processed that, but couldn't generate a text response. Let me know if you want to try again!",
        sources: data.sources || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `msg-err-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        text: "My apologies! I ran into an error connecting to our Celina Connection AI core. Please check your internet connection or try again shortly.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" id="ai-chat-widget">
      {/* Floating Action Button */}
      <motion.button
        id="ai-chat-fab"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg hover:shadow-orange-200/50 cursor-pointer relative group border border-white/20"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <MessageSquare className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Tooltip hint */}
        {!isOpen && (
          <div className="absolute right-16 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
            Ask Celina AI 🤠✨
          </div>
        )}
      </motion.button>

      {/* Expanded Chat Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="ai-chat-panel"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute bottom-18 right-0 w-[90vw] sm:w-[380px] h-[550px] rounded-3xl bg-white border border-slate-150 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-orange-950 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white shadow-inner">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1">
                    Celina AI Assistant
                  </h3>
                  <p className="text-[10px] text-orange-300 font-semibold tracking-wide uppercase flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Online & Grounded
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Body Container */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => {
                const isAi = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 max-w-[85%] ${
                      isAi ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isAi ? 'bg-orange-100 text-orange-600' : 'bg-slate-900 text-white'
                    }`}>
                      {isAi ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="space-y-1">
                      <div className={`rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                        isAi 
                          ? 'bg-white text-slate-800 border border-slate-100 rounded-tl-none' 
                          : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-tr-none'
                      }`}>
                        {/* Custom Mini Markdown parsing */}
                        <p className="whitespace-pre-line">
                          {msg.text.split('**').map((part, index) => 
                            index % 2 === 1 ? <strong key={index} className="font-black">{part}</strong> : part
                          )}
                        </p>

                        {/* Search Grounding Citation Sources */}
                        {isAi && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Grounding Sources:</span>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-semibold transition-colors text-[9px]"
                                  title={src.title}
                                >
                                  <span>{src.title.length > 20 ? src.title.substring(0, 18) + '...' : src.title}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] font-medium text-slate-400 block ${isAi ? 'text-left pl-1' : 'text-right pr-1'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Typing State Bouncing Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2 max-w-[85%]">
                  <div className="h-7 w-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starter Prompts */}
            {messages.length === 1 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-slate-400" /> Suggested queries:
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSendMessage(prompt.substring(2))}
                      className="text-left px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-[10px] font-semibold text-slate-600 hover:text-orange-700 border border-slate-100 hover:border-orange-200 transition-all cursor-pointer truncate"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleFormSubmit} className="p-3 bg-white border-t border-slate-150 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about events, weather, or businesses..."
                className="flex-grow px-3 py-2 text-xs font-medium bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className={`p-2.5 rounded-xl text-white font-bold transition-all ${
                  inputText.trim() && !isLoading
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 cursor-pointer shadow-sm hover:shadow'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
