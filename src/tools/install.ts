import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult } from "./helpers.js";

/**
 * Remote MCP servers cannot touch the calling user's filesystem, so this tool
 * does NOT install anything. It returns the exact `npx skills add` command for
 * the host agent to run, plus a one-line human explanation.
 */
export function registerInstallSkill(server: McpServer): void {
  server.registerTool(
    "install_skill",
    {
      title: "Install a DFL skill (returns command)",
      description:
        "Produce the exact shell command to install a DFL skill. Does NOT write any files " +
        "(a remote MCP cannot access the user's filesystem) — it returns the `npx skills add` " +
        "command for the host agent/user to run, plus a short explanation.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe('Skill id "owner/repo/slug" or "owner/repo" (from list_skills/search_skills).'),
        agents: z
          .array(z.string())
          .optional()
          .describe('Target agents, e.g. ["claude", "cursor"]. Maps to --agent flags.'),
        scope: z
          .enum(["project", "global"])
          .optional()
          .describe('Install scope. "global" adds -g; "project" installs into the current project. Default: global.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, agents, scope }) => {
      try {
        const parts = id.split("/").filter(Boolean);
        if (parts.length < 2) {
          throw new Error(
            `Invalid skill id "${id}". Expected "owner/repo" or "owner/repo/slug".`,
          );
        }
        const repoRef = `${parts[0]}/${parts[1]}`;
        const effectiveScope = scope ?? "global";

        const args = ["skills", "add", repoRef];
        if (effectiveScope === "global") args.push("-g");
        for (const agent of agents ?? []) args.push("--agent", agent);

        const command = `npx ${args.join(" ")}`;
        const explanation =
          `Run this command to install '${repoRef}'` +
          `${effectiveScope === "global" ? " globally" : " into the current project"}` +
          `${agents?.length ? ` for ${agents.join(", ")}` : ""}. ` +
          `The host agent or user must execute it locally — this MCP cannot write to your filesystem.`;

        return jsonResult({
          id,
          repo: repoRef,
          scope: effectiveScope,
          agents: agents ?? [],
          command,
          explanation,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
