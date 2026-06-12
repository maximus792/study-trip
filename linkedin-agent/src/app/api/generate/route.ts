import { NextRequest, NextResponse } from "next/server";
import {
  generateInterviewQuestions,
  buildBriefFromAnswers,
  writePost,
  rewritePost,
  suggestVisuals,
  extractToKnowledgeGraph,
} from "@/agents";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    switch (action) {
      case "interview": {
        const { idea } = body;
        if (!idea) {
          return NextResponse.json({ error: "Missing 'idea'" }, { status: 400 });
        }
        const result = await generateInterviewQuestions(idea);
        return NextResponse.json(result);
      }

      case "brief": {
        const { idea, answers } = body;
        if (!idea || !answers) {
          return NextResponse.json({ error: "Missing 'idea' or 'answers'" }, { status: 400 });
        }
        const result = await buildBriefFromAnswers(idea, answers);
        return NextResponse.json(result);
      }

      case "write": {
        const { proposal } = body;
        if (!proposal) {
          return NextResponse.json({ error: "Missing 'proposal'" }, { status: 400 });
        }
        const [draftResult, visualsResult] = await Promise.allSettled([
          writePost(proposal),
          suggestVisuals(proposal),
        ]);
        if (draftResult.status === "rejected") throw draftResult.reason;
        const draft = draftResult.value;
        const visuals = visualsResult.status === "fulfilled" ? visualsResult.value : null;

        // Fire-and-forget: extract entities to knowledge graph
        extractToKnowledgeGraph(draft.data).catch((err) =>
          console.error("KG extraction failed (non-blocking):", err)
        );

        return NextResponse.json({
          draft: draft.data,
          visuals: visuals?.data ?? [],
          tokensUsed: draft.tokensUsed + (visuals?.tokensUsed ?? 0),
        });
      }

      case "rewrite": {
        const { draft, feedback } = body;
        if (!draft || !feedback) {
          return NextResponse.json({ error: "Missing 'draft' or 'feedback'" }, { status: 400 });
        }
        const result = await rewritePost(draft, feedback);
        return NextResponse.json({ draft: result.data, tokensUsed: result.tokensUsed });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
