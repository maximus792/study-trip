import { getBrandSystemPrompt } from "@/lib/brand-context";
import { callLLMStructured, z } from "@/lib/llm";
import { getUntoldStories, searchKnowledge } from "@/lib/kg-client";
import type { TrendingTopic, PostProposal, AgentResponse } from "@/types";
import { randomUUID } from "crypto";

const ProposalSchema = z.object({
  proposals: z.array(z.object({
    topic: z.string(),
    hook: z.string().describe("Opening 1-3 sentences. A scene, moment, or reflective question — NOT a clickbait hook"),
    bodyOutline: z.string().describe("Narrative outline: what story to tell, what teaching moment, what vulnerability point"),
    targetSegment: z.string(),
    postType: z.enum(["thought-leadership", "educational", "case-study", "trending-topic", "event-cta", "poll"]),
    contentPillar: z.string(),
  })),
});

const AGENT_ROLE = `You are the Ideator Agent. Transform trending topics into concrete LinkedIn post proposals for 3Doshas.

CRITICAL: Follow the REAL post structure, not generic LinkedIn advice:
- Posts are first-person narratives by Sumeet Syal
- Open with a scene, moment, or reflective question (NOT a clickbait hook)
- Structure: SCENE → NARRATIVE → THEME → GRATITUDE → INVITATION
- Posts should be 300-500 words when written
- Include a vulnerability/surprise moment
- End with gratitude and a forward-looking invitation, not a hard CTA`;

export async function generatePostProposals(
  topics: TrendingTopic[]
): Promise<AgentResponse<PostProposal[]>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  // --- Knowledge Graph enrichment ---
  const untoldStories = getUntoldStories(5);

  let kgContext = "";

  if (untoldStories.length > 0) {
    const storiesBlock = untoldStories
      .map(
        (s, i) =>
          `${i + 1}. ${s.title} — ${s.snippet} (connected to: ${s.relatedEntities.join(", ") || "none"})`
      )
      .join("\n");

    kgContext += `\nKNOWLEDGE GRAPH — UNTOLD STORIES (events/experiences not yet covered in posts):
${storiesBlock}

IMPORTANT: Prioritize creating posts about these real experiences over generic trending topics.
These are REAL events and stories from 3Doshas' history. Use them as primary material.
When a trending topic connects to an untold story, that's the ideal post — real experience + current relevance.\n`;
  }

  // For each trending topic, search the KG for related entities
  const topicKgMatches: string[] = [];
  for (const topic of topics) {
    const results = searchKnowledge(topic.title);
    if (results.length > 0) {
      const matches = results
        .slice(0, 3)
        .map((r) => `  - [${r.type}] ${r.title}: ${r.snippet.slice(0, 100)}`)
        .join("\n");
      topicKgMatches.push(
        `Topic "${topic.title}" — related KG entities:\n${matches}`
      );
    }
  }

  if (topicKgMatches.length > 0) {
    kgContext += `\nKNOWLEDGE GRAPH — RELATED ENTITIES FOR TRENDING TOPICS:
${topicKgMatches.join("\n\n")}\n`;
  }

  const userPrompt = `Create 3-5 LinkedIn post proposals from these topics:

${topics.map((t, i) => `${i + 1}. ${t.title} (relevance: ${t.relevanceScore}/10)\n   ${t.summary}\n   Angle: ${t.suggestedAngle}`).join("\n\n")}
${kgContext}
Each proposal needs:
- topic: main theme
- hook: opening 1-3 sentences (a scene, moment, or reflective question)
- bodyOutline: narrative outline with story beats, teaching moment, and vulnerability point
- targetSegment: who this post speaks to
- postType: category
- contentPillar: which 3Doshas pillar`;

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt,
    schema: ProposalSchema,
    schemaName: "PostProposals",
    maxTokens: 4096,
    model: "claude-sonnet-4-6",
  });

  const proposals: PostProposal[] = data.proposals.map((p) => ({
    ...p,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }));

  return { success: true, data: proposals, tokensUsed };
}
