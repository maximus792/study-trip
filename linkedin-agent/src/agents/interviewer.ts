import { getBrandSystemPrompt } from "@/lib/brand-context";
import { callLLMStructured, z } from "@/lib/llm";
import type { PostProposal, InterviewAnswers, AgentResponse } from "@/types";
import { randomUUID } from "crypto";

const QuestionsSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    purpose: z.string(),
    required: z.boolean(),
  })),
});

const BriefSchema = z.object({
  topic: z.string(),
  hook: z.string(),
  bodyOutline: z.string(),
  targetSegment: z.string(),
  postType: z.enum(["thought-leadership", "educational", "case-study", "trending-topic", "event-cta", "poll"]),
  contentPillar: z.string(),
});

const AGENT_ROLE = `You are the Interviewer Agent for 3Doshas LinkedIn content.

When a user has a post idea, ask smart questions to build a narrative. Remember:
- Sumeet writes first-person stories about real events
- Every post needs a personal angle, a teaching moment, and people/institutions to thank
- The best posts include a moment of vulnerability or surprise

Ask questions that uncover the STORY, not just the topic.`;

export async function generateInterviewQuestions(
  userIdea: string
): Promise<AgentResponse<{ questions: { question: string; purpose: string; required: boolean }[] }>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt: `User wants to post about: "${userIdea}"

Generate 4-6 questions to uncover the story behind this idea. Focus on:
- What personal experience or event relates to this?
- Who was involved? (people, institutions to tag)
- What was surprising or unexpected?
- What did you learn or teach?
- What's the forward-looking invitation?`,
    schema: QuestionsSchema,
    schemaName: "InterviewQuestions",
    maxTokens: 1500,
    model: "claude-sonnet-4-6",
  });

  return { success: true, data: data, tokensUsed };
}

export async function buildBriefFromAnswers(
  userIdea: string,
  answers: InterviewAnswers
): Promise<AgentResponse<PostProposal>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt: `Build a post brief from this idea and answers:

IDEA: "${userIdea}"

ANSWERS:
${Object.entries(answers.answers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n")}

Create a brief following the SCENE → NARRATIVE → THEME → GRATITUDE → INVITATION structure.`,
    schema: BriefSchema,
    schemaName: "PostBrief",
    maxTokens: 2000,
    model: "claude-sonnet-4-6",
  });

  return {
    success: true,
    data: { ...data, id: randomUUID(), createdAt: new Date().toISOString() },
    tokensUsed,
  };
}
