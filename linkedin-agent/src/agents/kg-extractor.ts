import { callLLMStructured, z } from "@/lib/llm";
import { getBrandSystemPrompt } from "@/lib/brand-context";
import { toKebabCase, entityExists, writeEntity } from "@/lib/vault-writer";
import type { PostDraft } from "@/types";

// --- Zod schema for structured extraction ---

const ExtractionSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      role: z.string().optional(),
      organization: z.string().optional(),
    })
  ),
  organizations: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["corporate", "university", "media", "other"]),
      relationship: z.string().optional(),
    })
  ),
  events: z.array(
    z.object({
      title: z.string(),
      date: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  concepts: z.array(
    z.object({
      name: z.string(),
      definition: z.string().optional(),
    })
  ),
  stories: z.array(
    z.object({
      title: z.string(),
      narrative_type: z.enum(["origin", "testimonial", "case_study", "teaching"]),
      emotional_beat: z.string().optional(),
      summary: z.string().optional(),
    })
  ),
  topicSlug: z.string().describe("A short 2-4 word kebab-case slug for the post topic, e.g. 'dosha-energies-talk'"),
});

type Extraction = z.infer<typeof ExtractionSchema>;

const AGENT_ROLE = `You are the Knowledge Graph Extractor Agent.
Your job is to analyze a LinkedIn post and extract structured entities for a knowledge graph.

EXTRACTION RULES:
- Extract ONLY entities explicitly mentioned or strongly implied in the post
- People: anyone named or clearly referenced by role
- Organizations: companies, universities, media outlets mentioned
- Events: talks, workshops, conferences, meetings described
- Concepts: methodologies, frameworks, dosha concepts, teachings referenced
- Stories: narrative arcs — origin stories, testimonials, case studies, teaching moments
- Be precise with names — use the full name as written in the post
- For topicSlug, pick the dominant subject in 2-4 kebab-case words`;

export interface KGExtractionStats {
  created: number;
  skipped: number;
  postEntry: string;
}

export async function extractToKnowledgeGraph(
  draft: PostDraft
): Promise<KGExtractionStats> {
  const today = new Date().toISOString().split("T")[0];

  // 1. Call LLM to extract entities
  const { data: extraction } = await callLLMStructured({
    systemPrompt: getBrandSystemPrompt(AGENT_ROLE),
    userPrompt: `Extract all knowledge graph entities from this LinkedIn post:

POST CONTENT:
${draft.content}

HASHTAGS: ${draft.hashtags.join(", ")}
POST TYPE: ${draft.postType}

Extract people, organizations, events, concepts, and stories. Be thorough but precise.`,
    schema: ExtractionSchema,
    schemaName: "KGExtraction",
    maxTokens: 2048,
    temperature: 0.3,
    model: "claude-sonnet-4-6",
  });

  let created = 0;
  let skipped = 0;

  // Collect all entity wikilinks for the post entry
  const entityLinks: { type: string; id: string; title: string }[] = [];

  // 2. Write people
  for (const person of extraction.people) {
    const id = toKebabCase(person.name);
    if (entityExists("people", id)) {
      skipped++;
    } else {
      const orgLink = person.organization
        ? `[[${toKebabCase(person.organization)}]]`
        : "";
      writeEntity("people", id, {
        type: "person",
        title: person.name,
        role: person.role ?? "",
        affiliation: person.organization ?? "",
        dosha_profile: "",
        confidence: "medium",
        tags: ["extracted", "auto-generated"],
        created: today,
        updated: today,
        sources: [`linkedin-post:${today}`],
      }, `## Bio

${person.role ? `${person.name} is ${person.role}${person.organization ? ` at ${person.organization}` : ""}.` : person.name}

## Background
- Mentioned in LinkedIn post (${today})

## Notable Contributions
- Referenced in 3Doshas content

## Relationships
- affiliated_with:: ${orgLink}
- mentored_by::
- collaborated_with::
- attended::
`);
      created++;
    }
    entityLinks.push({ type: "people", id, title: person.name });
  }

  // 3. Write organizations
  for (const org of extraction.organizations) {
    const id = toKebabCase(org.name);
    if (entityExists("organizations", id)) {
      skipped++;
    } else {
      writeEntity("organizations", id, {
        type: "organization",
        title: org.name,
        org_type: org.type,
        website: "",
        location: "",
        confidence: "medium",
        tags: ["extracted", "auto-generated"],
        created: today,
        updated: today,
        sources: [`linkedin-post:${today}`],
      }, `## Overview

${org.name}${org.relationship ? ` — ${org.relationship}` : ""}

## Key Facts
- Type: ${org.type}

## People
-

## Relationships
- partnered_with::
- employs::
- hosted_event::
- produces::
`);
      created++;
    }
    entityLinks.push({ type: "organizations", id, title: org.name });
  }

  // 4. Write events
  for (const event of extraction.events) {
    const id = toKebabCase(event.title);
    if (entityExists("events", id)) {
      skipped++;
    } else {
      const peopleLinks = extraction.people
        .map((p) => `- [[${toKebabCase(p.name)}]]`)
        .join("\n");
      writeEntity("events", id, {
        type: "event",
        title: event.title,
        date: event.date ?? today,
        location: event.location ?? "",
        status: "completed",
        posted: true,
        confidence: "medium",
        tags: ["extracted", "auto-generated"],
        created: today,
        updated: today,
        sources: [`linkedin-post:${today}`],
      }, `## Summary

${event.description ?? event.title}

## Key Moments
- Covered in LinkedIn post (${today})

## People Involved
${peopleLinks || "- "}

## Relationships
- hosted_by:: ${extraction.organizations.length > 0 ? `[[${toKebabCase(extraction.organizations[0].name)}]]` : ""}
- featured:: ${extraction.people.length > 0 ? `[[${toKebabCase(extraction.people[0].name)}]]` : ""}
- concepts_taught:: ${extraction.concepts.map((c) => `[[${toKebabCase(c.name)}]]`).join(" ")}
`);
      created++;
    }
    entityLinks.push({ type: "events", id, title: event.title });
  }

  // 5. Write concepts
  for (const concept of extraction.concepts) {
    const id = toKebabCase(concept.name);
    if (entityExists("concepts", id)) {
      skipped++;
    } else {
      writeEntity("concepts", id, {
        type: "concept",
        title: concept.name,
        definition: concept.definition ?? "",
        related_doshas: [],
        confidence: "medium",
        tags: ["extracted", "auto-generated"],
        created: today,
        updated: today,
        sources: [`linkedin-post:${today}`],
      }, `## Definition

${concept.definition ?? concept.name}

## Dosha Connection
-

## How 3Doshas Uses This
- Referenced in LinkedIn content

## Examples
-

## Relationships
- related_to::
- taught_at::
- referenced_in::
`);
      created++;
    }
    entityLinks.push({ type: "concepts", id, title: concept.name });
  }

  // 6. Write stories
  for (const story of extraction.stories) {
    const id = toKebabCase(story.title);
    if (entityExists("stories", id)) {
      skipped++;
    } else {
      writeEntity("stories", id, {
        type: "story",
        title: story.title,
        narrative_type: story.narrative_type,
        emotional_beat: story.emotional_beat ?? "",
        posted: true,
        confidence: "medium",
        tags: ["extracted", "auto-generated"],
        created: today,
        updated: today,
        sources: [`linkedin-post:${today}`],
      }, `## Narrative

${story.summary ?? story.title}

## Context
- From LinkedIn post (${today})

## Emotional Arc
${story.emotional_beat ? `- ${story.emotional_beat}` : "- "}

## Relationships
- features:: ${extraction.people.map((p) => `[[${toKebabCase(p.name)}]]`).join(" ")}
- illustrates:: ${extraction.concepts.map((c) => `[[${toKebabCase(c.name)}]]`).join(" ")}
- published_as::
`);
      created++;
    }
    entityLinks.push({ type: "stories", id, title: story.title });
  }

  // 7. Write the post entry
  const postId = `${today}-${extraction.topicSlug}`;
  const postEntry = `posts/${postId}.md`;

  const entitySection = entityLinks
    .map((e) => `- [[${e.id}]]`)
    .join("\n");

  const hashtagSection = draft.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  if (!entityExists("posts", postId)) {
    writeEntity("posts", postId, {
      type: "post",
      title: `Post about ${extraction.topicSlug.replace(/-/g, " ")}`,
      platform: "linkedin",
      url: "",
      date: today,
      engagement: { likes: 0, comments: 0, shares: 0 },
      posted: true,
      confidence: "high",
      tags: ["extracted", "auto-generated"],
      created: today,
      updated: today,
      sources: [],
    }, `## Content

${draft.content}

## Key Message
- ${draft.cta}

## Entities Referenced
${entitySection}

## Hashtags
${hashtagSection}

## Audience Response
-

## Relationships
- authored_by:: [[sumeet-syal]]
- references:: ${entityLinks.map((e) => `[[${e.id}]]`).join(" ")}
- promotes::
`);
    created++;
  } else {
    skipped++;
  }

  return { created, skipped, postEntry };
}
