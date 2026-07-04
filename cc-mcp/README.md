# parkertech-vault-mcp

A small **MCP server** that exposes Joseph's Obsidian vault (`~/Documents/Obsidian/ParkerTechFire`) to Claude as tools — search, read, and structured writes for Knowledge notes, Daily entries, and raw sources.

> **History:** until 2026-07-02 this server also exposed the ParkerTech Command Centre (Firestore CRM). The CC was retired — see the vault note `Knowledge/Decisions/Drop-Command-Centre-vault-becomes-the-whole-brain-20260702.md`. The Firestore half was stripped in v0.2.0; the final data export lives at vault `Claude-Backup/firestore-final-export-2026-07-02.json`. (The pre-strip source is in git history.)

## Architecture in one sentence

Claude calls tools over stdio → this Node process runs locally on the Mac → reads/writes markdown in the vault working copy → vault writes auto-commit and push to the private GitHub repo.

## One-time setup

### 1. Install dependencies

```bash
cd ~/Documents/ParkerTech\ Portfolio/cc-mcp
npm install
```

### 2. Wire Claude to the server

Add this stanza to your Claude MCP configuration:

- **Claude Code CLI** — edit `~/.claude.json` (or use `claude mcp add`):
  ```json
  {
    "mcpServers": {
      "parkertech-vault": {
        "command": "npx",
        "args": ["-y", "tsx", "/Users/jelst/Documents/ParkerTech Portfolio/cc-mcp/index.ts"]
      }
    }
  }
  ```
- **Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` with the same shape.

Restart Claude after editing.

### 3. Sanity check

```bash
cd ~/Documents/Obsidian/ParkerTechFire
claude
> search the vault for "Wonde"
```

Claude should call `vault_search` and return matching note paths.

## Tool reference

- `vault_search(query, folder?)` — grep the vault (fixed-string by default). **Use this first** — it's the cheap path (~0.5k tokens vs ~8k for scanning the index).
- `vault_read(path)` — read a vault file
- `vault_list(folder?)` — list entries in a vault folder
- `vault_write_knowledge(category, title, body, tags?, related?)` — create or overwrite a Knowledge note. Categories: `Patterns | Decisions | Context | Mistakes | Systems | People | General`
- `vault_append_knowledge(category, title, sectionHeading, body)` — grow a Knowledge note over time without overwriting
- `vault_append_daily(heading, body)` — append a timestamped section to today's Daily journal
- `vault_save_raw_source(...)` — file an unprocessed source into `raw/` for a later ingest pass
- `vault_rebuild_index()` — regenerate `Knowledge/Index.md` after a batch of writes
- `save_conversation_snapshot(...)` — save a structured transcript (used by `/save` and end-session flows on Desktop)

Tool writes are sandboxed to `Knowledge/`, `Daily/`, `Inbox/`, and `raw/`. Other folders (`Clients/`, `Projects/`, `Correspondence/`, `Quotes/`) are Claude-authored too since the CC retirement, but via Claude Code's own file tools when running on the Mac — keep the existing file formats.

## Updating the server

Edit `index.ts`. Type-check with `npx tsc --noEmit` before committing. Claude re-runs the server fresh each launch — no build step, `tsx` runs TypeScript directly.

## Auto-save every Claude session to the vault

A SessionEnd hook in `hooks/save-session.ts` reads each finished session's transcript, distils it down to the plain user/assistant turns, and writes a markdown file at `Daily/Claude-Sessions/{date}-{cwd-slug}-{session_id:8}.md` in the vault. The cwd-slug makes coding sessions easy to identify amongst the rest. The script also `git commit && git push` from the vault repo so the file is on GitHub immediately — Obsidian Git pulls it down the next interval.

**Default scope: every Claude Code session, anywhere on this Mac.** If you'd prefer to scope it to vault-only, edit `SCOPE_TO_VAULT_ONLY = true` near the top of `hooks/save-session.ts`.

> **Privacy note.** Sessions launched in coding repos will include whatever you paste into the conversation — code snippets, debug logs, occasionally secrets if you're careless. Those land in your vault repo on GitHub. The vault repo is private, but treat it as you'd treat any place with that material. If you accidentally paste a credential, rotate it after.

### One-time hook registration

Add this to `~/.claude/settings.json` (or run the equivalent `claude` CLI command if your version supports it):

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/jelst/Documents/ParkerTech Portfolio/cc-mcp/hooks/save-session.ts"
          }
        ]
      }
    ]
  }
}
```

The script has a shebang line so it can be invoked directly — no `npx`/`tsx` prefix needed in the hook config. Make sure it's executable: `chmod +x "/Users/jelst/Documents/ParkerTech Portfolio/cc-mcp/hooks/save-session.ts"`.

After every Claude Code session ends (Ctrl-D, `/exit`, window close), you should see a new file appear under `Daily/Claude-Sessions/`. The hook is non-blocking and silent on success; warnings go to stderr if anything goes wrong (visible in Claude Code's debug log).

## What's next

- **Remote access** — the agreed end-state is an always-on remote vault MCP (public HTTPS + OAuth) serving Mac, Windows, and iPhone from the GitHub-backed vault; this local stdio server stays as the Mac fast path. See vault `Knowledge/Systems/Vault-on-two-machines-Mac-Windows-shared-remote-MCP-plan.md`.
