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

/** Max chars of any single error message we echo back (avoid relaying huge upstream bodies). */
const MAX_ERROR_LEN = 300;

function trimError(message: string): string {
  return message.length > MAX_ERROR_LEN ? `${message.slice(0, MAX_ERROR_LEN)}…` : message;
}

/** Turn a thrown error into an actionable MCP error result. */
export function errorResult(err: unknown): ToolResult {
  let message: string;
  if (err instanceof SkillsApiError) {
    // Don't relay arbitrary upstream bodies: summarize to {status,url} + a trimmed reason.
    const reason = trimError(err.message);
    const base = `Registry error (HTTP ${err.status}) at ${err.url}: ${reason}`;
    message =
      err.status === 404
        ? `${base}. Verify the id with list_skills or search_skills first.`
        : base;
  } else {
    message = trimError(err instanceof Error ? err.message : String(err));
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    structuredContent: { error: message },
    isError: true,
  };
}
