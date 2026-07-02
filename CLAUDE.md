# CLAUDE.md — ParkerTech Portfolio repo

Two things live in this repo:

1. **The ParkerTech public website** (`src/`, `public/`, `astro.config.mjs`, etc.) — Astro static site at `parkertech.co.uk`, hosted on GitHub Pages.
2. **`cc-mcp/`** — the Model Context Protocol server that exposes Joseph's Obsidian vault (persistent memory) to Claude. It historically also exposed the Command Centre (Firestore CRM), but **CC was retired 2026-07-02** — see vault `Knowledge/Decisions/Drop-Command-Centre-vault-becomes-the-whole-brain-20260702.md`. Only the `vault_*` tools matter now; the Firestore tools await removal.

Joseph runs Claude from this dir most often. The **vault CLAUDE.md** at `/Users/jelst/Documents/Obsidian/ParkerTechFire/CLAUDE.md` is the wider operating manual — this CLAUDE.md is the repo-local layer.

## Layout

| Path | What | Notes |
|---|---|---|
| `src/` | Astro site source | TypeScript + React 19 + Tailwind 4 |
| `src/data/site.ts` | Site content (name, role, contact, hero, bio, stats) | Edit here, no HTML needed |
| `public/` | Static assets served as-is | |
| `dist/` | Build output (committed for GH Pages) | DO NOT hand-edit |
| `astro.config.mjs` | Astro build config | |
| `firebase.json`, `firestore.rules`, `.firebaserc` | Firebase config for CC data layer | |
| `cc-mcp/` | MCP server (self-contained TS project) | See `cc-mcp/README.md` |
| `cc-mcp/index.ts` | All MCP tools registered here | ~33KB; mirror existing register-pattern when adding |
| `cc-mcp/hooks/` | Claude Code session hooks | `save-session.ts` (SessionEnd), `session-start.ts` (SessionStart), `pre-compact.ts` (PreCompact) |

## Commands

### Astro site (this repo's root)

```bash
npm install                    # one-time
npm run dev                    # local dev server (usually http://localhost:4321)
npm run build                  # build to dist/
npm run preview                # preview built site
```

Deployment is via the workflow in `.github/workflows/`. Push to `main` → site updates.

### cc-mcp server

```bash
cd cc-mcp
npm install                    # one-time
npx tsc --noEmit               # type-check before commit
# Server itself is launched by the MCP client (Claude Desktop / Code), not run by hand.
```

When adding a new MCP tool: copy the structure of an existing one in `index.ts` (e.g. `add_correspondence`, `create_project`). Zod schema first, then async handler. Returns `ok(...)` / `err(...)` helpers.

## Conventions

- **TypeScript everywhere.** No JS files in `src/`.
- **Astro components** in `.astro` files; React only where interactivity is needed.
- **British spelling, plain English** in any copy (matches Joseph's voice).
- **Tailwind 4 (Vite plugin)** — utility-first; no separate CSS files for components.
- **cc-mcp tools follow the Zod-schema-then-handler pattern.** See `index.ts` for examples.
- **Commit messages**: short imperative, no marketing language. See `git log --oneline` for the house style.

## Honest constraints

- **GH Pages serves `dist/`**, so committed builds matter. Run `npm run build` before pushing if you've changed source.
- **cc-mcp hook paths are absolute** in `~/.claude/settings.json` (`/Users/jelst/Documents/ParkerTech Portfolio/cc-mcp/hooks/*`). If you move this repo, update those paths.
- **The vault is the long-term memory.** When you make a substantive change here, consider whether a Knowledge note in the vault would help future sessions. cc-mcp's `vault_write_knowledge` is the tool.
- **Don't paste secrets** into cc-mcp source or commits. Firebase Admin uses Application Default Credentials.
- **Command Centre is retired (2026-07-02).** Don't use the cc-mcp Firestore tools (`add_task`, `add_correspondence`, `list_clients`, …) or propose CC features. Structured data (clients, projects, tasks, correspondence) is markdown in the vault. Firestore stays as a read-only safety net until ~Aug 2026, then gets deleted; final export archived at vault `Claude-Backup/firestore-final-export-2026-07-02.json`. Invoicing lives in Monzo.

## Where state lives

- **Codebase facts:** here + `README.md` + `cc-mcp/README.md`.
- **Joseph's identity + workflow rules:** vault CLAUDE.md.
- **Current engagements + project IDs:** auto-memory `~/.claude/projects/-Users-jelst-Documents-ParkerTech-Portfolio/memory/MEMORY.md`.
- **Decisions + patterns + mistakes:** vault `Knowledge/`.
- **Per-session continuity:** SessionStart hook injects breadcrumbs; SessionEnd hook saves transcripts to `Daily/Claude-Sessions/`.
