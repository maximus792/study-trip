import { getBrandSystemPrompt } from "@/lib/brand-context";
import { callLLMStructured, z } from "@/lib/llm";
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

  const userPrompt = `Create 3-5 LinkedIn post proposals from these topics:

${topics.map((t, i) => `${i + 1}. ${t.title} (relevance: ${t.relevanceScore}/10)\n   ${t.summary}\n   Angle: ${t.suggestedAngle}`).join("\n\n")}

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
