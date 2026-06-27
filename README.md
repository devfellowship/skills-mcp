# skills-mcp — DFL Forge skill-search MCP

Remote **MCP server** (Streamable HTTP) that exposes the live [DFL Forge](https://skills.devfellowship.com)
skills registry as MCP tools, so any Claude/MCP agent can discover and install DevFellowship
skills, MCP servers and connections.

It is a **thin** server: no database, no state. Every tool call proxies the live
skills.sh-compatible API at `https://skills.devfellowship.com`.

## Tools

| Tool | Signature | API |
| --- | --- | --- |
| `search_skills` | `(query: string, opts?: { limit?, kind?, semantic? })` | `GET /api/v1/skills/search` |
| `get_skill` | `(id: string)` where `id = "owner/repo/slug"` | `GET /api/v1/skills/:owner/:repo/:skill` |
| `list_skills` | `(opts?: { kind?, sort? })` | `GET /api/v1/skills` |
| `install_skill` | `(id: string, opts?: { agents?: string[], scope?: "project"\|"global" })` | — returns command only |

`kind` is one of `skill | mcp | connection | all`.

`install_skill` does **not** touch the filesystem (a remote MCP can't). It returns the
exact command, e.g. `npx skills add devfellowship/<repo> -g`, plus a one-line explanation —
the host agent or user runs it.

All tools return structured JSON text content (and `structuredContent`).

## Run locally

```bash
npm install
npm run build
npm start              # listens on :3041 (PORT env to override)
```

Health check:

```bash
curl -s http://localhost:3041/health
# {"status":"ok","service":"dfl-mcp-skills","version":"0.1.0","upstream":"https://skills.devfellowship.com"}
```

MCP endpoint: `POST http://localhost:3041/mcp` (stateless Streamable HTTP).

### Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3041` | HTTP listen port |
| `SKILLS_API_URL` | `https://skills.devfellowship.com` | Upstream registry base URL |
| `SKILLS_API_TIMEOUT_MS` | `15000` | Per-request upstream timeout |

## Register with Claude (`~/.claude.json`)

Point at the deployed remote endpoint:

```jsonc
{
  "mcpServers": {
    "dfl-mcp-skills": {
      "type": "http",
      "url": "https://skills.mcp.devfellowship.com/mcp"
    }
  }
}
```

Restart Claude to load it. For local dev, swap the URL for `http://localhost:3041/mcp`.

## Deploy

Containerized via the included `Dockerfile`. **Deploy target: Dokploy →
`skills.mcp.devfellowship.com`.** Infra is owned by another stream — this repo only
ships the build manifest; it does not provision the deployment.

- Container listens on `PORT` (default `3041`); expose it behind the Dokploy proxy.
- Health endpoint for the proxy/Dokploy probe: `GET /health`.

## Stack

TypeScript (strict) · `@modelcontextprotocol/sdk` Streamable HTTP transport · Express · zod · Node 20.
