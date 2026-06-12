import { writeFileSync } from "fs";
import { join } from "path";
import type { VaultEntity } from "./vault.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  folder: string;
  posted: boolean | null;
  confidence: string;
  tags: string[];
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  untoldStories: number;
  byType: Record<string, number>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

// ── Graph builder ────────────────────────────────────────────────────────────

export function buildGraph(entities: VaultEntity[]): Graph {
  const entityIds = new Set(entities.map((e) => e.id));
  const edges: GraphEdge[] = [];

  for (const entity of entities) {
    // Typed relations get their specific relation name
    for (const rel of entity.relations) {
      edges.push({
        source: entity.id,
        target: rel.target,
        relation: rel.relation,
      });
    }

    // Plain wikilinks that are NOT already covered by a typed relation
    const typedTargets = new Set(entity.relations.map((r) => r.target));
    for (const link of entity.wikilinks) {
      if (!typedTargets.has(link)) {
        edges.push({
          source: entity.id,
          target: link,
          relation: "references",
        });
      }
    }
  }

  // Count connections per node (both directions)
  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  }

  const nodes: GraphNode[] = entities.map((entity) => {
    const fm = entity.frontmatter;
    const tags: string[] = Array.isArray(fm.tags) ? (fm.tags as string[]) : [];
    const posted = typeof fm.posted === "boolean" ? fm.posted : null;
    const confidence = (fm.confidence as string) || "unknown";

    return {
      id: entity.id,
      label: entity.title || entity.id,
      type: entity.type,
      folder: entity.folder,
      posted,
      confidence,
      tags,
      connections: connectionCounts.get(entity.id) || 0,
    };
  });

  // Stats
  const byType: Record<string, number> = {};
  for (const node of nodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
  }

  const untoldStories = nodes.filter(
    (n) => (n.type === "event" || n.type === "story") && n.posted === false
  ).length;

  const stats: GraphStats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    untoldStories,
    byType,
  };

  return { nodes, edges, stats };
}

export function writeGraphJson(graph: Graph, vaultRoot: string): void {
  const outputPath = join(vaultRoot, "graph.json");
  writeFileSync(outputPath, JSON.stringify(graph, null, 2), "utf-8");
}
