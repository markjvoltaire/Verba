# Figma MCP Server Setup

The Figma MCP server lets AI tools fetch design context, colors, typography, and assets from your Figma files. There are two ways to connect:

---

## Option 1: Remote Server (Recommended — No Desktop App)

Uses Figma's hosted server at `https://mcp.figma.com/mcp`. You authenticate once via OAuth.

### For Claude Code

1. **Install the Figma plugin** (recommended):
   ```bash
   claude plugin install figma@claude-plugins-official
   ```

2. **Or add manually**:
   ```bash
   claude mcp add --transport http figma https://mcp.figma.com/mcp
   ```
   For all projects: `claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp`

3. **Restart Claude Code**, then type `/mcp` in the chat.

4. **Select `figma`** → **Authenticate** → **Allow Access** in the browser.

5. You should see: `Authentication successful. Connected to figma`

### For Cursor

1. **Install via plugin** (recommended): In agent chat, type:
   ```
   /add-plugin figma
   ```

2. **Or add manually**: The `.cursor/mcp.json` in this project is already configured. Go to **Cursor → Settings → MCP** and ensure the Figma server is enabled.

3. **Start the server** and click **Authenticate** when prompted.

4. **Restart Cursor** after connecting.

---

## Option 2: Desktop Server (Figma Desktop App Required)

Runs locally when the Figma desktop app is open. Requires a **Dev or Full seat** on a paid Figma plan.

### Step 1: Enable in Figma

1. Download the [Figma desktop app](https://www.figma.com/downloads/) (not the browser).
2. Open a Design file and switch to **Dev Mode** (Shift+D or toolbar).
3. In the **Inspect** panel, find **MCP server**.
4. Click **Enable desktop MCP server**.
5. Confirm the message: "Server is enabled and running" at the bottom.

### Step 2: Add to Your Editor

**Claude Code:**
```bash
claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp
```

**Cursor:** Update `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "figma-desktop": {
      "url": "http://127.0.0.1:3845/mcp",
      "type": "http"
    }
  }
}
```

**Important:** The Figma desktop app must be open with a file and MCP enabled for this to work.

---

## Troubleshooting

- **"Enable the Figma MCP server"** → Add the server in your editor’s MCP settings and ensure it’s turned on.
- **"Figma desktop app or browser plugin"** → Use **Option 1 (Remote)** so you don’t need the desktop app.
- **Connection fails** → Restart your editor and, for the desktop server, restart the Figma app.
- **No tools listed** → Run `/mcp` (or your editor’s MCP command) and confirm the Figma server shows as connected.

---

## Quick Reference

| Method        | Desktop app? | Auth              | Best for              |
|---------------|--------------|-------------------|------------------------|
| Remote server | No           | OAuth (one-time)  | Most users            |
| Desktop server| Yes          | None (local)      | Dev Mode workflows    |
