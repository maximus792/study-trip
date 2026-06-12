# 3Doshas Knowledge Graph — Design Spec

## Overview

A knowledge graph (KG) for the 3Doshas brand implemented as an Obsidian vault, served by a local MCP server, with a visual graph tab in the linkedin-agent dashboard. The KG drives content strategy by surfacing untold stories and real experiences to the agent pipeline.

## Architecture

```
knowledge/                  # Obsidian vault (source of truth)
knowledge-mcp/              # Local MCP server serving the vault
linkedin-agent/             # Existing Next.js app (adds KG tab + kg-extractor)
```

## 1. Vault Structure

Location: `./knowledge/` at project root.

### Folders & Entity Types

| Folder | Type | Key Fields |
|--------|------|------------|
| `people/` | person | role, affiliation, relationship to 3Doshas |
| `organizations/` | organization | type (corporate/university/media), partnership details |
| `events/` | event | date, location, status, posted flag |
| `concepts/` | concept | definition, related doshas |
| `stories/` | story | narrative summary, emotional beat, posted flag |
| `posts/` | post | date, platform, engagement metrics if known |
| `products/` | product | tier, price, description |

### Frontmatter Schema (all entities)

```yaml
---
type: <entity_type>
title: "Human-readable title"
confidence: high | medium | low
posted: true | false | null
tags: [tag1, tag2]
created: 2026-06-12
updated: 2026-06-12
sources: [url1, url2]
---
```

### Relationships

- Wikilinks in body text: `[[sumeet-syal]]`, `[[inner-intelligence]]`
- Typed relations: `hosted_by:: [[fhnw]]`

## 2. Graph Visualization

New tab in linkedin-agent at `/knowledge`.

### graph.json

```json
{
  "nodes": [{ "id", "label", "type", "posted", "confidence", "tags", "connections" }],
  "edges": [{ "source", "target", "relation" }],
  "stats": { "totalNodes", "totalEdges", "untoldStories", "byType": {} },
  "generatedAt": "ISO timestamp"
}
```

### UI

- react-force-graph-2d, nodes colored by type, sized by connections
- Unposted events/stories get visual badge
- Click node → sidebar with entity detail
- Filter by type, posted status, search

## 3. Local MCP Server

Location: `./knowledge-mcp/`

### Tools

| Tool | Purpose |
|------|---------|
| `search_knowledge` | Full-text search across vault |
| `get_entity` | Read single entity |
| `get_related` | Connected nodes 1-2 hops |
| `get_untold_stories` | Events/stories where posted=false |
| `rebuild_graph` | Re-scan vault, regenerate graph.json |

Stdio transport, @modelcontextprotocol/sdk.

## 4. Initial Population

1. Wave 1 — 3doshas.com crawl (confidence: high)
2. Wave 2 — Sumeet's LinkedIn posts (confidence: high)
3. Wave 3 — External/media/university sources (confidence: medium)

Target: 50-150 entities.

## 5. Pipeline Changes

```
researcher (web) → ideator ← get_untold_stories + search_knowledge
                       ↓
                  copywriter ← get_entity + get_related
                       ↓
                  kg-extractor → vault → rebuild_graph
```

## 6. kg-extractor Agent

Post-approval: parses content, creates/updates entities, sets posted=true, creates posts/ entry, calls rebuild_graph.
