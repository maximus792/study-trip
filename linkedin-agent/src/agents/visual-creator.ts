import { getBrandSystemPrompt } from "@/lib/brand-context";
import { callLLMStructured, z } from "@/lib/llm";
import type { AgentResponse, PostProposal } from "@/types";

const VisualSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    type: z.enum(["ai-image", "html-diagram", "quote-card"]),
    prompt: z.string().optional().describe("Image generation prompt for ai-image type"),
    html: z.string().optional().describe("Complete HTML/CSS for html-diagram or quote-card"),
    description: z.string(),
    dimensions: z.object({ width: z.number(), height: z.number() }),
  })),
});

export type VisualSuggestion = z.infer<typeof VisualSuggestionSchema>["suggestions"][number];

const AGENT_ROLE = `You are the Visual Creator Agent for 3Doshas LinkedIn posts.
Suggest visuals that match the brand: deep blue #1a1a4e, gold #c9a84c, white #ffffff, purple #4a2080.
For html-diagram/quote-card types, write SHORT inline-styled HTML (under 500 chars each). Keep it simple — no complex layouts.
For ai-image types, write a detailed prompt for image generation.
Prefer ai-image type over html types to keep responses concise.`;

export async function suggestVisuals(
  proposal: PostProposal
): Promise<AgentResponse<VisualSuggestion[]>> {
  const systemPrompt = getBrandSystemPrompt(AGENT_ROLE);

  const { data, tokensUsed } = await callLLMStructured({
    systemPrompt,
    userPrompt: `Suggest 2-3 visuals for a LinkedIn post with these details:

TOPIC: ${proposal.topic}
OPENING: ${proposal.hook}
NARRATIVE: ${proposal.bodyOutline}
POST TYPE: ${proposal.postType}
CONTENT PILLAR: ${proposal.contentPillar}
TARGET: ${proposal.targetSegment}

LinkedIn dimensions: 1200x628 (landscape) or 1080x1080 (square).
Brand colors: deep blue #1a1a4e, gold #c9a84c, white #ffffff, purple #4a2080.`,
    schema: VisualSuggestionSchema,
    schemaName: "VisualSuggestions",
    maxTokens: 8000,
    model: "claude-sonnet-4-6",
  });

  return { success: true, data: data.suggestions, tokensUsed };
}
