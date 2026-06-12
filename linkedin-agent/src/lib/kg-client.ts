import fs from "fs";
import path from "path";
import matter from "gray-matter";

// --- Types ---

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  confidence: string;
  posted: boolean | null;
}

export interface EntityDetail {
  id: string;
  type: string;
  title: string;
  confidence: string;
  posted: boolean | null;
  tags: string[];
  content: string;
  wikilinks: string[];
  frontmatter: Record<string, unknown>;
}

export interface RelatedEntity {
  id: string;
  type: string;
  title: string;
  relation: "outgoing" | "backlink";
}

export interface UntoldStory {
  id: string;
  type: string;
  title: string;
  snippet: string;
  connections: number;
  relatedEntities: string[];
}

// --- Vault cache ---

interface ParsedNote {
  id: string;
  type: string;
  title: string;
  confidence: string;
  posted: boolean | null;
  tags: string[];
  content: string;
  wikilinks: string[];
  frontmatter: Record<string, unknown>;
}

let cachedNotes: ParsedNote[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

const VAULT_PATH = path.resolve(process.cwd(), "..", "knowledge");

function extractWikilinks(text: string): string[] {
  const matches = text.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2).toLowerCase()))];
}

function snippet(content: string, maxLen = 200): string {
  const cleaned = content
    .replace(/^#.*$/gm, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trimEnd() + "...";
}

function loadVault(): ParsedNote[] {
  const now = Date.now();
  if (cachedNotes && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedNotes;
  }

  const notes: ParsedNote[] = [];

  let files: string[];
  try {
    files = findMdFiles(VAULT_PATH);
  } catch {
    cachedNotes = [];
    cacheTimestamp = now;
    return [];
  }

  for (const filePath of files) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      const relPath = path.relative(VAULT_PATH, filePath);
      if (relPath.startsWith("_templates")) continue;

      const id = path
        .basename(filePath, ".md")
        .toLowerCase();

      notes.push({
        id,
        type: (data.type as string) ?? "unknown",
        title: (data.title as string) ?? id,
        confidence: (data.confidence as string) ?? "medium",
        posted: data.posted === true ? true : data.posted === false ? false : null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        content,
        wikilinks: extractWikilinks(content),
        frontmatter: data,
      });
    } catch {
      // skip unparseable files
    }
  }

  cachedNotes = notes;
  cacheTimestamp = now;
  return notes;
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      results.push(full);
    }
  }
  return results;
}

// --- Public API ---

export function searchKnowledge(query: string, type?: string): SearchResult[] {
  const notes = loadVault();
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = notes
    .filter((n) => !type || n.type === type)
    .map((n) => {
      const haystack = `${n.title} ${n.tags.join(" ")} ${n.content}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (n.title.toLowerCase().includes(term)) score += 3;
        if (n.tags.some((t) => t.toLowerCase().includes(term))) score += 2;
        if (n.content.toLowerCase().includes(term)) score += 1;
      }
      return { note: n, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored.map((s) => ({
    id: s.note.id,
    type: s.note.type,
    title: s.note.title,
    snippet: snippet(s.note.content),
    confidence: s.note.confidence,
    posted: s.note.posted,
  }));
}

export function getEntity(id: string): EntityDetail | null {
  const notes = loadVault();
  const note = notes.find((n) => n.id === id.toLowerCase());
  if (!note) return null;
  return {
    id: note.id,
    type: note.type,
    title: note.title,
    confidence: note.confidence,
    posted: note.posted,
    tags: note.tags,
    content: note.content,
    wikilinks: note.wikilinks,
    frontmatter: note.frontmatter,
  };
}

export function getRelated(id: string, depth = 1): RelatedEntity[] {
  const notes = loadVault();
  const target = id.toLowerCase();
  const seen = new Set<string>();
  const result: RelatedEntity[] = [];

  function collect(entityId: string, currentDepth: number) {
    if (currentDepth > depth) return;
    const note = notes.find((n) => n.id === entityId);

    // outgoing wikilinks from this entity
    if (note) {
      for (const link of note.wikilinks) {
        if (seen.has(link) || link === target) continue;
        const linked = notes.find((n) => n.id === link);
        if (linked) {
          seen.add(link);
          result.push({ id: linked.id, type: linked.type, title: linked.title, relation: "outgoing" });
          if (currentDepth + 1 <= depth) collect(linked.id, currentDepth + 1);
        }
      }
    }

    // backlinks: entities that link TO this entity
    for (const n of notes) {
      if (n.id === entityId || seen.has(n.id)) continue;
      if (n.wikilinks.includes(entityId)) {
        seen.add(n.id);
        result.push({ id: n.id, type: n.type, title: n.title, relation: "backlink" });
      }
    }
  }

  collect(target, 1);
  return result;
}

export function getUntoldStories(limit = 5): UntoldStory[] {
  const notes = loadVault();

  const untold = notes
    .filter((n) => {
      const isStoryType = n.type === "event" || n.type === "story";
      const notPosted = n.posted !== true;
      return isStoryType && notPosted;
    })
    .map((n) => {
      // Count connections: outgoing wikilinks + backlinks
      const backlinks = notes.filter(
        (other) => other.id !== n.id && other.wikilinks.includes(n.id)
      ).length;
      const connections = n.wikilinks.length + backlinks;

      const relatedEntities = [
        ...n.wikilinks,
        ...notes
          .filter((other) => other.id !== n.id && other.wikilinks.includes(n.id))
          .map((other) => other.id),
      ];

      return {
        id: n.id,
        type: n.type,
        title: n.title,
        snippet: snippet(n.content),
        connections,
        relatedEntities: [...new Set(relatedEntities)],
      };
    })
    .sort((a, b) => b.connections - a.connections)
    .slice(0, limit);

  return untold;
}
