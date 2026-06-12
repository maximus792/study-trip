"use client";

import { useState } from "react";

interface LinkedInPreviewProps {
  content: string;
  hashtags: string[];
  authorName?: string;
  authorTitle?: string;
}

const FOLD_CHARS = 210;

export default function LinkedInPreview({
  content,
  hashtags,
  authorName = "Sumeet Syal",
  authorTitle = "Founder & CEO at 3Doshas | Executive Coach | Stanford & UC Berkeley-Haas",
}: LinkedInPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const fullText = content + "\n\n" + hashtags.join(" ");
  const needsFold = fullText.length > FOLD_CHARS;
  const displayText = expanded || !needsFold ? fullText : fullText.slice(0, FOLD_CHARS);
  const charCount = fullText.length;

  return (
    <div className="rounded-xl bg-white text-black overflow-hidden shadow-xl shadow-black/30 ring-1 ring-white/10 h-full flex flex-col">
      <div className="flex items-start gap-3 p-4 pb-2">
        <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-indigo-900 to-purple-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-900/30">
          SS
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">{authorName}</p>
          <p className="text-xs text-gray-500 leading-tight truncate">{authorTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">Now · 🌐</p>
        </div>
      </div>

      <div className="px-4 pb-3 flex-1">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {displayText}
          {needsFold && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-gray-500 hover:text-gray-700 hover:underline ml-1">
              ...see more
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>👍 ❤️ 💡 42</span>
        <span>5 comments · 2 reposts</span>
      </div>

      <div className="border-t border-gray-200 px-2 py-1 flex justify-around">
        {["👍 Like", "💬 Comment", "🔄 Repost", "📤 Send"].map((action) => (
          <button key={action} className="text-xs text-gray-600 px-3 py-2 rounded hover:bg-gray-100 font-medium">
            {action}
          </button>
        ))}
      </div>

      <div className={`px-4 py-2 text-xs text-right border-t border-gray-100 font-mono ${
        charCount > 3000 ? "text-red-500 font-semibold bg-red-50" :
        charCount > 2700 ? "text-amber-600 bg-amber-50" :
        "text-gray-400"
      }`}>
        {charCount.toLocaleString()} / 3,000
      </div>
    </div>
  );
}
