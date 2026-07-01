import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listSkills } from "../api.js";
import { errorResult, jsonResult, kindSchema } from "./helpers.js";

/** Default number of skills returned when `limit` is omitted. */
export const LIST_DEFAULT_LIMIT = 20;
/** Hard upper bound on `limit` — a larger list would blow up the caller's context. */
export const LIST_MAX_LIMIT = 100;

export function registerListSkills(server: McpServer): void {
  server.registerTool(
    "list_skills",
    {
      title: "List DFL skills",
      description:
        "List publicly available skills, MCP servers and connections in the DFL Forge " +
        "registry (skills.sh-compatible). Optionally filter by kind or sort. Results are " +
        `capped by "limit" (default ${LIST_DEFAULT_LIMIT}, max ${LIST_MAX_LIMIT}) to keep the ` +
        "response small; when the registry holds more, only the first N are returned (see " +
        '"totalCount"/"truncated") — narrow with "kind" or use search_skills.',
      inputSchema: {
        kind: kindSchema.optional(),
        sort: z
          .string()
          .optional()
          .describe('Sort order, e.g. "name", "updated" (registry-defined).'),
        limit: z
          .number()
          .int()
          .positive()
          .max(LIST_MAX_LIMIT)
          .optional()
          .describe(
            `Max skills to return (default: ${LIST_DEFAULT_LIMIT}, max: ${LIST_MAX_LIMIT}).`,
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ kind, sort, limit }) => {
      try {
        const effectiveLimit = Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
        const data = await listSkills({ kind, sort, limit: effectiveLimit });
        return jsonResult({ ...data, count: data.skills?.length ?? 0, limit: effectiveLimit });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
