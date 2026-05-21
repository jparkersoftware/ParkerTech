# parkertech-cc-mcp

A small **MCP server** that exposes the ParkerTech Command Centre (Firestore) to Claude Code as tools. Lets you sit at the terminal in your Obsidian vault and say things like *"add a task to the Wonde Integration project to chase Tom for sign-off, due Friday"* — Claude calls a tool, the change lands in Firestore, the website auto-sync regenerates the project's markdown file in the vault.

## Architecture in one sentence

Claude Code calls tools over stdio → this Node process runs locally on your Mac → talks to Firestore via the Firebase Admin SDK using your `gcloud` Application Default Credentials → reads/writes the same documents the website does.

## One-time setup

### 1. Install gcloud + log in

```bash
brew install --cask google-cloud-sdk
gcloud auth application-default login
gcloud config set project parkertechfire
```

The login opens your browser; pick the Google account that owns the Firebase project (`jparkersoftware@gmail.com` or wherever ParkerTechFire lives). After this, credentials are cached at `~/.config/gcloud/` and the MCP server picks them up automatically.

### 2. Install dependencies

```bash
cd ~/Documents/ParkerTech\ Portfolio/cc-mcp
npm install
```

### 3. Wire Claude Code to the server

Add this stanza to your Claude Code MCP configuration. The exact file depends on how you run Claude Code:

- **Claude Code CLI** — edit `~/.claude.json` (or whichever config it loads — `claude mcp add` may also work):
  ```json
  {
    "mcpServers": {
      "parkertech-cc": {
        "command": "npx",
        "args": ["-y", "tsx", "/Users/jelst/Documents/ParkerTech Portfolio/cc-mcp/index.ts"]
      }
    }
  }
  ```
- **Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` with the same shape.

Restart Claude Code after editing. Next time you launch `claude`, the tools become available.

### 4. Sanity check

```bash
cd ~/Documents/Obsidian/ParkerTechFire
claude
> list my clients
```

Claude should call the `list_clients` tool and respond with what's in Firestore. If you get a permission error, your `gcloud` login didn't pick the right Google account — re-run step 1 with the correct one.

## Tool reference

### Command Centre (Firestore)

Reads:
- `list_clients` — names + IDs + contact counts
- `get_client` — full client by name or ID, plus their projects, last 10 correspondence entries, recent quotes
- `list_projects` — across all clients, with optional status filter
- `get_project` — full project including tasks, milestones, recent correspondence
- `recent_correspondence` — filter by client/project, optional `includeTranscripts: true` for verbatim

Writes (auto-sync back to the vault within 15s):
- `add_task` — create a task on a project
- `update_task` — mark done, change due date, etc.
- `add_correspondence` — log a meeting / call / email / note (with optional verbatim transcript)
- `add_inbox_item` — quick-capture for the Brain Dump Inbox
- `toggle_checklist_item` — tick / untick a milestone success criterion

### Vault (direct filesystem)

For when Claude is running from a coding repo and doesn't have fs access to the vault:
- `vault_read(path)` — read a vault file
- `vault_list(folder?)` — list entries in a vault folder
- `vault_write_knowledge(category, title, body, tags?, related?)` — create or overwrite a Knowledge note. Categories: `Patterns | Decisions | Context | Mistakes | Systems | People | General`
- `vault_append_knowledge(category, title, sectionHeading, body)` — grow a Knowledge note over time without overwriting
- `vault_append_daily(heading, body)` — append a timestamped section to today's Daily journal

All vault writes are sandboxed to `Knowledge/`, `Daily/`, and `Inbox/` — Claude cannot edit auto-synced Command Centre files. Writes auto-commit and push from the vault repo.

## Updating the server

Edit `index.ts`. Claude Code re-runs the server fresh each launch (or you can restart Claude). No build step — `tsx` runs TypeScript directly.

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

## What's not here yet

- **Update structured fields on clients/projects/quotes** (e.g. rename a client, change project status, edit a quote). Could be added; not yet exposed because Claude rarely needs to do those — they're more natural to do in the Command Centre UI.
- **Bulk operations.** One tool call = one change. Fine for now.
- **Authentication beyond ADC.** Single-user, single-Mac. If you ever want this to run somewhere else, swap ADC for a service-account key file (gitignored) or per-call Firebase Auth.
