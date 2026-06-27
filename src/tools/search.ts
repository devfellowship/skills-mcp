import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchSkills } from "../api.js";
import { errorResult, jsonResult, kindSchema } from "./helpers.js";

export function registerSearchSkills(server: McpServer): void {
  server.registerTool(
    "search_skills",
    {
      title: "Search DFL skills",
      description:
        "Search the DFL Forge registry for skills, MCP servers and connections by query. " +
        "Hybrid semantic + full-text search. Returns matching skill summaries (with " +
        "owner/repo/slug ids usable with get_skill and install_skill).",
      inputSchema: {
        query: z.string().min(1).describe("Free-text search query (required)."),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Max results to return (default: registry default)."),
        kind: kindSchema.optional(),
        semantic: z
          .boolean()
          .optional()
          .describe("Use semantic (embedding) search in addition to FTS. Default: registry default."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit, kind, semantic }) => {
      try {
        const data = await searchSkills(query, { limit, kind, semantic });
        return jsonResult({ ...data, count: data.skills?.length ?? 0 });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
