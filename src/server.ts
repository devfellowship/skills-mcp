import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { DEFAULT_API_BASE } from "./api.js";
import { registerSearchSkills } from "./tools/search.js";
import { registerListSkills } from "./tools/list.js";
import { registerGetSkill } from "./tools/get.js";
import { registerInstallSkill } from "./tools/install.js";

const PORT = Number(process.env.PORT ?? 3041);
const API_BASE = process.env.SKILLS_API_URL ?? DEFAULT_API_BASE;

const SERVER_INFO = { name: "dfl-mcp-skills", version: "0.1.0" } as const;

/** Build a fresh MCP server with all tools registered. */
function buildServer(): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerSearchSkills(server);
  registerListSkills(server);
  registerGetSkill(server);
  registerInstallSkill(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: SERVER_INFO.name,
    version: SERVER_INFO.version,
    upstream: API_BASE,
  });
});

/**
 * Stateless Streamable HTTP: a new server + transport per request, closed when
 * the response ends. Simpler to scale (no session affinity). The MCP spec
 * still requires GET/DELETE handlers, which return 405 in stateless mode.
 */
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: isInitializeRequest(req.body) ? null : (req.body?.id ?? null),
      });
    }
  }
});

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This server is stateless; use POST /mcp." },
    id: null,
  });
}

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[${SERVER_INFO.name}] listening on :${PORT} (upstream ${API_BASE})`);
});
