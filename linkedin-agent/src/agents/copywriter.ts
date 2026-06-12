import { getBrandSystemPrompt } from "@/lib/brand-context";
import { callLLMStructured, z } from "@/lib/llm";
import { searchKnowledge, getEntity, getRelated } from "@/lib/kg-client";
import type { PostProposal, PostDraft, AgentResponse } from "@/types";
import { randomUUID } from "crypto";

const DraftSchema = z.object({
  content: z.string().max(3000).describe("Full post text WITHOUT hashtags, use \\n for line breaks. Do NOT include hashtags in this field — they go in the hashtags array. MUST be under 3000 characters."),
  hook: z.string().describe("The opening 1-3 sentences"),
  hashtags: z.array(z.string()),
  cta: z.string().describe("The closing invitation or forward-look"),
  postType: z.enum(["thought-leadership", "educational", "case-study", "trending-topic", "event-cta", "poll"]),
  imagePrompt: z.string().optional().describe("Detailed prompt for generating a supporting image, or omit if text-only"),
});

const AGENT_ROLE = `You are the Copywriter Agent — the core content creator for 3Doshas LinkedIn.
You write as Sumeet Syal (Founder & CEO). Follow his REAL voice exactly.

SUMEET'S WRITING STYLE:
- First person narrative ("I had the pleasure of...", "We explored...")
- Long, flowing sentences (20-30 words avg) with em dashes and parenthetical asides
- Posts MUST be 250-350 words. The "content" field MUST be under 2800 characters — this is a HARD LIMIT enforced by validation. Count carefully. Hashtags go in a separate field, NOT in content.
- Single-sentence paragraphs for emphasis, but most are 2-4 sentences
- One moment of vulnerability or surprise per post ("Honestly, I wasn't sure...", "To my surprise and gratitude...")
- Teaches one concept per post with context

POST STRUCTURE (follow this exactly):
1. SCENE-SETTING (1-3 sentences) — A moment, question, or reflection. NOT a clickbait hook.
2. NARRATIVE (3-6 paragraphs) — The story. What happened, who was there, what was explored. Name institutions with full official names.
3. THEME/TEACHING (1-3 paragraphs) — The conceptual payoff. Connect to 3Doshas methodology, "inner intelligence," or dosha energies.
4. GRATITUDE (1-2 paragraphs) — Thank specific people and institutions by name.
5. INVITATION (1-2 sentences) — Forward-looking close. "Onward—keep building, keep learning..." Not a hard sell.
6. HASHTAGS — 8-12, always include #3Doshas

EMOJI PATTERNS:
- Opening: sometimes an emoji cluster (💙😊🙏)
- Body: dosha labels (💨 Vata/Air, 🔥 Pitta/Fire, 💧 Kapha/Water), emotional beats (🫶 👏)
- Closing: 🚀 as signature sign-off
- Total: 4-6 per post

SIGNATURE PHRASES TO USE NATURALLY:
- "I had the pleasure of..." / "I had the honor of..."
- "Grateful for..." / "A heartfelt thank you to..."
- "What made this moment especially meaningful..."
- "The best part?"
- "Onward—keep building, keep learning, and keep lifting others as you climb."

DO NOT:
- Write in second person ("you need to...")
- Use imperative commands or copywriting hooks
- Write short punchy fragments
- Use arrow symbols (→)
- Use fewer than 8 hashtags
- Sound like a LinkedIn growth-hacker`;

function buildKgContext(topic: string): string {
  const results = searchKnowledge(topic);
  if (results.length === 0) return "";

  const details: string[] = [];
  const people: string[] = [];
  const orgs: string[] = [];
  const events: string[] = [];

  for (const result of results.slice(0, 5)) {
    const entity = getEntity(result.id);
    if (!entity) continue;

    details.push(`- ${entity.title}: ${entity.content.slice(0, 200).replace(/\n/g, " ").trim()}`);

    if (entity.type === "person") people.push(entity.title);
    if (entity.type === "organization") orgs.push(entity.title);
    if (entity.type === "event" || entity.type === "story") events.push(entity.title);

    // Also gather related entities for richer context
    const related = getRelated(result.id, 1);
    for (const rel of related.slice(0, 3)) {
      if (rel.type === "person" && !people.includes(rel.title)) people.push(rel.title);
      if (rel.type === "organization" && !orgs.includes(rel.title)) orgs.push(rel.title);
    }
  }

  if (details.length === 0) return "";

  let block = `\nREAL DETAILS FROM KNOWLEDGE GRAPH (use these specific details in the post):\n`;
  block += details.join("\n") + "\n";
  if (people.length > 0) block += `- People involved: ${people.join(", ")}\n`;
  if (orgs.length > 0) block += `- Organizations: ${orgs.join(", ")}\n`;
  if (events.length > 0) block += `- Key events/stories: ${events.join(", ")}\n`;
  block += `\nUse these REAL details instead of inventing generic examples. Name real people, real institutions, real events.\n`;

  return block;
}

export async function writePost(
  proposal: PostProposal
): Promise<AgentResponse<PostDraft>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  const kgContext = buildKgContext(proposal.topic);

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt: `Write a complete LinkedIn post based on this proposal:

TOPIC: ${proposal.topic}
OPENING DIRECTION: ${proposal.hook}
NARRATIVE OUTLINE: ${proposal.bodyOutline}
TARGET: ${proposal.targetSegment}
POST TYPE: ${proposal.postType}
CONTENT PILLAR: ${proposal.contentPillar}
${kgContext}
Write the full post as Sumeet Syal. Follow the SCENE → NARRATIVE → THEME → GRATITUDE → INVITATION structure. 250-400 words.

IMPORTANT: Put the post text in the "content" field and hashtags ONLY in the "hashtags" array. Do NOT include hashtags inside the content field. 8-12 hashtags.`,
    schema: DraftSchema,
    schemaName: "LinkedInPost",
    maxTokens: 3000,
    temperature: 0.8,
    model: "claude-sonnet-4-6",
  });

  const draft: PostDraft = {
    ...data,
    imagePrompt: data.imagePrompt ?? undefined,
    id: randomUUID(),
    proposalId: proposal.id,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { success: true, data: draft, tokensUsed };
}

export async function rewritePost(
  draft: PostDraft,
  feedback: string
): Promise<AgentResponse<PostDraft>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  // Extract a topic hint from the draft content for KG search
  const topicHint = draft.content.split("\n").find((line) => line.trim().length > 10)?.trim() ?? "";
  const rewriteKgContext = buildKgContext(topicHint);

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt: `Rewrite this LinkedIn post based on feedback:

CURRENT POST:
${draft.content}

FEEDBACK: ${feedback}
${rewriteKgContext}
Apply the feedback while maintaining Sumeet's voice. Keep the SCENE → NARRATIVE → THEME → GRATITUDE → INVITATION structure.`,
    schema: DraftSchema,
    schemaName: "LinkedInPost",
    maxTokens: 3000,
    temperature: 0.8,
    model: "claude-sonnet-4-6",
  });

  return {
    success: true,
    data: {
      ...data,
      imagePrompt: data.imagePrompt ?? undefined,
      id: draft.id,
      proposalId: draft.proposalId,
      status: "draft" as const,
      createdAt: draft.createdAt,
      updatedAt: new Date().toISOString(),
    },
    tokensUsed,
  };
}
