"use client";

import Link from "next/link";
import Logo3Doshas from "@/components/brand/Logo3Doshas";

type Tab = "auto" | "manual" | "knowledge";

const ACTIVE_STYLE = {
  background: "linear-gradient(135deg, var(--accent-orange), #E86520)",
  color: "white",
  boxShadow: "0 2px 8px rgba(255,119,51,0.25)",
} as const;

const INACTIVE_STYLE = {
  color: "var(--text-muted)",
} as const;

interface NavbarProps {
  activeTab: Tab;
  onTabChange?: (tab: "auto" | "manual") => void;
  rightContent?: React.ReactNode;
}

export default function Navbar({ activeTab, onTabChange, rightContent }: NavbarProps) {
  return (
    <header className="relative border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 0%, var(--accent-orange) 50%, transparent 100%)", opacity: 0.4 }} />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Logo3Doshas size={36} />

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg p-1" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
            {activeTab === "knowledge" ? (
              <Link href="/?tab=auto"
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={INACTIVE_STYLE}>
                Pipeline
              </Link>
            ) : (
              <button
                onClick={() => onTabChange?.("auto")}
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={activeTab === "auto" ? ACTIVE_STYLE : INACTIVE_STYLE}>
                Pipeline
              </button>
            )}

            {activeTab === "knowledge" ? (
              <Link href="/?tab=manual"
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={INACTIVE_STYLE}>
                Guided
              </Link>
            ) : (
              <button
                onClick={() => onTabChange?.("manual")}
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={activeTab === "manual" ? ACTIVE_STYLE : INACTIVE_STYLE}>
                Guided
              </button>
            )}

            {activeTab === "knowledge" ? (
              <span
                className="rounded-md px-4 py-1.5 text-sm font-medium"
                style={ACTIVE_STYLE}>
                Knowledge
              </span>
            ) : (
              <Link href="/knowledge"
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                style={INACTIVE_STYLE}>
                Knowledge
              </Link>
            )}
          </div>

          {rightContent}
        </div>
      </div>
    </header>
  );
}
