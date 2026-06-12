import { callLLMWithTools, z, type OnToolCall } from "@/lib/llm";
import { searchWeb, searchLinkedIn, searchSocial } from "@/lib/search";
import type { AgentResponse } from "@/types";
import type Anthropic from "@anthropic-ai/sdk";

const TrendingTopicSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string().describe("URL or name of the source where you found this"),
  relevanceScore: z.number().min(1).max(10),
  suggestedAngle: z.string(),
});

const ResearchResultSchema = z.object({
  topics: z.array(TrendingTopicSchema),
});

type ResearchResult = z.infer<typeof ResearchResultSchema>;

const RESEARCH_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_web",
    description:
      "Search the web for current news, articles, and blog posts about a topic. " +
      "Use for general trends, industry news, and thought leadership content. " +
      "Returns titles, URLs, content snippets, and relevance scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'executive coaching AI trends 2026'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_linkedin",
    description:
      "Search specifically for LinkedIn posts and articles. " +
      "Use when looking for LinkedIn-specific content, competitor posts, viral posts, " +
      "or trending LinkedIn discussions in the career coaching space.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "LinkedIn search query, e.g. 'career pivot tech industry'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_social_media",
    description:
      "Search across multiple social platforms (LinkedIn, Twitter/X, Reddit) simultaneously. " +
      "Use for broad social sentiment analysis or when a topic spans multiple platforms.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query across social platforms",
        },
        platforms: {
          type: "array",
          items: { type: "string", enum: ["linkedin", "twitter", "reddit"] },
          description: "Which platforms to search (default: linkedin + twitter)",
        },
      },
      required: ["query"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const query = input.query as string;

  switch (name) {
    case "search_web":
      return JSON.stringify(await searchWeb(query));
    case "search_linkedin":
      return JSON.stringify(await searchLinkedIn(query));
    case "search_social_media": {
      const platforms = (input.platforms as string[] | undefined) ?? [
        "linkedin",
        "twitter",
      ];
      return JSON.stringify(
        await searchSocial(
          query,
          platforms as ("linkedin" | "twitter" | "reddit")[]
        )
      );
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const SYSTEM_PROMPT = `You are a research agent for 3Doshas, a career coaching platform that combines Ayurvedic dosha principles with executive development.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}. Always search for content from the CURRENT YEAR (${new Date().getFullYear()}). Include the year ${new Date().getFullYear()} in your search queries to get recent results. Do NOT search for 2025 data — that is outdated.

Your job: search the web for real, current trending topics and then generate LinkedIn post ideas based on what you find.

TARGET AUDIENCE: Mid-to-senior tech professionals, executives at companies like Google, Intel, Adobe. Also university students and HR/L&D teams.

CONTENT PILLARS (generate topics that fit these):
1. Career Alignment & Self-Discovery (dosha-based)
2. Leadership & Executive Development
3. Ayurveda Meets Business (teaching dosha concepts to professionals)
4. Silicon Valley & Tech Trends (AI, career pivots, future of work)
5. Community & Social Proof (workshop recaps, events)

RESEARCH STRATEGY:
- Start by searching LinkedIn for trending posts in career coaching, leadership, and professional development
- Search the web for current tech industry news and trends
- Look for viral or high-engagement content that 3Doshas could put their own spin on
- Find real examples and data points to reference

Generate topics that Sumeet Syal (Founder, former Intel VP, Stanford-trained coach) could write about from personal experience or professional perspective.`;

export async function researchTrendingTopics(
  currentNews?: string,
  onToolCall?: OnToolCall
): Promise<AgentResponse<ResearchResult["topics"]>> {
  const userPrompt = `Research current trending topics relevant to 3Doshas by searching the web and LinkedIn.

Your research plan:
1. Search LinkedIn for trending posts about career coaching, executive development, and leadership
2. Search the web for current AI/tech industry news relevant to career development
3. Search social media for discussions about career pivots, work-life balance, or professional growth

${currentNews ? `Additional context to consider:\n${currentNews}\n` : ""}

After researching, generate 5-7 LinkedIn post topic ideas based on REAL trends and content you found.

For each topic:
- title: clear topic name
- summary: why this is relevant now, referencing what you found
- source: URL or name of the real source that inspired this topic
- relevanceScore: 1-10, how well it maps to 3Doshas content pillars
- suggestedAngle: how Sumeet could write about this from personal experience

Sort by relevanceScore descending. Focus on topics where Sumeet can tell a personal story or share a teaching moment.`;

  const { data, tokensUsed } = await callLLMWithTools({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: ResearchResultSchema,
    schemaName: "ResearchResult",
    maxTokens: 4096,
  }, RESEARCH_TOOLS, executeTool, 10, onToolCall);

  return { success: true, data: data.topics, tokensUsed };
}
