"use client";

import { useState, useEffect, useRef } from "react";
import type { PostProposal, PostDraft, InterviewQuestion, PipelineStep } from "@/types";
import LinkedInPreview from "@/components/preview/LinkedInPreview";
import StepProgress from "@/components/create/StepProgress";
import InterviewCard from "@/components/create/InterviewCard";
import PipelineViz from "@/components/pipeline/PipelineViz";

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

  // Pipeline viz state
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
    <main className="min-h-screen bg-[#09090b] text-gray-200">
      {/* Header */}
      <header className="border-b border-[#1a1a1a]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white text-sm font-black text-black">3D</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white">3Doshas</span>
                <span className="ml-1.5 text-gray-500">LinkedIn Agent</span>
              </h1>
              <p className="text-[11px] text-gray-600 -mt-0.5">Content pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded bg-[#111] p-1 border border-[#1a1a1a]">
              {(["auto", "manual"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                    tab === t ? "bg-white text-black" : "text-gray-500 hover:text-gray-300"
                  }`}>
                  {t === "auto" ? "Auto Flow" : "Manual Flow"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLogs(!showLogs)}
              className={`relative rounded border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                showLogs ? "border-gray-500 bg-[#111] text-gray-300" : "border-[#1a1a1a] bg-[#111] text-gray-500 hover:border-[#333]"
              }`}>
              Agent Log
              {agentLogs.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                  {agentLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded border border-[#1a1a1a] bg-[#111] p-4 animate-fade-in-up">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-red-500/10 text-red-400 text-xs font-bold">!</span>
            <span className="text-sm text-gray-300 flex-1">{friendlyError(error)}</span>
            <button onClick={() => setError(null)} className="rounded p-1 text-gray-600 hover:text-gray-400 transition-colors text-sm">✕</button>
          </div>
        )}

        {/* Agent Log */}
        {showLogs && agentLogs.length > 0 && (
          <div className="mb-4 rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-600">Agent Activity</h3>
              <span className="text-[10px] font-mono text-gray-700">{agentLogs.reduce((s, l) => s + l.tokensUsed, 0).toLocaleString()} total tokens</span>
            </div>
            <div className="space-y-1">
              {agentLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-[#111] px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                    <span className="font-medium text-gray-400">{log.agent}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 font-mono">
                    {log.tokensUsed > 0 && <span>{log.tokensUsed.toLocaleString()} tok</span>}
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${activeDraft ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* LEFT */}
          <div>
            {tab === "auto" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Automated Pipeline</h2>
                    <p className="text-xs text-gray-500">Research topics, generate proposals, write posts</p>
                  </div>
                  {loading ? (
                    <button onClick={cancelLoading} className="rounded bg-[#111] border border-[#333] px-5 py-2 text-sm font-medium text-red-400 hover:border-red-400/50 transition-colors">Cancel</button>
                  ) : (
                    <button onClick={runAutoFlow} className="rounded bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200 transition-colors">Run Pipeline</button>
                  )}
                </div>

                {/* Pipeline Viz */}
                {pipeSteps.length > 0 && (loading || pipeSteps.some(s => s.status !== "pending")) && (
                  <div className="mb-4"><PipelineViz steps={pipeSteps} elapsed={pipeElapsed} /></div>
                )}

                {/* Empty state */}
                {proposals.length === 0 && !loading && pipeSteps.length === 0 && (
                  <div className="rounded border border-dashed border-[#1a1a1a] p-16 text-center">
                    <div className="mx-auto mb-4 font-mono text-4xl text-[#1a1a1a]">—</div>
                    <p className="text-sm font-medium text-gray-500 mb-1">No proposals yet</p>
                    <p className="text-xs text-gray-700">Click &ldquo;Run Pipeline&rdquo; to research topics and generate post proposals</p>
                  </div>
                )}

                {/* Proposal cards */}
                {proposals.length > 0 && (
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-gray-500">Proposals</span>
                    <span className="font-mono text-[10px] text-gray-600 tracking-wide">
                      {proposals.length} proposals{drafts.size > 0 && <> · {drafts.size} drafted</>}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {proposals.map((p, idx) => (
                    <div key={p.id}
                      className={`group overflow-hidden rounded border transition-colors duration-150 animate-fade-in-up cursor-pointer ${
                        selectedDraft === p.id
                          ? "border-gray-700 bg-[#0f0f0f]"
                          : "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#0e0e0e]"
                      }`}
                      style={{ animationDelay: `${idx * 75}ms` }}
                      onClick={() => drafts.has(p.id) && setSelectedDraft(p.id)}>
                      <div className="grid" style={{ gridTemplateColumns: "52px 1fr auto" }}>
                        {/* Index number */}
                        <div className={`flex items-start pt-[26px] pl-[18px] font-mono text-[28px] font-medium leading-none ${
                          selectedDraft === p.id ? "text-gray-700" : "text-[#1e1e1e]"
                        }`}>
                          {String(idx + 1).padStart(2, "0")}
                        </div>

                        {/* Body */}
                        <div className={`min-w-0 border-l px-5 py-[22px] ${
                          selectedDraft === p.id ? "border-gray-300" : "border-[#1a1a1a]"
                        }`}>
                          <span className="mb-2.5 inline-block bg-[#161616] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                            {p.postType}
                          </span>
                          <h4 className="mb-1.5 text-[15px] font-semibold leading-[1.45] tracking-tight text-gray-300 group-hover:text-gray-200 transition-colors">
                            {p.topic}
                          </h4>
                          <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-2">
                            {p.hook}
                          </p>
                        </div>

                        {/* Side panel */}
                        <div className="flex min-w-[96px] flex-col items-center justify-between border-l border-[#1a1a1a] px-[18px] py-[22px]">
                          <span className="vertical-text flex-1 flex items-center font-mono text-[8.5px] uppercase tracking-[0.08em] text-gray-700">
                            {p.contentPillar}
                          </span>
                          {!drafts.has(p.id) ? (
                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-amber-500">
                              <div className="h-[7px] w-[7px] rounded-full border border-amber-500 border-t-transparent animate-spin" />
                              Writing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-gray-500">
                              <span className="h-[5px] w-[5px] rounded-full bg-emerald-600" />
                              Draft ready
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
                <h2 className="text-lg font-semibold mb-1">Create a Post</h2>
                <StepProgress steps={["Idea", "Questions", "Writing", "Result"]} current={manualStepIndex} />

                {manualStep === "idea" && (
                  <div>
                    <textarea value={idea} onChange={(e) => setIdea(e.target.value)}
                      placeholder="What do you want to post about? A recent event, a teaching moment, a reflection..."
                      className="mb-3 w-full rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-sm text-gray-200 placeholder-gray-600 focus:border-[#333] focus:outline-none transition-colors" rows={4} />
                    <button onClick={startInterview} disabled={loading || !idea.trim()}
                      className="rounded bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40 transition-colors">
                      {loading ? "Thinking..." : "Next"}
                    </button>
                  </div>
                )}

                {manualStep === "interview" && (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-[13px] font-semibold text-gray-500">Interview Questions</span>
                      <span className="font-mono text-[10px] text-gray-600 tracking-wide">
                        {Object.values(answers).filter(a => a.trim()).length}/{questions.length} answered
                        {" · "}
                        {questions.filter(q => q.required).length} required
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
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
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#1a1a1a]">
                      <button onClick={() => setManualStep("idea")} className="rounded border border-[#1a1a1a] bg-[#111] px-4 py-2 text-sm text-gray-500 hover:border-[#333] hover:text-gray-400 transition-colors">Back</button>
                      <button onClick={submitAnswers} disabled={loading || questions.filter(q => q.required).some(q => !answers[q.question]?.trim())}
                        className="rounded bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40 transition-colors">
                        {loading ? "Generating..." : "Generate Post"}
                      </button>
                    </div>
                  </div>
                )}

                {manualStep === "review" && (
                  <div className="text-center py-16 animate-fade-in-up">
                    <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-gray-400 border-t-transparent" />
                    <p className="text-sm text-gray-500">Writing your post with Sumeet&apos;s voice...</p>
                  </div>
                )}

                {manualStep === "result" && !manualDraft && (
                  <div className="text-center py-16 text-gray-500 text-sm">Something went wrong. Try again.</div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Preview + Edit */}
          {activeDraft && (
            <div className="sticky top-6 flex flex-col animate-fade-in-up max-h-[calc(100vh-3rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-600">LinkedIn Preview</h3>
                <button onClick={() => navigator.clipboard.writeText(activeDraft.content + "\n\n" + activeDraft.hashtags.join(" "))}
                  className="rounded border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-400 hover:border-[#333] hover:text-gray-300 transition-colors">
                  Copy Post
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto mb-4 flex flex-col">
                <div className="flex-1">
                  <LinkedInPreview content={activeDraft.content} hashtags={activeDraft.hashtags} />
                </div>
              </div>

              <div className="shrink-0 rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">Rewrite</h4>
                <textarea value={rewriteFeedback} onChange={(e) => setRewriteFeedback(e.target.value)}
                  placeholder="e.g. 'make the hook more personal', 'shorten to under 2500 chars', 'mention the SJSU workshop'..."
                  className="w-full rounded border border-[#1a1a1a] bg-[#111] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-[#333] focus:outline-none mb-3 transition-colors" rows={2} />
                <button onClick={rewriteCurrentDraft} disabled={rewriting || !rewriteFeedback.trim()}
                  className="rounded bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200 disabled:opacity-40 transition-colors">
                  {rewriting ? "Rewriting..." : "Rewrite with Feedback"}
                </button>
                {tab === "manual" && manualStep === "result" && (
                  <button onClick={() => { setManualStep("idea"); setManualDraft(null); setIdea(""); setQuestions([]); setAnswers({}); }}
                    className="mt-3 rounded border border-[#1a1a1a] bg-[#111] px-4 py-2 text-sm text-gray-400 hover:border-[#333] w-full transition-colors">
                    Start New Post
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
