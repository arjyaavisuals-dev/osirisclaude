'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Newspaper, AlertCircle, Sparkles } from 'lucide-react';
import AiOverview from './AiOverview';

/**
 * OSIRIS — News Chat Panel
 *
 * Two AI engines, kept deliberately separate:
 *  - The summary at the top reuses <AiOverview mode="alerts">, the existing
 *    Gemini-powered read-out already used by the Alerts and Markets panels —
 *    same endpoint, same fallback behaviour, nothing new to maintain there.
 *  - The chat below it calls /api/ai/news-chat, backed by Cloudflare
 *    Workers AI, scoped server-side to the live news feed only.
 *
 * Dark, minimal, conversational — message bubbles over a flat terminal
 * background rather than the instrument-panel chrome used elsewhere, closer
 * to a focused chat surface than a data readout.
 */

interface NewsChatPanelProps {
  data: any;
  isMobile?: boolean;
  onClose?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

export default function NewsChatPanel({ data, isMobile = false, onClose }: NewsChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const news = Array.isArray(data?.news) ? data.news : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/news-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          news,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.code === 'NOT_CONFIGURED'
          ? 'News chat isn\u2019t set up on this deployment yet.'
          : json?.error || 'Something went wrong.';
        setMessages(m => [...m, { role: 'assistant', content: msg, error: true }]);
        return;
      }
      setMessages(m => [...m, { role: 'assistant', content: json.reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Could not reach the news chat service. Try again.', error: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, news]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`glass-panel flex flex-col pointer-events-auto overflow-hidden ${isMobile ? 'h-full' : 'h-[560px] max-h-[75vh]'}`}>
      {/* Brand — Athens logo, centered */}
      <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
        <img src="/athens-logo-white.png" alt="Athens" className="h-5 w-auto opacity-90" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-primary)] bg-black/30 shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-[var(--text-primary)] uppercase">News Chat</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-osiris-pulse" />
          <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)]">{news.length} LIVE</span>
        </div>
      </div>

      {/* Summary — Gemini, same component the Alerts panel already uses */}
      <div className="px-3 pt-3 shrink-0">
        <AiOverview mode="alerts" payload={{ news }} accent="#00E5FF" signature={String(news.length)} />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 px-3 mt-3 mb-1 shrink-0">
        <div className="h-px flex-1 bg-[var(--border-primary)]" />
        <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)]">ASK ABOUT THE NEWS</span>
        <div className="h-px flex-1 bg-[var(--border-primary)]" />
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 gap-2">
            <Sparkles className="w-5 h-5 text-[var(--text-muted)] opacity-40" />
            <p className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
              Ask about today's headlines — what's developing, who's reporting what, how a story is being covered.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[var(--cyan-primary)]/10 border border-[var(--cyan-primary)]/25 text-[var(--text-primary)]'
                  : m.error
                    ? 'bg-[var(--alert-red)]/10 border border-[var(--alert-red)]/30 text-[var(--alert-red)]'
                    : 'bg-white/[0.03] border border-white/5 text-[var(--text-secondary)]'
              }`}
            >
              {m.error && <AlertCircle className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-white/[0.03] border border-white/5 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
              <span className="text-[10px] font-mono text-[var(--text-muted)]">thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--border-primary)] bg-black/30 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the news…"
            rows={1}
            className="flex-1 resize-none bg-white/[0.04] border border-white/10 rounded-md px-2.5 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--cyan-primary)]/50 max-h-24 styled-scrollbar font-sans"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[var(--cyan-primary)]/15 border border-[var(--cyan-primary)]/30 hover:bg-[var(--cyan-primary)]/25"
            title="Send"
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          </button>
        </div>
        <div className="mt-1.5 text-[8px] font-mono text-[var(--text-muted)] tracking-wide opacity-60">
          Scoped to the live news feed · Powered by Cloudflare Workers AI
        </div>
      </div>
    </div>
  );
}
