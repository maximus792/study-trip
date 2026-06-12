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
    <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">Pipeline</span>
        <div className="flex items-center gap-4 text-[11px] font-mono text-gray-700">
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
                } ${
                  step.status === "done"    ? "border-gray-500 bg-gray-500/10" :
                  step.status === "active"  ? "border-gray-400 bg-gray-400/5" :
                  step.status === "waiting" ? "border-gray-400 bg-gray-400/5" :
                  step.status === "error"   ? "border-red-500/50 bg-red-500/5" :
                                              "border-[#1e1e1e] bg-[#111]"
                }`}
              >
                {step.status === "done" && <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>}
                {step.status === "active" && <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />}
                {step.status === "waiting" && <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" /></svg>}
                {step.status === "error" && <span className="text-red-400 text-sm font-bold">!</span>}
                {step.status === "pending" && <span className="text-[11px] font-semibold text-gray-700">{i + 1}</span>}
                {step.logs.length > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#111] border border-[#333] text-[8px] font-bold text-gray-500">
                    {step.logs.length}
                  </span>
                )}
              </button>

              <span className={`text-[11px] font-medium ${
                step.status === "done"    ? "text-gray-400" :
                step.status === "active"  ? "text-gray-300" :
                step.status === "waiting" ? "text-gray-300" :
                step.status === "error"   ? "text-red-400" :
                                            "text-gray-700"
              }`}>{step.label}</span>

              {step.status === "done" && step.tokensUsed != null && (
                <span className="text-[9px] font-mono text-gray-700 -mt-1">{step.tokensUsed.toLocaleString()} tok</span>
              )}
            </div>

            {i < steps.length - 1 && (
              <div className="flex-1 mx-1.5 h-px mt-5 rounded-full bg-[#1a1a1a] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${
                  step.status === "done"    ? "w-full bg-gray-600" :
                  step.status === "waiting" ? "w-full bg-gray-600" :
                  step.status === "active"  ? "w-1/2 bg-gradient-to-r from-gray-500 via-gray-400 to-gray-500 animate-shimmer" :
                                              "w-0"
                }`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {expandedStep && (() => {
        const step = steps.find(s => s.id === expandedStep);
        if (!step || step.logs.length === 0) return null;
        return (
          <div className="mt-4 rounded border border-[#1a1a1a] bg-[#111] p-3 animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">{step.label} Logs</span>
              <button onClick={() => setExpandedStep(null)} className="text-gray-600 hover:text-gray-400 text-xs transition-colors">Close</button>
            </div>
            <div className="space-y-1">
              {step.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className="text-gray-700 shrink-0 select-none">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-gray-500">{log}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
