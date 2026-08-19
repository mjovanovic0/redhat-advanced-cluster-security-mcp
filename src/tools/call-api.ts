import { z } from "zod";
import { rhacsApiCall } from "../api-client.js";

const STREAMING_PATHS = [
  "/v1/export/deployments",
  "/v1/export/images",
  "/v1/export/nodes",
  "/v1/export/pods",
  "/v1/debug/authz/trace",
  "/v1/export/vulnmgmt/workloads",
];

export const callApiSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
    .describe("HTTP method for the API call."),
  path: z
    .string()
    .describe(
      "API path with placeholders (e.g. '/v1/alerts/{id}'). Use the exact path from rhacs_get_endpoint_details.",
    ),
  path_params: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Path parameter values to substitute. Keys are parameter names without braces (e.g. {"id": "abc-123"}). For dotted params like {config.id}, use "config.id" as key.',
    ),
  query_params: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Query string parameters as key-value pairs (e.g. {"query": "Namespace:stackrox", "pagination.limit": "10"}).',
    ),
  body: z
    .unknown()
    .optional()
    .describe(
      "Request body for POST/PUT/PATCH requests. Pass the JSON object directly.",
    ),
});

export async function callApi(input: {
  method: string;
  path: string;
  path_params?: Record<string, string>;
  query_params?: Record<string, string>;
  body?: unknown;
}): Promise<string> {
  let resolvedPath = input.path;
  if (input.path_params) {
    for (const [key, value] of Object.entries(input.path_params)) {
      resolvedPath = resolvedPath.replace(
        `{${key}}`,
        encodeURIComponent(value),
      );
    }
  }

  const unresolved = resolvedPath.match(/\{[^}]+\}/g);
  if (unresolved) {
    return `Error: Unresolved path parameters: ${unresolved.join(", ")}. Pass these in path_params.`;
  }

  if (
    input.body !== undefined &&
    ["GET", "DELETE"].includes(input.method)
  ) {
    return `Warning: ${input.method} requests should not have a body. The body will be ignored. Use query_params for GET/DELETE filtering.`;
  }

  const isStreaming = STREAMING_PATHS.some((sp) =>
    resolvedPath.startsWith(sp),
  );
  const timeoutMs = isStreaming ? 120_000 : undefined;

  const response = await rhacsApiCall(input.method, resolvedPath, {
    queryParams: input.query_params,
    body: input.body,
    timeoutMs,
  });

  const output = JSON.stringify(response.data, null, 2);
  if (response.truncated) {
    return output + "\n\n(Response was truncated. Use pagination parameters for more results.)";
  }
  return output;
}
