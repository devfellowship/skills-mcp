import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchSkills } from "../api.js";
import { errorResult, jsonResult, kindSchema } from "./helpers.js";

/** Default number of results when `limit` is omitted — keeps the response context-safe. */
export const SEARCH_DEFAULT_LIMIT = 10;
/** Hard upper bound on `limit`. */
export const SEARCH_MAX_LIMIT = 50;

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
          .max(SEARCH_MAX_LIMIT)
          .optional()
          .describe(
            `Max results to return (default: ${SEARCH_DEFAULT_LIMIT}, max: ${SEARCH_MAX_LIMIT}).`,
          ),
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
        const effectiveLimit = Math.min(limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
        const data = await searchSkills(query, { limit: effectiveLimit, kind, semantic });
        return jsonResult({ ...data, count: data.skills?.length ?? 0, limit: effectiveLimit });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
