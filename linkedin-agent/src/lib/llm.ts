import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://llm.netsfera.es",
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";

export interface LLMOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export async function callLLM(options: LLMOptions): Promise<{ text: string; tokensUsed: number }> {
  const response = await anthropic.messages.create({
    model: options.model ?? MODEL,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);
  return { text, tokensUsed };
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  // Strip leading prose before the JSON object/array
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  // Strip trailing prose after the JSON object/array
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const jsonEnd = Math.max(lastBrace, lastBracket);
  if (jsonEnd > 0 && jsonEnd < cleaned.length - 1) {
    cleaned = cleaned.slice(0, jsonEnd + 1);
  }

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    let repaired = cleaned;
    const opens = (repaired.match(/\[/g) || []).length;
    const closes = (repaired.match(/\]/g) || []).length;
    const braceOpens = (repaired.match(/\{/g) || []).length;
    const braceCloses = (repaired.match(/\}/g) || []).length;

    repaired = repaired.replace(/,\s*$/, "");
    repaired = repaired.replace(/,\s*"[^"]*$/, "");
    repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');

    for (let i = 0; i < braceOpens - braceCloses; i++) repaired += "}";
    for (let i = 0; i < opens - closes; i++) repaired += "]";

    return repaired;
  }
}

export async function callLLMStructured<T>(
  options: LLMOptions & { schema: z.ZodType<T>; schemaName: string }
): Promise<{ data: T; tokensUsed: number }> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(options.schema), null, 2);

  const systemPrompt = options.systemPrompt +
    `\n\nYou MUST respond with ONLY valid JSON matching this schema (no markdown fences, no explanation):\n${jsonSchema}`;

  const { text, tokensUsed } = await callLLM({
    ...options,
    systemPrompt,
  });

  const cleaned = cleanJsonResponse(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Invalid JSON from model: ${cleaned.slice(0, 200)}`);
  }

  let result = options.schema.safeParse(parsed);
  if (!result.success) {
    const truncated = tryAutoTruncate(parsed, result.error.issues);
    if (truncated) {
      result = options.schema.safeParse(truncated);
    }
    if (!result.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues)}`);
    }
  }

  return { data: result.data, tokensUsed };
}

function tryAutoTruncate(data: unknown, issues: z.ZodIssue[]): unknown | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = { ...(data as Record<string, unknown>) };
  let changed = false;
  for (const issue of issues) {
    if (
      issue.code === "too_big" &&
      (issue as unknown as Record<string, unknown>).origin === "string" &&
      issue.path.length === 1 &&
      typeof issue.path[0] === "string"
    ) {
      const key = issue.path[0];
      const val = obj[key];
      if (typeof val === "string" && typeof issue.maximum === "number") {
        obj[key] = val.slice(0, issue.maximum);
        changed = true;
      }
    }
  }
  return changed ? obj : null;
}

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>
) => Promise<string>;

export type OnToolCall = (toolName: string, input: Record<string, unknown>, resultPreview: string) => void;

export async function callLLMWithTools<T>(
  options: LLMOptions & { schema: z.ZodType<T>; schemaName: string },
  tools: Anthropic.Messages.Tool[],
  executeTool: ToolExecutor,
  maxIterations = 10,
  onToolCall?: OnToolCall
): Promise<{ data: T; tokensUsed: number }> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(options.schema), null, 2);

  const systemPrompt =
    options.systemPrompt +
    `\n\nCRITICAL: When you have finished researching, your ENTIRE response must be ONLY the JSON object. No introduction, no explanation, no prose before or after. Start with { and end with }. Schema:\n${jsonSchema}`;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: options.userPrompt },
  ];

  let totalTokens = 0;
  let iterations = 0;

  const useModel = options.model ?? MODEL;

  let response = await anthropic.messages.create({
    model: useModel,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system: systemPrompt,
    tools,
    messages,
  });
  totalTokens += (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

  while (response.stop_reason === "tool_use" && iterations < maxIterations) {
    iterations++;
    messages.push({ role: "assistant", content: response.content });

    const toolBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
    );
    const toolResults = await Promise.all(
      toolBlocks.map(async (block): Promise<Anthropic.Messages.ToolResultBlockParam> => {
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          onToolCall?.(block.name, block.input as Record<string, unknown>, result.slice(0, 500));
          return { type: "tool_result", tool_use_id: block.id, content: result };
        } catch (err) {
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: useModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt,
      tools,
      messages,
    });
    totalTokens += (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const cleaned = cleanJsonResponse(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Invalid JSON from model after ${iterations} tool iterations: ${cleaned.slice(0, 200)}`);
  }

  const result = options.schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues)}`);
  }

  return { data: result.data, tokensUsed: totalTokens };
}

export { z };
