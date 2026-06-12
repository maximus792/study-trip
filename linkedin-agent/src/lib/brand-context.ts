import { readFileSync } from "fs";
import { join } from "path";

let cachedBrandContext: string | null = null;

export function loadBrandContext(): string {
  if (cachedBrandContext) return cachedBrandContext;

  const brandPath = join(process.cwd(), "..", "brand.md");
  cachedBrandContext = readFileSync(brandPath, "utf-8");
  return cachedBrandContext;
}

export function getBrandSystemPrompt(agentRole: string): string {
  const brand = loadBrandContext();
  return `You are an AI agent working for 3Doshas, a career coaching platform.
Your role: ${agentRole}

BRAND CONTEXT (follow this strictly):
${brand}

IMPORTANT RULES:
- Always write in the brand's tone of voice (confident, direct, professional, warm)
- Never use spiritual/New Age language
- Always connect content back to the dosha methodology
- Target mid-to-senior tech professionals unless specified otherwise
- Use social proof from the brand's client list when relevant`;
}
