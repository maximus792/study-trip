"use client";

import type { InterviewQuestion } from "@/types";

interface InterviewCardProps {
  question: InterviewQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  disabled?: boolean;
}

export default function InterviewCard({
  question,
  index,
  total,
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
  disabled,
}: InterviewCardProps) {
  const hasAnswer = value.trim().length > 0;
  const questionId = `question-${index}`;

  return (
    <div
      className={`group overflow-hidden rounded border transition-all duration-200 animate-fade-in-up ${
        focused
          ? "border-gray-600 bg-[#0f0f0f]"
          : "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#0e0e0e]"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
      role="group"
      aria-labelledby={`${questionId}-label`}
    >
      <div className="grid" style={{ gridTemplateColumns: "52px 1fr 64px" }}>
        <div
          className={`flex items-start pt-[22px] pl-[14px] font-mono text-[28px] font-medium leading-none transition-colors duration-200 ${
            focused ? "text-gray-600" : "text-[#1e1e1e]"
          }`}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        <div
          className={`min-w-0 border-l px-5 py-[18px] transition-colors duration-200 ${
            focused ? "border-gray-400" : "border-[#1a1a1a]"
          }`}
        >
          <span
            className={`mb-2 inline-block px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] ${
              question.required
                ? "bg-[#161616] text-gray-400"
                : "bg-transparent text-gray-700"
            }`}
          >
            {question.required ? "Required" : "Optional"}
          </span>

          <p
            id={`${questionId}-label`}
            className="mb-1 text-[14px] font-medium leading-[1.5] tracking-tight text-gray-300 group-hover:text-gray-200 transition-colors"
          >
            <span className="sr-only">Question {index + 1} of {total}{question.required ? ", required" : ", optional"}: </span>
            {question.question}
          </p>

          <p className="mb-3 text-[11px] leading-relaxed text-gray-500 italic">
            {question.purpose}
          </p>

          <textarea
            id={questionId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={disabled}
            placeholder="2-3 sentences — think specific moments, not general themes"
            rows={focused || hasAnswer ? 3 : 2}
            aria-required={question.required}
            className={`w-full rounded border bg-[#111] p-3 text-[13px] leading-relaxed text-gray-200 placeholder-gray-700 transition-all duration-200 focus:outline-none resize-none ${
              focused
                ? "border-gray-500 bg-[#0f0f0f]"
                : "border-[#1a1a1a] hover:border-[#222]"
            }`}
          />
        </div>

        <div className="flex flex-col items-center justify-between border-l border-[#1a1a1a] px-3 py-[18px]">
          <span className="vertical-text flex-1 flex items-center font-mono text-[8.5px] uppercase tracking-[0.08em] text-gray-700">
            Q{String(index + 1).padStart(2, "0")}
          </span>

          {hasAnswer ? (
            <span className="h-[5px] w-[5px] rounded-full bg-emerald-600" />
          ) : question.required ? (
            <span className="h-[5px] w-[5px] rounded-full border border-gray-600" />
          ) : (
            <span className="h-[5px] w-[5px] rounded-full border border-[#1e1e1e]" />
          )}
        </div>
      </div>
    </div>
  );
}
