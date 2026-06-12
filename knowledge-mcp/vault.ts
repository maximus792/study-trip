import { readFileSync } from "fs";
import { basename, join, relative, dirname } from "path";
import { globSync } from "glob";
import matter from "gray-matter";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TypedRelation {
  relation: string;
  target: string;
}

export interface VaultEntity {
  id: string;
  type: string;
  title: string;
  folder: string;
  frontmatter: Record<string, unknown>;
  content: string;
  wikilinks: string[];
  relations: TypedRelation[];
}

// ── Regex patterns ───────────────────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const TYPED_RELATION_RE = /^(\w+)::\s*\[\[([^\]]+)\]\]/gm;

// ── Vault reader ─────────────────────────────────────────────────────────────

let cachedEntities: VaultEntity[] | null = null;

function parseFile(filePath: string, vaultRoot: string): VaultEntity {
  const raw = readFileSync(filePath, "utf-8");
  const { data: frontmatter, content } = matter(raw);

  const id = basename(filePath, ".md");
  const folder = relative(vaultRoot, dirname(filePath)) || ".";

  // Extract all wikilinks from the full body (content after frontmatter)
  const wikilinks: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const target = match[1].trim();
    if (target && !wikilinks.includes(target)) {
      wikilinks.push(target);
    }
  }

  // Extract typed relations (e.g. `related_to:: [[target]]`)
  const relations: TypedRelation[] = [];
  TYPED_RELATION_RE.lastIndex = 0;
  while ((match = TYPED_RELATION_RE.exec(content)) !== null) {
    const relation = match[1].trim();
    const target = match[2].trim();
    if (relation && target) {
      relations.push({ relation, target });
    }
  }

  return {
    id,
    type: (frontmatter.type as string) || "unknown",
    title: (frontmatter.title as string) || id,
    folder,
    frontmatter,
    content,
    wikilinks,
    relations,
  };
}

export function readVault(vaultRoot: string): VaultEntity[] {
  const pattern = join(vaultRoot, "**", "*.md");
  const files = globSync(pattern, { nodir: true });

  const entities = files
    .filter((f) => !f.includes("_templates"))
    .map((f) => parseFile(f, vaultRoot));

  cachedEntities = entities;
  return entities;
}

export function getCachedEntities(): VaultEntity[] | null {
  return cachedEntities;
}

export function clearCache(): void {
  cachedEntities = null;
}
