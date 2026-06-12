import type { VaultEntity } from "./vault.js";
import { readVault, getCachedEntities, clearCache } from "./vault.js";
import { buildGraph, writeGraphJson, type Graph, type GraphStats } from "./graph.js";

// ── State ────────────────────────────────────────────────────────────────────

let currentGraph: Graph | null = null;
let vaultRoot: string;

export function initTools(root: string): GraphStats {
  vaultRoot = root;
  const entities = readVault(vaultRoot);
  currentGraph = buildGraph(entities);
  writeGraphJson(currentGraph, vaultRoot);
  return currentGraph.stats;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEntities(): VaultEntity[] {
  return getCachedEntities() || readVault(vaultRoot);
}

function snippet(content: string, query: string, maxLen: number = 200): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) {
    return content.slice(0, maxLen).trim() + (content.length > maxLen ? "..." : "");
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 140);
  const fragment = content.slice(start, end).trim();
  return (start > 0 ? "..." : "") + fragment + (end < content.length ? "..." : "");
}

// ── Tool: search_knowledge ───────────────────────────────────────────────────

export interface SearchInput {
  query: string;
  type?: string;
}

export function searchKnowledge(input: SearchInput): object {
  const entities = getEntities();
  const q = input.query.toLowerCase();

  let filtered = entities;
  if (input.type) {
    const t = input.type.toLowerCase();
    filtered = filtered.filter((e) => e.type.toLowerCase() === t);
  }

  const scored = filtered
    .map((entity) => {
      let score = 0;
      const titleLower = entity.title.toLowerCase();
      const idLower = entity.id.toLowerCase();
      const contentLower = entity.content.toLowerCase();
      const tags = Array.isArray(entity.frontmatter.tags)
        ? (entity.frontmatter.tags as string[]).map((t) => t.toLowerCase())
        : [];

      // Title match (highest weight)
      if (titleLower === q) score += 100;
      else if (titleLower.includes(q)) score += 50;

      // ID match
      if (idLower.includes(q)) score += 30;

      // Tag match
      if (tags.some((tag) => tag.includes(q))) score += 40;

      // Content match
      if (contentLower.includes(q)) score += 10;

      return { entity, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    count: scored.length,
    results: scored.map(({ entity }) => ({
      id: entity.id,
      type: entity.type,
      title: entity.title,
      snippet: snippet(entity.content, input.query),
      confidence: entity.frontmatter.confidence || "unknown",
      posted: entity.frontmatter.posted ?? null,
    })),
  };
}

// ── Tool: get_entity ─────────────────────────────────────────────────────────

export interface GetEntityInput {
  id: string;
}

export function getEntity(input: GetEntityInput): object {
  const entities = getEntities();
  const entity = entities.find(
    (e) => e.id.toLowerCase() === input.id.toLowerCase()
  );

  if (!entity) {
    return { error: `Entity "${input.id}" not found` };
  }

  return {
    id: entity.id,
    type: entity.type,
    title: entity.title,
    folder: entity.folder,
    frontmatter: entity.frontmatter,
    content: entity.content,
    wikilinks: entity.wikilinks,
    relations: entity.relations,
  };
}

// ── Tool: get_related ────────────────────────────────────────────────────────

export interface GetRelatedInput {
  id: string;
  depth?: number;
}

interface RelatedEntity {
  id: string;
  type: string;
  title: string;
  relation: string;
  direction: "outgoing" | "incoming";
  depth: number;
}

export function getRelated(input: GetRelatedInput): object {
  const entities = getEntities();
  const maxDepth = Math.min(input.depth || 1, 2);

  const entityMap = new Map(entities.map((e) => [e.id.toLowerCase(), e]));
  const rootEntity = entityMap.get(input.id.toLowerCase());

  if (!rootEntity) {
    return { error: `Entity "${input.id}" not found` };
  }

  const visited = new Set<string>([rootEntity.id.toLowerCase()]);
  const results: RelatedEntity[] = [];

  // BFS traversal
  let frontier: Array<{ id: string; depth: number }> = [
    { id: rootEntity.id, depth: 0 },
  ];

  while (frontier.length > 0) {
    const nextFrontier: Array<{ id: string; depth: number }> = [];

    for (const { id, depth } of frontier) {
      if (depth >= maxDepth) continue;

      const entity = entityMap.get(id.toLowerCase());
      if (!entity) continue;

      // Outgoing: wikilinks and typed relations
      for (const rel of entity.relations) {
        const targetKey = rel.target.toLowerCase();
        if (!visited.has(targetKey)) {
          visited.add(targetKey);
          const target = entityMap.get(targetKey);
          results.push({
            id: rel.target,
            type: target?.type || "unknown",
            title: target?.title || rel.target,
            relation: rel.relation,
            direction: "outgoing",
            depth: depth + 1,
          });
          nextFrontier.push({ id: rel.target, depth: depth + 1 });
        }
      }

      // Outgoing plain wikilinks
      const typedTargets = new Set(entity.relations.map((r) => r.target.toLowerCase()));
      for (const link of entity.wikilinks) {
        const linkKey = link.toLowerCase();
        if (!typedTargets.has(linkKey) && !visited.has(linkKey)) {
          visited.add(linkKey);
          const target = entityMap.get(linkKey);
          results.push({
            id: link,
            type: target?.type || "unknown",
            title: target?.title || link,
            relation: "references",
            direction: "outgoing",
            depth: depth + 1,
          });
          nextFrontier.push({ id: link, depth: depth + 1 });
        }
      }

      // Incoming: other entities that link to this one
      for (const other of entities) {
        if (visited.has(other.id.toLowerCase())) continue;

        // Check typed relations pointing to current entity
        for (const rel of other.relations) {
          if (rel.target.toLowerCase() === id.toLowerCase()) {
            const otherKey = other.id.toLowerCase();
            if (!visited.has(otherKey)) {
              visited.add(otherKey);
              results.push({
                id: other.id,
                type: other.type,
                title: other.title,
                relation: rel.relation,
                direction: "incoming",
                depth: depth + 1,
              });
              nextFrontier.push({ id: other.id, depth: depth + 1 });
            }
          }
        }

        // Check plain wikilinks pointing to current entity
        if (other.wikilinks.some((w) => w.toLowerCase() === id.toLowerCase())) {
          const otherKey = other.id.toLowerCase();
          if (!visited.has(otherKey)) {
            visited.add(otherKey);
            results.push({
              id: other.id,
              type: other.type,
              title: other.title,
              relation: "referenced_by",
              direction: "incoming",
              depth: depth + 1,
            });
            nextFrontier.push({ id: other.id, depth: depth + 1 });
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return {
    id: rootEntity.id,
    type: rootEntity.type,
    title: rootEntity.title,
    depth: maxDepth,
    relatedCount: results.length,
    related: results,
  };
}

// ── Tool: get_untold_stories ─────────────────────────────────────────────────

export interface GetUntoldStoriesInput {
  limit?: number;
}

export function getUntoldStories(input: GetUntoldStoriesInput): object {
  const entities = getEntities();
  const graph = currentGraph || buildGraph(entities);
  const limit = input.limit || 10;

  // Find nodes that are events or stories with posted=false
  const untold = graph.nodes
    .filter(
      (node) =>
        (node.type === "event" || node.type === "story") && node.posted === false
    )
    .sort((a, b) => b.connections - a.connections)
    .slice(0, limit);

  return {
    count: untold.length,
    stories: untold.map((node) => {
      const entity = entities.find(
        (e) => e.id.toLowerCase() === node.id.toLowerCase()
      );
      return {
        id: node.id,
        type: node.type,
        title: node.label,
        connections: node.connections,
        tags: node.tags,
        confidence: node.confidence,
        snippet: entity
          ? entity.content.slice(0, 200).trim() +
            (entity.content.length > 200 ? "..." : "")
          : "",
      };
    }),
  };
}

// ── Tool: rebuild_graph ──────────────────────────────────────────────────────

export function rebuildGraph(): GraphStats {
  clearCache();
  const entities = readVault(vaultRoot);
  currentGraph = buildGraph(entities);
  writeGraphJson(currentGraph, vaultRoot);
  return currentGraph.stats;
}
