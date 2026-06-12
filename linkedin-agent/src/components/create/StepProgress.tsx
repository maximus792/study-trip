"use client";

interface StepProgressProps {
  steps: string[];
  current: number;
}

export default function StepProgress({ steps, current }: StepProgressProps) {
  return (
    <div className="rounded-xl px-5 py-4 mb-6"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent-bronze)" }}>
          Progress
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          Step {current + 1} of {steps.length}
        </span>
      </div>

      <div className="flex items-start">
        {steps.map((label, i) => (
          <div key={label} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500"
                style={
                  i < current
                    ? { borderColor: "var(--accent-orange)", background: "var(--accent-orange-glow)" }
                    : i === current
                      ? { borderColor: "var(--accent-orange)", background: "rgba(255,119,51,0.05)" }
                      : { borderColor: "var(--text-faint)", background: "var(--bg-surface)" }
                }
              >
                {i < current && (
                  <svg className="h-4 w-4" style={{ color: "var(--accent-orange)" }} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                {i === current && (
                  <span className="text-[11px] font-bold" style={{ color: "var(--accent-orange)" }}>{i + 1}</span>
                )}
                {i > current && (
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                )}
              </div>
              <span
                className="text-[11px] font-medium hidden sm:block"
                style={{
                  color: i < current
                    ? "var(--accent-bronze)"
                    : i === current
                      ? "var(--text-primary)"
                      : "var(--text-muted)"
                }}
              >
                {label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div className="flex-1 mx-1.5 h-px mt-5 rounded-full overflow-hidden"
                style={{ background: "var(--border-subtle)" }}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    i === current ? "animate-shimmer" : ""
                  }`}
                  style={{
                    width: i < current ? "100%" : i === current ? "50%" : "0%",
                    background: i < current
                      ? "var(--accent-orange)"
                      : i === current
                        ? "linear-gradient(90deg, var(--accent-orange), var(--accent-bronze), var(--accent-orange))"
                        : "transparent",
                    backgroundSize: i === current ? "200% 100%" : undefined,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
