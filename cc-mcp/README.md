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

Read-only:
- `list_clients` — names + IDs + contact counts
- `get_client` — full client by name or ID, plus their projects, last 10 correspondence entries, recent quotes
- `list_projects` — across all clients, with optional status filter
- `get_project` — full project including tasks, milestones, recent correspondence
- `recent_correspondence` — filter by client/project, optional `includeTranscripts: true` for verbatim

Writes:
- `add_task` — create a task on a project
- `update_task` — mark done, change due date, etc.
- `add_correspondence` — log a meeting / call / email / note (with optional verbatim transcript)
- `add_inbox_item` — quick-capture for the Brain Dump Inbox
- `toggle_checklist_item` — tick / untick a milestone success criterion

All writes go directly to Firestore. The Command Centre's auto-sync picks them up within 15 seconds and regenerates the affected markdown files in the vault. Within a minute, the Obsidian Git plugin on your Mac pulls them down.

## Updating the server

Edit `index.ts`. Claude Code re-runs the server fresh each launch (or you can restart Claude). No build step — `tsx` runs TypeScript directly.

## What's not here yet

- **Update structured fields on clients/projects/quotes** (e.g. rename a client, change project status, edit a quote). Could be added; not yet exposed because Claude rarely needs to do those — they're more natural to do in the Command Centre UI.
- **Bulk operations.** One tool call = one change. Fine for now.
- **Authentication beyond ADC.** Single-user, single-Mac. If you ever want this to run somewhere else, swap ADC for a service-account key file (gitignored) or per-call Firebase Auth.
