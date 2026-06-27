import { z } from "zod";
import { SkillsApiError } from "../api.js";

/** Shared zod enum for the `kind` facet across tools. */
export const kindSchema = z
  .enum(["skill", "mcp", "connection", "all"])
  .describe('Artifact kind to filter by: "skill", "mcp", "connection", or "all".');

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Wrap a JSON-serializable payload as an MCP tool result with structured content. */
export function jsonResult(payload: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

/** Turn a thrown error into an actionable MCP error result. */
export function errorResult(err: unknown): ToolResult {
  let message: string;
  if (err instanceof SkillsApiError) {
    message =
      err.status === 404
        ? `${err.message}. Verify the id with list_skills or search_skills first.`
        : err.message;
  } else {
    message = err instanceof Error ? err.message : String(err);
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    structuredContent: { error: message },
    isError: true,
  };
}
