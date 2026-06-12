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
      className={`group overflow-hidden rounded-xl transition-all duration-200 animate-fade-in-up ${
        focused ? "card-selected" : ""
      }`}
      style={{
        background: focused ? "var(--bg-surface)" : "var(--bg-card)",
        border: focused ? undefined : "1px solid var(--border-subtle)",
        animationDelay: `${index * 60}ms`,
      }}
      role="group"
      aria-labelledby={`${questionId}-label`}
    >
      <div className="grid" style={{ gridTemplateColumns: "52px 1fr 64px" }}>
        <div
          className="flex items-start pt-[22px] pl-[14px] font-mono text-[28px] font-medium leading-none transition-colors duration-200"
          style={{ color: focused ? "var(--accent-orange)" : "var(--text-faint)" }}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        <div
          className="min-w-0 border-l px-5 py-[18px] transition-colors duration-200"
          style={{ borderColor: focused ? "var(--accent-orange)" : "var(--border-subtle)" }}
        >
          <span
            className="mb-2 inline-block rounded-md px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={question.required
              ? { background: "var(--bg-elevated)", color: "var(--accent-bronze)" }
              : { background: "transparent", color: "var(--text-muted)" }
            }
          >
            {question.required ? "Required" : "Optional"}
          </span>

          <p
            id={`${questionId}-label`}
            className="mb-1 text-[14px] font-medium leading-[1.5] tracking-tight transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="sr-only">Question {index + 1} of {total}{question.required ? ", required" : ", optional"}: </span>
            {question.question}
          </p>

          <p className="mb-3 text-[11px] leading-relaxed italic" style={{ color: "var(--text-muted)" }}>
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
            className="input-field w-full rounded-lg p-3 text-[13px] leading-relaxed resize-none"
          />
        </div>

        <div className="flex flex-col items-center justify-between border-l px-3 py-[18px]"
          style={{ borderColor: "var(--border-subtle)" }}>
          <span className="vertical-text flex-1 flex items-center font-mono text-[8.5px] uppercase tracking-[0.08em]"
            style={{ color: "var(--text-muted)" }}>
            Q{String(index + 1).padStart(2, "0")}
          </span>

          {hasAnswer ? (
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--success)" }} />
          ) : question.required ? (
            <span className="h-[6px] w-[6px] rounded-full" style={{ border: "1.5px solid var(--accent-orange)" }} />
          ) : (
            <span className="h-[6px] w-[6px] rounded-full" style={{ border: "1.5px solid var(--text-faint)" }} />
          )}
        </div>
      </div>
    </div>
  );
}
