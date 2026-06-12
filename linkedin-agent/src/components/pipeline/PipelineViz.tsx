"use client";

import { useState } from "react";
import type { PipelineStep } from "@/types";

interface Props {
  steps: PipelineStep[];
  elapsed: number;
}

export default function PipelineViz({ steps, elapsed }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
  const totalTok = steps.reduce((s, x) => s + (x.tokensUsed ?? 0), 0);

  return (
    <div className="rounded-xl p-5 animate-fade-in-up"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bronze)" }}>Pipeline</span>
        <div className="flex items-center gap-4 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span>{fmt(elapsed)}</span>
          {totalTok > 0 && <span>{totalTok.toLocaleString()} tokens</span>}
        </div>
      </div>

      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 min-w-[72px]">
              <button
                onClick={() => step.logs.length > 0 && setExpandedStep(expandedStep === step.id ? null : step.id)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  step.logs.length > 0 ? "cursor-pointer" : "cursor-default"
                }`}
                style={
                  step.status === "done"    ? { borderColor: "var(--accent-orange)", background: "var(--accent-orange-glow)" } :
                  step.status === "active"  ? { borderColor: "var(--accent-orange)", background: "rgba(255,119,51,0.05)" } :
                  step.status === "waiting" ? { borderColor: "var(--accent-bronze)", background: "rgba(212,149,107,0.05)" } :
                  step.status === "error"   ? { borderColor: "var(--error)", background: "rgba(229,91,91,0.05)" } :
                                              { borderColor: "var(--text-faint)", background: "var(--bg-surface)" }
                }
              >
                {step.status === "done" && (
                  <svg className="h-4 w-4" style={{ color: "var(--accent-orange)" }} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                  </svg>
                )}
                {step.status === "active" && (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--accent-orange)", borderTopColor: "transparent" }} />
                )}
                {step.status === "waiting" && (
                  <svg className="h-4 w-4" style={{ color: "var(--accent-bronze)" }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
                  </svg>
                )}
                {step.status === "error" && <span style={{ color: "var(--error)" }} className="text-sm font-bold">!</span>}
                {step.status === "pending" && <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{i + 1}</span>}
                {step.logs.length > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-medium)", color: "var(--text-muted)" }}>
                    {step.logs.length}
                  </span>
                )}
              </button>

              <span className="text-[11px] font-medium" style={{
                color:
                  step.status === "done"    ? "var(--accent-bronze)" :
                  step.status === "active"  ? "var(--text-primary)" :
                  step.status === "waiting" ? "var(--text-primary)" :
                  step.status === "error"   ? "var(--error)" :
                                              "var(--text-muted)"
              }}>{step.label}</span>

              {step.status === "done" && step.tokensUsed != null && (
                <span className="text-[9px] font-mono -mt-1" style={{ color: "var(--text-muted)" }}>
                  {step.tokensUsed.toLocaleString()} tok
                </span>
              )}
            </div>

            {i < steps.length - 1 && (
              <div className="flex-1 mx-1.5 h-px mt-5 rounded-full overflow-hidden"
                style={{ background: "var(--border-subtle)" }}>
                <div className={`h-full rounded-full transition-all duration-700 ${
                  step.status === "active" ? "animate-shimmer" : ""
                }`} style={{
                  width:
                    step.status === "done" || step.status === "waiting" ? "100%" :
                    step.status === "active" ? "50%" : "0%",
                  background:
                    step.status === "done" || step.status === "waiting"
                      ? "var(--accent-orange)"
                      : step.status === "active"
                        ? "linear-gradient(90deg, var(--accent-orange), var(--accent-bronze), var(--accent-orange))"
                        : "transparent",
                  backgroundSize: step.status === "active" ? "200% 100%" : undefined,
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {expandedStep && (() => {
        const step = steps.find(s => s.id === expandedStep);
        if (!step || step.logs.length === 0) return null;
        return (
          <div className="mt-4 rounded-lg p-3 animate-fade-in-up"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-bronze)" }}>
                {step.label} Logs
              </span>
              <button onClick={() => setExpandedStep(null)} className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}>
                Close
              </button>
            </div>
            <div className="space-y-1">
              {step.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className="shrink-0 select-none" style={{ color: "var(--text-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: "var(--text-muted)" }}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
