# 3Doshas LinkedIn Agent — Demo Explanation

> This document explains the full project so you can understand the demo and build the presentation.

---

## What is this?

A **multi-agent AI system** that automatically generates LinkedIn posts for **3Doshas**, a career coaching company based in Silicon Valley. The app researches trending topics, generates post ideas, and writes full LinkedIn posts in the authentic voice of the founder, Sumeet Syal.

It's a Next.js web app with a dark, minimal UI that exposes two workflows: an **automated pipeline** (end-to-end content generation) and a **manual flow** (human-in-the-loop guided post creation).

---

## About 3Doshas (the client)

- **What they do:** Career coaching and leadership development using Ayurvedic dosha principles (Vata/Air, Pitta/Fire, Kapha/Water) applied to professional careers.
- **Founder:** Sumeet Syal — former Intel VP, Stanford-trained executive coach, adjunct faculty at SJSU.
- **Target audience:** Mid-to-senior tech professionals, Silicon Valley executives, university students.
- **Corporate clients:** Google, Intel, Adobe, Palo Alto Networks, EY, ServiceNow, Atlassian.
- **University partners:** UC Santa Cruz, UC Berkeley, Santa Clara University, SJSU, FHNW (Switzerland).

The key insight: Sumeet's most engaging LinkedIn posts are **first-person narratives** that follow a specific arc: Scene → Narrative → Theme → Gratitude → Invitation. The system is designed to replicate this exact style.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **Next.js 16** (React 19) | Full-stack web app |
| LLM | **Claude Opus 4.6** (via Anthropic SDK) | All agent reasoning |
| LLM Gateway | **LiteLLM** (netsfera.es proxy) | Routes API calls |
| Web Search | **Tavily API** | Real-time web/LinkedIn/social research |
| Validation | **Zod v4** | Structured output schemas |
| Styling | **Tailwind CSS v4** | UI design |
| Language | **TypeScript** | Type safety |

---

## Architecture: 5 Specialized Agents

The system uses a **pipeline of 5 AI agents**, each with a distinct role. Every agent receives the `brand.md` file as system context, which contains the full brand voice guide (tone, writing style, do's/don'ts, emoji patterns, hashtag strategy, post structure).

```
                        ┌─────────────┐
                        │   brand.md  │  (Brand voice, tone rules,
                        │  (context)  │   post structure, examples)
                        └──────┬──────┘
                               │ injected into every agent
                               ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Researcher  │───▶│   Ideator    │───▶│ Interviewer  │───▶│  Copywriter  │───▶│Visual Creator│
│              │    │              │    │  (manual only)│    │              │    │              │
│ Searches web │    │ Turns topics │    │ Asks questions│    │ Writes the   │    │ Suggests     │
│ LinkedIn,    │    │ into post    │    │ to uncover    │    │ full post as │    │ images,      │
│ Twitter,     │    │ proposals    │    │ the story     │    │ Sumeet Syal  │    │ quote cards, │
│ Reddit       │    │ with hooks   │    │ behind the    │    │ with his     │    │ diagrams     │
│              │    │ and outlines │    │ idea          │    │ exact voice  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
   uses tools:          structured          structured          structured          structured
   search_web           output              output              output              output
   search_linkedin      (Zod schema)        (Zod schema)        (Zod schema)        (Zod schema)
   search_social
```

### Agent 1: Researcher (`researcher.ts`)

- **Role:** Find trending topics relevant to 3Doshas.
- **How it works:** This is the only agent that uses **tool use** (agentic loop). Claude is given 3 tools:
  - `search_web` — general web search via Tavily
  - `search_linkedin` — LinkedIn-specific search
  - `search_social_media` — multi-platform search (LinkedIn + Twitter + Reddit)
- **Process:** Claude autonomously decides which searches to run (up to 10 iterations), reads results, and compiles 5-7 trending topics scored by relevance (1-10).
- **Output:** Array of `{ title, summary, source, relevanceScore, suggestedAngle }`.

### Agent 2: Ideator (`ideator.ts`)

- **Role:** Transform raw topics into concrete LinkedIn post proposals.
- **How it works:** Takes the researcher's topics and generates 3-5 proposals, each with:
  - A hook (opening scene/moment — NOT clickbait)
  - A narrative outline following the Scene → Narrative → Theme → Gratitude → Invitation structure
  - A target segment and content pillar classification
- **Output:** Structured JSON validated by Zod schema.

### Agent 3: Interviewer (`interviewer.ts`) — Manual Flow Only

- **Role:** Help the user articulate their post idea through smart questions.
- **How it works:** Two-step process:
  1. Given a raw idea from the user, generates 4-6 questions to uncover the story (who was involved? what was surprising? what institution to tag?).
  2. Takes the user's answers and builds a structured brief for the Copywriter.
- **Why:** Sumeet's best posts are about real events with real people. The interviewer extracts those details.

### Agent 4: Copywriter (`copywriter.ts`)

- **Role:** Write the actual LinkedIn post as Sumeet Syal.
- **How it works:** Receives a proposal/brief and writes a 250-400 word post following exact style rules:
  - First person narrative
  - Long flowing sentences with em dashes
  - One vulnerability moment per post
  - 4-6 emojis, 8-12 hashtags
  - Signature phrases ("I had the pleasure of...", "Onward—keep building...")
- **Also:** Can **rewrite** a draft based on user feedback while maintaining voice consistency.
- **Output:** `{ content, hook, hashtags[], cta, postType, imagePrompt }`.

### Agent 5: Visual Creator (`visual-creator.ts`)

- **Role:** Suggest visual accompaniments for the post.
- **Types:** AI image prompts, HTML diagrams, quote cards.
- **Brand colors:** Deep blue `#1a1a4e`, gold `#c9a84c`, white, purple `#4a2080`.

---

## Two User Flows

### Flow A: Automated Pipeline ("Auto Flow")

```
[User clicks "Run Pipeline"]
    │
    ▼
1. RESEARCH — Researcher agent searches the web in real-time
    │           (multiple Tavily queries, Claude decides which)
    │           Streams progress via Server-Sent Events (SSE)
    ▼
2. IDEATE — Ideator agent creates 3-5 post proposals
    │
    ▼
3. REVIEW — User sees proposals as cards, picks one
    │
    ▼
4. WRITE — Copywriter generates the full post
    │         Visual Creator suggests images
    ▼
5. PREVIEW — LinkedIn-style preview with character count
    │          User can rewrite with feedback
    ▼
[Copy to clipboard → paste on LinkedIn]
```

The pipeline uses **Server-Sent Events (SSE)** to stream progress in real-time. The UI shows a visual pipeline with animated steps (pending → active → done), per-step logs, elapsed time, and token usage.

### Flow B: Manual Flow ("Create a Post")

```
[User types a post idea]
    │
    ▼
1. INTERVIEW — AI asks smart questions about the idea
    │
    ▼
2. ANSWER — User fills in answers (who, what, where, surprise moment)
    │
    ▼
3. WRITE — Copywriter generates post from brief
    │
    ▼
4. PREVIEW + REWRITE — Same as auto flow
```

A step indicator (Idea → Questions → Writing → Result) tracks progress through the manual flow.

---

## Key Technical Concepts to Explain in the Presentation

### 1. Multi-Agent Architecture
Each agent is a specialized prompt + schema pair. They don't share memory — data flows through the pipeline as structured JSON. This is different from a single-prompt approach because each agent is optimized for its specific task.

### 2. Tool Use (Agentic Behavior)
The Researcher agent demonstrates **agentic AI**: Claude receives tool definitions and autonomously decides which searches to run, how many times, and what queries to use. The `callLLMWithTools` function implements the tool-use loop (up to 10 iterations).

### 3. Structured Output with Zod
Every agent returns JSON validated against a Zod schema. The `callLLMStructured` function:
- Converts the Zod schema to JSON Schema
- Injects it into the system prompt
- Parses and validates the response
- Includes a `cleanJsonResponse` function that repairs malformed JSON (strips markdown fences, balances brackets, etc.)

### 4. Brand Voice as System Context
The `brand.md` file (271 lines) acts as a comprehensive style guide loaded into every agent's system prompt. This is what makes the output sound like Sumeet rather than generic AI.

### 5. Server-Sent Events (SSE) for Real-Time Streaming
The `/api/cron` route streams events as the pipeline runs. The frontend processes events (`status`, `log`, `result`, `error`, `done`) to update the pipeline visualization in real-time.

### 6. LiteLLM Gateway
The LLM calls go through `llm.netsfera.es` (a LiteLLM proxy), which routes to the actual Claude API. This allows model switching, rate limiting, and cost tracking without changing application code.

---

## File Structure

```
study-trip/
├── brand.md                          # Brand voice guide (loaded by all agents)
├── linkedin-agent/                   # Next.js app
│   ├── src/
│   │   ├── agents/                   # The 5 AI agents
│   │   │   ├── researcher.ts         # Web search + topic discovery (tool use)
│   │   │   ├── ideator.ts            # Topic → post proposal
│   │   │   ├── interviewer.ts        # Q&A to build a brief (manual flow)
│   │   │   ├── copywriter.ts         # Writes/rewrites the LinkedIn post
│   │   │   └── visual-creator.ts     # Suggests images/visuals
│   │   ├── lib/
│   │   │   ├── llm.ts                # LLM client (callLLM, callLLMStructured, callLLMWithTools)
│   │   │   ├── search.ts             # Tavily search wrapper (web, LinkedIn, social)
│   │   │   └── brand-context.ts      # Loads brand.md as system context
│   │   ├── app/
│   │   │   ├── page.tsx              # Main dashboard UI (both flows)
│   │   │   ├── globals.css           # Animations and custom styles
│   │   │   └── api/
│   │   │       ├── cron/route.ts     # SSE endpoint for auto pipeline
│   │   │       ├── generate/route.ts # Actions: interview, brief, write, rewrite
│   │   │       └── posts/route.ts    # In-memory post storage (CRUD)
│   │   ├── components/
│   │   │   ├── pipeline/PipelineViz.tsx    # Animated pipeline visualization
│   │   │   ├── preview/LinkedInPreview.tsx # LinkedIn post preview with char count
│   │   │   └── create/StepIndicator.tsx    # Manual flow step tracker
│   │   └── types/index.ts            # TypeScript type definitions
│   └── .env.example                  # Required API keys
└── *.png                             # Screenshots for reference
```

---

## API Keys Required

| Key | Service | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | Anthropic (via LiteLLM) | Claude Opus 4.6 for all agents |
| `TAVILY_API_KEY` | Tavily | Web search for the Researcher agent |
| `OPENAI_API_KEY` | OpenAI (optional) | Image generation for visual suggestions |

---

## How to Run the Demo

```bash
cd linkedin-agent
cp .env.example .env.local   # Fill in your API keys
pnpm install
pnpm dev                     # http://localhost:3000
```

### Demo Script (suggested order)

1. **Open the app** — show the dark UI, explain the header (3Doshas branding, Auto/Manual toggle, Agent Log).

2. **Auto Flow:**
   - Click "Run Pipeline".
   - While it runs, explain each pipeline step as it lights up (Research → Ideate → Review → Write → Visual).
   - Click on pipeline step badges to expand logs — show the actual search queries Claude is running.
   - When proposals appear, explain what each card shows (post type, topic, hook, content pillar).
   - Click "Write" on a proposal — show it generating the post.
   - Show the LinkedIn Preview with character count.
   - Show the "Copy Post" button.

3. **Manual Flow:**
   - Switch to "Manual Flow" tab.
   - Type an idea (e.g., "I just came back from teaching at FHNW in Switzerland").
   - Show the AI-generated interview questions.
   - Answer them briefly — show how it uncovers the story.
   - Show the generated post.

4. **Rewrite:**
   - Type feedback (e.g., "make the hook more personal" or "mention the SJSU workshop").
   - Show the post being rewritten while maintaining voice.

5. **Agent Log:**
   - Click the Agent Log button in the header — show token usage per agent call.

---

## Presentation Talking Points

1. **Problem:** Creating authentic LinkedIn content at scale is hard. Sumeet has a very specific voice and style that generic AI tools can't replicate.

2. **Solution:** A multi-agent pipeline where each agent specializes in one part of the content creation process, all grounded in a comprehensive brand voice document.

3. **Innovation:**
   - Agentic research — the AI decides what to search for, not the user.
   - Brand voice preservation — 271-line style guide ensures authenticity.
   - Human-in-the-loop — the interview flow extracts real stories from the user.
   - Real-time pipeline visualization — you see the AI "thinking" step by step.

4. **Technical depth:**
   - Tool use with Claude (the researcher agent's agentic loop).
   - Structured output with Zod validation (type-safe AI responses).
   - SSE streaming for real-time UI updates.
   - Pipeline architecture with independent, composable agents.

5. **Business value:**
   - Reduces post creation time from 2+ hours to ~5 minutes.
   - Maintains brand consistency across all content.
   - Research agent surfaces timely, relevant topics automatically.
   - Rewrite loop allows rapid iteration without losing voice.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Dosha** | In Ayurveda, one of three energies (Vata/Air, Pitta/Fire, Kapha/Water) that govern personality and health. 3Doshas applies this to career coaching. |
| **LiteLLM** | An open-source proxy that routes LLM API calls to different providers (Anthropic, OpenAI, etc.) through a unified interface. |
| **Tavily** | An AI-optimized web search API designed for AI agents that need real-time web data. |
| **SSE** | Server-Sent Events — a standard for servers to push real-time updates to browsers over HTTP. |
| **Tool Use** | An LLM capability where the model can call external functions (tools) to gather information before generating its final response. |
| **Zod** | A TypeScript schema validation library. Here it enforces that Claude's JSON responses match the expected structure. |
| **Structured Output** | Technique where the LLM is constrained to return valid JSON matching a predefined schema rather than free-form text. |
