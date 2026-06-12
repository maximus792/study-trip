"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { PostProposal, PostDraft, InterviewQuestion, PipelineStep } from "@/types";
import LinkedInPreview from "@/components/preview/LinkedInPreview";
import StepProgress from "@/components/create/StepProgress";
import InterviewCard from "@/components/create/InterviewCard";
import PipelineViz from "@/components/pipeline/PipelineViz";
import Logo3Doshas from "@/components/brand/Logo3Doshas";

type Tab = "auto" | "manual";
type ManualStep = "idea" | "interview" | "review" | "result";

interface AgentLog { agent: string; tokensUsed: number; timestamp: string; }

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("auto");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [proposals, setProposals] = useState<PostProposal[]>([]);
  const [drafts, setDrafts] = useState<Map<string, PostDraft>>(new Map());
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);

  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [manualStep, setManualStep] = useState<ManualStep>("idea");
  const [manualDraft, setManualDraft] = useState<PostDraft | null>(null);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [rewriteFeedback, setRewriteFeedback] = useState("");
  const [rewriting, setRewriting] = useState(false);

  const [pipeSteps, setPipeSteps] = useState<PipelineStep[]>([]);
  const [pipeStart, setPipeStart] = useState<number | null>(null);
  const [pipeElapsed, setPipeElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pipeStart) {
      timerRef.current = setInterval(() => setPipeElapsed(Date.now() - pipeStart), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pipeStart]);

  function addLog(agent: string, tokensUsed: number) {
    setAgentLogs((prev) => [...prev, { agent, tokensUsed, timestamp: new Date().toLocaleTimeString() }]);
  }

  function cancelLoading() {
    abortController?.abort();
    setAbortController(null);
    setLoading(false);
    setStatusMsg("");
    setPipeStart(null);
    setPipeSteps([]);
  }

  async function runAutoFlow() {
    setLoading(true);
    setError(null);
    setStatusMsg("Starting pipeline...");
    const ac = new AbortController();
    setAbortController(ac);
    setPipeSteps([
      { id: "research", label: "Research", status: "pending", logs: [] },
      { id: "ideate", label: "Ideate", status: "pending", logs: [] },
      { id: "review", label: "Review", status: "pending", logs: [] },
      { id: "write", label: "Write", status: "pending", logs: [] },
      { id: "visual", label: "Visual", status: "pending", logs: [] },
    ]);
    setPipeStart(Date.now());
    setPipeElapsed(0);

    try {
      const res = await fetch("/api/cron", { signal: ac.signal });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const block of chunks) {
          const m = block.match(new RegExp("^event: (\\w+)\\ndata: (.+)$", "s"));
          if (!m) continue;
          const [, ev, raw] = m;
          const d = JSON.parse(raw);
          if (ev === "status") {
            setStatusMsg(d.message);
            if (d.step && d.status) {
              setPipeSteps(prev => prev.map(s =>
                s.id === d.step ? { ...s, status: d.status, tokensUsed: d.tokensUsed ?? s.tokensUsed } : s
              ));
            }
          }
          if (ev === "result") {
            setProposals(d.proposals);
            addLog("Researcher + Ideator", d.tokensUsed);
          }
          if (ev === "draft") {
            setDrafts(prev => {
              const next = new Map(prev);
              next.set(d.proposalId, d.draft);
              return next;
            });
            if (!selectedDraft) setSelectedDraft(d.proposalId);
            addLog("Copywriter + Visual", d.tokensUsed);
          }
          if (ev === "log" && d.step && d.text) {
            setPipeSteps(prev => prev.map(s =>
              s.id === d.step ? { ...s, logs: [...s.logs, d.text] } : s
            ));
          }
          if (ev === "error") setError(d.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
      setStatusMsg("");
      setAbortController(null);
      setPipeStart(null);
    }
  }

  async function startInterview() {
    if (!idea.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "interview", idea }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuestions(data.data.questions);
      setManualStep("interview");
      addLog("Interviewer", data.tokensUsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    setLoading(true);
    setManualStep("review");
    try {
      const briefRes = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "brief", idea, answers: { topic: idea, answers } }),
      });
      if (!briefRes.ok) throw new Error(await briefRes.text());
      const briefData = await briefRes.json();
      addLog("Interviewer (brief)", briefData.tokensUsed);

      const writeRes = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "write", proposal: briefData.data }),
      });
      if (!writeRes.ok) throw new Error(await writeRes.text());
      const writeData = await writeRes.json();
      setManualDraft(writeData.draft);
      setManualStep("result");
      addLog("Copywriter + Visual", writeData.tokensUsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      addLog("Copywriter (failed)", 0);
      setManualStep("interview");
    } finally {
      setLoading(false);
    }
  }

  async function rewriteCurrentDraft() {
    const draft = tab === "manual" ? manualDraft : selectedDraft ? drafts.get(selectedDraft) : null;
    if (!draft || !rewriteFeedback.trim()) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rewrite", draft, feedback: rewriteFeedback }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { draft: newDraft } = await res.json();
      if (tab === "manual") setManualDraft(newDraft);
      else if (selectedDraft) setDrafts((prev) => new Map(prev).set(selectedDraft, newDraft));
      setRewriteFeedback("");
      addLog("Copywriter (rewrite)", 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }

  function friendlyError(msg: string): string {
    try {
      const outer = JSON.parse(msg);
      const inner = typeof outer?.error === "string" ? outer.error : msg;
      const match = inner.match(/"message":"([^"]+)"/);
      return match ? match[1] : inner.replace(/Schema validation failed:\s*/, "").replace(/\[.*\]/, "").trim() || msg;
    } catch {
      return msg;
    }
  }

  const activeDraft = tab === "manual" ? manualDraft : selectedDraft ? drafts.get(selectedDraft) ?? null : null;
  const manualStepIndex = ["idea", "interview", "review", "result"].indexOf(manualStep);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header className="relative border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 0%, var(--accent-orange) 50%, transparent 100%)", opacity: 0.4 }} />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Logo3Doshas size={36} />

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg p-1" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
              {(["auto", "manual"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200"
                  style={tab === t ? {
                    background: "linear-gradient(135deg, var(--accent-orange), #E86520)",
                    color: "white",
                    boxShadow: "0 2px 8px rgba(255,119,51,0.25)"
                  } : {
                    color: "var(--text-muted)",
                  }}>
                  {t === "auto" ? "Pipeline" : "Guided"}
                </button>
              ))}
              <Link href="/knowledge"
                className="rounded px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-300 transition-all duration-150">
                Knowledge
              </Link>
            </div>

            <button onClick={() => setShowLogs(!showLogs)}
              className="relative rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={{
                background: showLogs ? "var(--bg-elevated)" : "var(--bg-base)",
                border: `1px solid ${showLogs ? "var(--border-medium)" : "var(--border-subtle)"}`,
                color: showLogs ? "var(--text-primary)" : "var(--text-muted)",
              }}>
              Activity
              {agentLogs.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "var(--accent-orange)" }}>
                  {agentLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-xl p-4 animate-fade-in-up"
            style={{ background: "rgba(229,91,91,0.06)", border: "1px solid rgba(229,91,91,0.15)" }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "rgba(229,91,91,0.12)", color: "var(--error)" }}>!</span>
            <span className="text-sm flex-1" style={{ color: "var(--text-secondary)" }}>{friendlyError(error)}</span>
            <button onClick={() => setError(null)} className="rounded p-1 transition-colors text-sm" style={{ color: "var(--text-muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* Agent Activity Log */}
        {showLogs && agentLogs.length > 0 && (
          <div className="mb-4 rounded-xl p-5 animate-fade-in-up"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bronze)" }}>Agent Activity</h3>
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                {agentLogs.reduce((s, l) => s + l.tokensUsed, 0).toLocaleString()} total tokens
              </span>
            </div>
            <div className="space-y-1.5">
              {agentLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs"
                  style={{ background: "var(--bg-surface)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-orange)" }} />
                    <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{log.agent}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono" style={{ color: "var(--text-muted)" }}>
                    {log.tokensUsed > 0 && <span>{log.tokensUsed.toLocaleString()} tok</span>}
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${activeDraft ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* LEFT PANEL */}
          <div>
            {tab === "auto" && (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                      Content Pipeline
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Research, ideate, and craft LinkedIn content in Sumeet&apos;s authentic voice
                    </p>
                  </div>
                  {loading ? (
                    <button onClick={cancelLoading}
                      className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200"
                      style={{ background: "var(--bg-surface)", border: "1px solid rgba(229,91,91,0.3)", color: "var(--error)" }}>
                      Cancel
                    </button>
                  ) : (
                    <button onClick={runAutoFlow} className="btn-primary rounded-lg px-6 py-2.5 text-sm">
                      Generate Content
                    </button>
                  )}
                </div>

                {/* Pipeline Viz */}
                {pipeSteps.length > 0 && (loading || pipeSteps.some(s => s.status !== "pending")) && (
                  <div className="mb-5"><PipelineViz steps={pipeSteps} elapsed={pipeElapsed} /></div>
                )}

                {/* Empty state */}
                {proposals.length === 0 && !loading && pipeSteps.length === 0 && (
                  <div className="rounded-xl p-16 text-center bg-dots"
                    style={{ border: "1px dashed var(--border-medium)", background: "var(--bg-card)" }}>
                    <div className="mx-auto mb-6 flex items-center justify-center">
                      <svg width="56" height="56" viewBox="0 0 200 200" fill="none" className="opacity-20">
                        <circle cx="100" cy="100" r="90" stroke="#D4956B" strokeWidth="3" />
                        <polygon points="100,26 58,98 142,98" fill="#D4956B" />
                        <polygon points="58,106 16,178 100,178" fill="#D4956B" />
                        <polygon points="142,106 100,178 184,178" fill="#D4956B" />
                        <circle cx="100" cy="128" r="8" fill="#D4956B" />
                      </svg>
                    </div>
                    <p className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Ready to amplify your voice
                    </p>
                    <p className="text-[13px] max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                      Hit &ldquo;Generate Content&rdquo; to research trending topics and craft LinkedIn posts aligned with the 3Doshas brand
                    </p>
                  </div>
                )}

                {/* Proposal cards */}
                {proposals.length > 0 && (
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--accent-bronze)" }}>Proposals</span>
                    <span className="font-mono text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {proposals.length} proposals{drafts.size > 0 && <> · {drafts.size} drafted</>}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2.5">
                  {proposals.map((p, idx) => (
                    <div key={p.id}
                      className={`group overflow-hidden rounded-xl transition-all duration-200 animate-fade-in-up cursor-pointer ${
                        selectedDraft === p.id ? "card-selected" : ""
                      }`}
                      style={{
                        background: selectedDraft === p.id ? "var(--bg-surface)" : "var(--bg-card)",
                        border: selectedDraft === p.id ? undefined : "1px solid var(--border-subtle)",
                        animationDelay: `${idx * 75}ms`,
                      }}
                      onClick={() => drafts.has(p.id) && setSelectedDraft(p.id)}>
                      <div className="grid" style={{ gridTemplateColumns: "52px 1fr auto" }}>
                        <div className="flex items-start pt-[26px] pl-[18px] font-mono text-[28px] font-medium leading-none"
                          style={{ color: selectedDraft === p.id ? "var(--accent-orange)" : "var(--text-faint)" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </div>

                        <div className="min-w-0 border-l px-5 py-[22px]"
                          style={{ borderColor: selectedDraft === p.id ? "var(--accent-orange)" : "var(--border-subtle)" }}>
                          <span className="mb-2.5 inline-block rounded-md px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{ background: "var(--bg-elevated)", color: "var(--accent-bronze)" }}>
                            {p.postType}
                          </span>
                          <h4 className="mb-1.5 text-[15px] font-semibold leading-[1.45] tracking-tight transition-colors"
                            style={{ color: "var(--text-primary)" }}>
                            {p.topic}
                          </h4>
                          <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
                            {p.hook}
                          </p>
                        </div>

                        <div className="flex min-w-[96px] flex-col items-center justify-between border-l px-[18px] py-[22px]"
                          style={{ borderColor: "var(--border-subtle)" }}>
                          <span className="vertical-text flex-1 flex items-center font-mono text-[8.5px] uppercase tracking-[0.08em]"
                            style={{ color: "var(--text-muted)" }}>
                            {p.contentPillar}
                          </span>
                          {!drafts.has(p.id) ? (
                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em]"
                              style={{ color: "var(--accent-orange)" }}>
                              <div className="h-[7px] w-[7px] rounded-full border border-current border-t-transparent animate-spin" />
                              Writing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em]"
                              style={{ color: "var(--success)" }}>
                              <span className="h-[5px] w-[5px] rounded-full bg-current" />
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "manual" && (
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                  Craft Your Message
                </h2>
                <StepProgress steps={["Idea", "Questions", "Writing", "Result"]} current={manualStepIndex} />

                {manualStep === "idea" && (
                  <div>
                    <textarea value={idea} onChange={(e) => setIdea(e.target.value)}
                      placeholder="What would you like to share? A leadership insight, a career lesson, a client success story..."
                      className="input-field mb-3 w-full rounded-xl p-4 text-sm resize-none" rows={4} />
                    <button onClick={startInterview} disabled={loading || !idea.trim()}
                      className="btn-primary rounded-lg px-6 py-2.5 text-sm">
                      {loading ? "Thinking..." : "Next"}
                    </button>
                  </div>
                )}

                {manualStep === "interview" && (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--accent-bronze)" }}>Interview Questions</span>
                      <span className="font-mono text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>
                        {Object.values(answers).filter(a => a.trim()).length}/{questions.length} answered
                        {" · "}
                        {questions.filter(q => q.required).length} required
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {questions.map((q, i) => (
                        <InterviewCard
                          key={i}
                          question={q}
                          index={i}
                          total={questions.length}
                          value={answers[q.question] || ""}
                          onChange={(val) => setAnswers((prev) => ({ ...prev, [q.question]: val }))}
                          focused={focusedIndex === i}
                          onFocus={() => setFocusedIndex(i)}
                          onBlur={() => setFocusedIndex(null)}
                          disabled={loading}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 mt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      <button onClick={() => setManualStep("idea")}
                        className="btn-secondary rounded-lg px-4 py-2 text-sm">
                        Back
                      </button>
                      <button onClick={submitAnswers}
                        disabled={loading || questions.filter(q => q.required).some(q => !answers[q.question]?.trim())}
                        className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold">
                        {loading ? "Generating..." : "Generate Post"}
                      </button>
                    </div>
                  </div>
                )}

                {manualStep === "review" && (
                  <div className="text-center py-16 animate-fade-in-up">
                    <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-t-transparent"
                      style={{ borderColor: "var(--accent-orange)", borderTopColor: "transparent" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Crafting your message in Sumeet&apos;s voice...</p>
                  </div>
                )}

                {manualStep === "result" && !manualDraft && (
                  <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Something went wrong. Try again.</div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Preview + Edit */}
          {activeDraft && (
            <div className="sticky top-6 flex flex-col animate-fade-in-up max-h-[calc(100vh-3rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bronze)" }}>
                  LinkedIn Preview
                </h3>
                <button onClick={() => navigator.clipboard.writeText(activeDraft.content + "\n\n" + activeDraft.hashtags.join(" "))}
                  className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
                  Copy Post
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto mb-4 flex flex-col">
                <div className="flex-1">
                  <LinkedInPreview content={activeDraft.content} hashtags={activeDraft.hashtags} />
                </div>
              </div>

              <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--accent-bronze)" }}>Refine</h4>
                <textarea value={rewriteFeedback} onChange={(e) => setRewriteFeedback(e.target.value)}
                  placeholder="e.g. 'make the hook more personal', 'shorten to under 2500 chars', 'mention the SJSU workshop'..."
                  className="input-field w-full rounded-lg p-3 text-sm mb-3 resize-none" rows={2} />
                <button onClick={rewriteCurrentDraft} disabled={rewriting || !rewriteFeedback.trim()}
                  className="btn-primary rounded-lg px-5 py-2 text-xs font-semibold">
                  {rewriting ? "Refining..." : "Refine Post"}
                </button>
                {tab === "manual" && manualStep === "result" && (
                  <button onClick={() => { setManualStep("idea"); setManualDraft(null); setIdea(""); setQuestions([]); setAnswers({}); }}
                    className="btn-secondary mt-3 rounded-lg px-4 py-2 text-sm w-full">
                    New Message
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
