import fs from "fs";
import path from "path";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  posted?: boolean | null;
  confidence?: string;
  tags?: string[];
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    untoldStories: number;
    byType: Record<string, number>;
  };
}

const GRAPH_PATH = path.resolve(process.cwd(), "../knowledge/graph.json");

const EMPTY_GRAPH: GraphData = {
  nodes: [],
  edges: [],
  stats: { totalNodes: 0, totalEdges: 0, untoldStories: 0, byType: {} },
};

export function loadGraphData(): GraphData {
  try {
    const raw = fs.readFileSync(GRAPH_PATH, "utf-8");
    return JSON.parse(raw) as GraphData;
  } catch {
    return EMPTY_GRAPH;
  }
}
