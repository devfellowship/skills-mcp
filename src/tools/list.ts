import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listSkills } from "../api.js";
import { errorResult, jsonResult, kindSchema } from "./helpers.js";

export function registerListSkills(server: McpServer): void {
  server.registerTool(
    "list_skills",
    {
      title: "List DFL skills",
      description:
        "List all publicly available skills, MCP servers and connections in the DFL Forge " +
        "registry (skills.sh-compatible). Optionally filter by kind or sort.",
      inputSchema: {
        kind: kindSchema.optional(),
        sort: z
          .string()
          .optional()
          .describe('Sort order, e.g. "name", "updated" (registry-defined).'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ kind, sort }) => {
      try {
        const data = await listSkills({ kind, sort });
        return jsonResult({ ...data, count: data.skills?.length ?? 0 });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
