import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import { existsSync } from "fs";
import {
  initTools,
  searchKnowledge,
  getEntity,
  getRelated,
  getUntoldStories,
  rebuildGraph,
  type SearchInput,
  type GetEntityInput,
  type GetRelatedInput,
  type GetUntoldStoriesInput,
} from "./tools.js";

// ── Vault path resolution ────────────────────────────────────────────────────

const VAULT_ROOT = resolve(
  process.env.VAULT_PATH || new URL("../knowledge", import.meta.url).pathname
);

if (!existsSync(VAULT_ROOT)) {
  console.error(`Vault directory not found: ${VAULT_ROOT}`);
  console.error("Set VAULT_PATH environment variable or ensure ../knowledge/ exists.");
  process.exit(1);
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "3doshas-knowledge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_knowledge",
      description:
        "Search the 3Doshas knowledge graph by keyword. Searches across titles, content, and tags. Optionally filter by entity type (concept, person, event, organization, story, product, post).",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search term (case-insensitive)",
          },
          type: {
            type: "string",
            description:
              "Optional entity type filter: concept, person, event, organization, story, product, post",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_entity",
      description:
        "Get the full content of a knowledge graph entity by its ID (filename without .md). Returns frontmatter, body content, wikilinks, and typed relations.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Entity ID (filename without .md extension)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "get_related",
      description:
        "Get entities related to a given entity by following wikilinks and typed relations. Traverses both outgoing and incoming links up to the specified depth.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Entity ID to find relations for",
          },
          depth: {
            type: "number",
            description: "How many hops to follow (default 1, max 2)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "get_untold_stories",
      description:
        "Get events and stories that have not been posted yet (posted: false), sorted by connection count. Useful for finding high-value content opportunities.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of results (default 10)",
          },
        },
        required: [],
      },
    },
    {
      name: "rebuild_graph",
      description:
        "Re-read the Obsidian vault from disk, rebuild the knowledge graph, and write an updated graph.json. Use after vault edits.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  ],
}));

// ── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_knowledge": {
        const result = searchKnowledge(args as unknown as SearchInput);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_entity": {
        const result = getEntity(args as unknown as GetEntityInput);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_related": {
        const result = getRelated(args as unknown as GetRelatedInput);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_untold_stories": {
        const result = getUntoldStories(args as unknown as GetUntoldStoriesInput);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "rebuild_graph": {
        const stats = rebuildGraph();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { message: "Graph rebuilt successfully", stats },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Startup ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Build initial graph on startup
  const stats = initTools(VAULT_ROOT);
  console.error(`[3doshas-knowledge] Vault loaded from: ${VAULT_ROOT}`);
  console.error(`[3doshas-knowledge] ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
  console.error(`[3doshas-knowledge] Types: ${JSON.stringify(stats.byType)}`);
  console.error(`[3doshas-knowledge] Untold stories: ${stats.untoldStories}`);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[3doshas-knowledge] Fatal error:", error);
  process.exit(1);
});
