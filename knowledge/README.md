# 3Doshas Brand Knowledge Graph

Obsidian vault for the 3Doshas career coaching brand, which applies Ayurvedic dosha principles (Vata, Pitta, Kapha) to professional development.

## Vault Structure

| Folder | Entity Type | Description |
|--------|-------------|-------------|
| `people/` | person | Coaches, clients, collaborators, speakers |
| `organizations/` | organization | Companies, universities, media outlets, partners |
| `events/` | event | Workshops, talks, retreats, webinars |
| `concepts/` | concept | Dosha principles, coaching frameworks, Ayurvedic ideas |
| `stories/` | story | Client testimonials, origin stories, case studies |
| `posts/` | post | Social media and blog content across platforms |
| `products/` | product | Coaching packages, courses, digital products |
| `_templates/` | -- | Obsidian templates for each entity type |

## Schema

Every note uses YAML frontmatter with these common fields:

- **type** -- entity type matching the folder
- **title** -- display name
- **confidence** -- high, medium, or low
- **tags** -- freeform tag list
- **created** / **updated** -- timestamps
- **sources** -- provenance URLs or references

Each type adds its own fields (see `_templates/` for the full schema per type).

## Relationships

Relationships are expressed as Dataview inline fields using the `key:: [[Target]]` syntax:

- `affiliated_with`, `mentored_by`, `collaborated_with` (people)
- `partnered_with`, `employs`, `hosted_event` (organizations)
- `hosted_by`, `featured`, `concepts_taught` (events)
- `related_to`, `taught_at`, `referenced_in` (concepts)
- `features`, `illustrates`, `published_as` (stories)
- `authored_by`, `references`, `promotes` (posts)
- `created_by`, `uses_concept`, `promoted_in` (products)

## Graph View

The `.obsidian/graph.json` assigns a distinct color to each entity folder so node types are visually distinguishable in the graph view.
