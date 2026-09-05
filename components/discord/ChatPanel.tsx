"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { initialFromName } from "@/lib/colors";
import { t } from "@/lib/i18n";

interface ChatPanelProps {
  roomName: string;
  messages: ChatMessage[];
  myId: string | null;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ChatPanel({
  roomName,
  messages,
  myId,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText("");
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-[#1f2023] bg-[#2b2d31] text-[#dbdee1] shadow-lg">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1f2023] px-4">
        <div className="flex items-center gap-2 truncate">
          <span className="text-lg font-bold text-[#80848e]">#</span>
          <h3 className="truncate text-[15px] font-semibold text-white">
            {roomName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
          title={t.close}
          aria-label={t.close}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[#949ba4]">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#1e1f22] text-2xl font-bold text-white">
              #
            </div>
            <p className="text-base font-semibold text-white">
              {t.chatTitle} #{roomName}
            </p>
            <p className="mt-1 text-xs text-[#949ba4]">{t.noMessages}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myId;
            return (
              <div key={msg.id} className="flex items-start gap-3 group">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                  style={{ backgroundColor: msg.senderColor }}
                >
                  {initialFromName(msg.senderName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-white">
                      {msg.senderName}
                      {isMe ? (
                        <span className="ml-1 text-[11px] font-normal text-[#949ba4]">
                          {t.you}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-[#949ba4]">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[14px] leading-relaxed text-[#dbdee1]">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input form */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-[#1f2023] bg-[#2b2d31] p-3"
      >
        <div className="flex items-center rounded-lg bg-[#383a40] px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#5865f2]">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.chatPlaceholder.replace("{room}", roomName)}
            className="w-full bg-transparent text-[14px] text-white placeholder-[#80848e] outline-none"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#b5bac1] transition hover:text-white disabled:opacity-30 disabled:hover:text-[#b5bac1]"
            title={t.send}
            aria-label={t.send}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}
