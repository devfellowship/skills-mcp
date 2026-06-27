import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSkill } from "../api.js";
import { errorResult, jsonResult } from "./helpers.js";

export function registerGetSkill(server: McpServer): void {
  server.registerTool(
    "get_skill",
    {
      title: "Get a DFL skill",
      description:
        "Fetch one skill by id ('owner/repo/slug', e.g. 'devfellowship/skills/dfl-stack'). " +
        "Returns the file tree, content hash and audit metadata so an agent can inspect a " +
        "skill before installing it.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe('Skill id in the form "owner/repo/slug" (from list_skills/search_skills).'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const data = await getSkill(id);
        return jsonResult({ id, ...data });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
