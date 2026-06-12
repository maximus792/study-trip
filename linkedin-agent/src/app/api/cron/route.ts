import { researchTrendingTopics, generatePostProposals, writePost, suggestVisuals } from "@/agents";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send("status", { step: "research", status: "active", message: "Researching trending topics..." });
        send("log", { step: "research", text: "Loading brand context from brand.md..." });
        send("log", { step: "research", text: "Sending prompt to claude-opus-4-6 via LiteLLM..." });

        const research = await researchTrendingTopics(undefined, (toolName, input, preview) => {
          const query = (input as Record<string, unknown>).query as string;
          const resultCount = (preview.match(/"url"/g) || []).length;
          send("log", { step: "research", text: `🔍 ${toolName}("${query}") → ${resultCount} results` });
        });
        send("log", { step: "research", text: `Found ${research.data.length} topics scored by relevance (${research.tokensUsed.toLocaleString()} tokens)` });
        const topTopics = research.data.slice(0, 3).map(t => `"${t.title}" (${t.relevanceScore}/10)`);
        send("log", { step: "research", text: `Top topics: ${topTopics.join(", ")}` });
        send("status", { step: "research", status: "done", tokensUsed: research.tokensUsed, message: "Research complete" });

        send("status", { step: "ideate", status: "active", message: `Generating proposals from ${research.data.length} topics...` });
        send("log", { step: "ideate", text: "Injecting brand voice context + post structure rules..." });
        send("log", { step: "ideate", text: "Generating SCENE→NARRATIVE→THEME→GRATITUDE→INVITATION outlines..." });

        const proposals = await generatePostProposals(research.data);
        send("log", { step: "ideate", text: `Created ${proposals.data.length} proposals across ${[...new Set(proposals.data.map(p => p.postType))].join(", ")} types (${proposals.tokensUsed.toLocaleString()} tokens)` });
        send("status", { step: "ideate", status: "done", tokensUsed: proposals.tokensUsed, message: "Proposals ready" });

        send("result", {
          topics: research.data,
          proposals: proposals.data,
          tokensUsed: research.tokensUsed + proposals.tokensUsed,
        });

        send("status", { step: "write", status: "active", message: `Writing ${proposals.data.length} drafts in parallel...` });
        send("log", { step: "write", text: `Generating drafts for all ${proposals.data.length} proposals concurrently...` });

        const draftResults = await Promise.allSettled(
          proposals.data.map(async (proposal) => {
            const [draftResult, visualsResult] = await Promise.allSettled([
              writePost(proposal),
              suggestVisuals(proposal),
            ]);
            if (draftResult.status === "rejected") throw draftResult.reason;
            const draft = draftResult.value;
            const visuals = visualsResult.status === "fulfilled" ? visualsResult.value : null;
            send("draft", {
              proposalId: proposal.id,
              draft: draft.data,
              visuals: visuals?.data ?? [],
              tokensUsed: draft.tokensUsed + (visuals?.tokensUsed ?? 0),
            });
            send("log", { step: "write", text: `Draft ready: "${proposal.topic}" (${(draft.tokensUsed + (visuals?.tokensUsed ?? 0)).toLocaleString()} tokens)` });
            return draft.tokensUsed + (visuals?.tokensUsed ?? 0);
          })
        );

        const writeTok = draftResults.reduce((s, r) => s + (r.status === "fulfilled" ? r.value : 0), 0);
        const successCount = draftResults.filter(r => r.status === "fulfilled").length;
        send("log", { step: "write", text: `${successCount}/${proposals.data.length} drafts completed (${writeTok.toLocaleString()} tokens)` });
        send("status", { step: "write", status: "done", tokensUsed: writeTok, message: "All drafts ready" });
        send("status", { step: "visual", status: "done", message: "Visuals generated" });

        send("done", {});
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
