"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/shared/Navbar";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// --- Types ---
interface GraphNode {
  id: string;
  label: string;
  type: string;
  posted?: boolean | null;
  confidence?: string;
  tags?: string[];
  connections: number;
}
interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    untoldStories: number;
    byType: Record<string, number>;
  };
}

// --- Constants ---
const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#f97316",
  event: "#eab308",
  concept: "#a855f7",
  story: "#ec4899",
  post: "#22c55e",
  product: "#f87171",
};
const DEFAULT_COLOR = "#6b7280";

const ENTITY_TYPES = ["person", "organization", "event", "concept", "story", "post", "product"];

function colorFor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? DEFAULT_COLOR;
}

function nodeSize(connections: number) {
  return Math.min(10, Math.max(3, 3 + connections * 0.8));
}

// --- Component ---
export default function KnowledgePage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      const data: GraphData = await res.json();
      // Filter out unknown/non-entity nodes (e.g. README)
      data.nodes = data.nodes.filter((n) => ENTITY_TYPES.includes(n.type.toLowerCase()));
      const validIds = new Set(data.nodes.map((n) => n.id));
      data.edges = data.edges.filter((e) => validIds.has(e.source) && validIds.has(e.target));
      // Recalc stats
      data.stats.totalNodes = data.nodes.length;
      data.stats.totalEdges = data.edges.length;
      delete data.stats.byType["unknown"];
      setGraph(data);
    } catch {
      setGraph({
        nodes: [],
        edges: [],
        stats: { totalNodes: 0, totalEdges: 0, untoldStories: 0, byType: {} },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Configure forces after graph mounts
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;
      fg.d3Force("charge")?.strength(-2000).distanceMax(800);
      fg.d3Force("link")?.distance(300);
      fg.d3Force("center")?.strength(0.02);
      fg.d3Force("collide", null);
      setTimeout(() => fg.zoomToFit(400, 80), 800);
    }
  }, [graph, loading]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Filtered data — memoized so hover re-renders don't restart the simulation
  const filtered = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    const nodes = graph.nodes.filter((n) => activeTypes.has(n.type.toLowerCase()));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graph.edges.filter((e) => {
      const sId = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
      const tId = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
      return nodeIds.has(sId) && nodeIds.has(tId);
    });
    return { nodes, links };
  }, [graph, activeTypes]);

  const searchLower = search.toLowerCase();
  const matchIds = new Set(
    search
      ? filtered.nodes
          .filter(
            (n) =>
              n.label.toLowerCase().includes(searchLower) ||
              n.id.toLowerCase().includes(searchLower) ||
              (n.tags ?? []).some((t) => t.toLowerCase().includes(searchLower))
          )
          .map((n) => n.id)
      : []
  );

  // Connected nodes for selected
  const connectedNodes = selected && graph
    ? graph.edges
        .filter((e) => {
          const sId = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
          const tId = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
          return sId === selected.id || tId === selected.id;
        })
        .map((e) => {
          const sId = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
          const tId = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
          const otherId = sId === selected.id ? tId : sId;
          const other = graph.nodes.find((n) => n.id === otherId);
          return { id: otherId, label: other?.label ?? otherId, type: other?.type ?? "unknown", relation: e.relation };
        })
    : [];

  return (
    <main className="flex h-screen flex-col text-gray-200" style={{ background: "var(--bg-base)" }}>
      <Navbar activeTab="knowledge" />

      {/* Controls bar */}
      <div className="shrink-0 border-b border-[#1a1a1a] px-6 py-2.5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150"
                style={{
                  borderColor: activeTypes.has(type) ? colorFor(type) : "#1a1a1a",
                  backgroundColor: activeTypes.has(type) ? colorFor(type) + "18" : "transparent",
                  color: activeTypes.has(type) ? colorFor(type) : "#555",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorFor(type) }}
                />
                {type}
                {graph && (
                  <span className="text-[10px] opacity-60">
                    {graph.stats.byType[type] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="ml-auto rounded border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-[#333] focus:outline-none transition-colors w-48"
          />

          {/* Refresh */}
          <button
            onClick={fetchGraph}
            disabled={loading}
            className="rounded border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs font-medium text-gray-400 hover:border-[#333] hover:text-gray-300 disabled:opacity-40 transition-colors"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Graph */}
        <div ref={containerRef} className="relative flex-1 min-h-[300px] bg-[#0f172a]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
            </div>
          )}
          {!loading && filtered.nodes.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-gray-500">
              <p className="text-sm font-medium">No nodes to display</p>
              <p className="text-xs text-gray-600 mt-1">
                {graph && graph.nodes.length > 0
                  ? "Adjust type filters to show nodes"
                  : "Graph is empty -- populate the vault first"}
              </p>
            </div>
          )}
          {!loading && filtered.nodes.length > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.w}
              height={dimensions.h}
              graphData={filtered}
              nodeId="id"
              nodeLabel=""
              nodeCanvasObject={(node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const n = node as unknown as GraphNode & { x: number; y: number };
                const r = nodeSize(n.connections) / globalScale;
                const color = colorFor(n.type);
                const isMatch = search && matchIds.has(n.id);
                const isSelected = selected?.id === n.id;
                const isHovered = hoveredNode === n.id;
                const showLabel = isHovered || isSelected || isMatch || n.connections >= 8 || globalScale > 1.5;

                // Pulsing ring for unposted events/stories
                if (n.posted === false) {
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r + 4 / globalScale, 0, 2 * Math.PI);
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 1.5 / globalScale;
                  ctx.globalAlpha = 0.4 + 0.3 * Math.sin(Date.now() / 400);
                  ctx.stroke();
                  ctx.globalAlpha = 1;
                }

                // Node circle
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                ctx.fillStyle = isSelected ? "#fff" : color;
                ctx.globalAlpha = isMatch ? 1 : search ? 0.12 : 0.9;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Highlight ring
                if (isMatch || isSelected || isHovered) {
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r + 2.5 / globalScale, 0, 2 * Math.PI);
                  ctx.strokeStyle = isSelected ? "#fff" : isHovered ? color : "#fff";
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }

                // Label — only show when relevant
                if (showLabel) {
                  const fontSize = Math.max(11 / globalScale, 2.5);
                  ctx.font = `500 ${fontSize}px sans-serif`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillStyle = isMatch || isSelected || isHovered ? "#fff" : "rgba(255,255,255,0.75)";
                  ctx.fillText(n.label, n.x, n.y + r + 3 / globalScale);
                }
              }}
              onNodeHover={(node: Record<string, unknown> | null) => {
                setHoveredNode(node ? (node as unknown as GraphNode).id : null);
              }}
              linkColor={() => "rgba(255,255,255,0.06)"}
              linkWidth={0.5}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              onNodeClick={(node: Record<string, unknown>) => {
                setSelected(node as unknown as GraphNode);
              }}
              onBackgroundClick={() => setSelected(null)}
              backgroundColor="#0f172a"
              cooldownTicks={200}
              d3AlphaDecay={0.01}
              d3VelocityDecay={0.3}
              warmupTicks={50}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 overflow-y-auto border-t border-[#1a1a1a] bg-[#0a0a0a] p-5 lg:w-[350px] lg:border-l lg:border-t-0">
          {selected ? (
            <div>
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-white break-words">
                  {selected.label}
                </h2>
                <button
                  onClick={() => setSelected(null)}
                  className="shrink-0 rounded p-1 text-gray-600 hover:text-gray-400 transition-colors text-sm"
                >
                  x
                </button>
              </div>

              {/* Badges */}
              <div className="mb-4 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: colorFor(selected.type) + "20",
                    color: colorFor(selected.type),
                  }}
                >
                  {selected.type}
                </span>
                {selected.confidence && (
                  <span className="rounded-full bg-[#111] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border border-[#1a1a1a]">
                    {selected.confidence}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    selected.posted
                      ? "bg-emerald-500/10 text-emerald-400"
                      : selected.posted === false
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-[#111] text-gray-500 border border-[#1a1a1a]"
                  }`}
                >
                  {selected.posted === true
                    ? "Posted"
                    : selected.posted === false
                    ? "Unposted"
                    : "N/A"}
                </span>
              </div>

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div className="mb-4">
                  <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-[#111] px-2 py-0.5 text-[11px] text-gray-400 border border-[#1a1a1a]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connections */}
              <div>
                <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                  Connections ({connectedNodes.length})
                </h4>
                {connectedNodes.length === 0 ? (
                  <p className="text-xs text-gray-600">No connections</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {connectedNodes.map((cn, i) => (
                      <div
                        key={`${cn.id}-${cn.relation}-${i}`}
                        className="flex items-center gap-2 rounded bg-[#111] px-3 py-2 text-xs border border-[#1a1a1a]"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(cn.type) }}
                        />
                        <span className="text-gray-300 flex-1 truncate">
                          {cn.label}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {cn.relation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-600">
                Graph Stats
              </h2>
              {graph ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Nodes" value={graph.stats.totalNodes} />
                    <StatCard label="Edges" value={graph.stats.totalEdges} />
                    <StatCard label="Untold" value={graph.stats.untoldStories} />
                    <StatCard label="Types" value={Object.keys(graph.stats.byType).length} />
                  </div>

                  {Object.keys(graph.stats.byType).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                        By Type
                      </h4>
                      <div className="flex flex-col gap-1">
                        {Object.entries(graph.stats.byType).map(([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between rounded bg-[#111] px-3 py-2 text-xs border border-[#1a1a1a]"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: colorFor(type) }}
                              />
                              <span className="text-gray-400">{type}</span>
                            </div>
                            <span className="font-mono text-gray-500">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">Loading...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#1a1a1a] bg-[#111] p-3 text-center">
      <div className="text-xl font-bold text-white font-mono">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mt-0.5">
        {label}
      </div>
    </div>
  );
}
