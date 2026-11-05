#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { listServicesSchema, listServices } from "./tools/list-services.js";
import {
  listEndpointsSchema,
  listEndpoints,
} from "./tools/list-endpoints.js";
import {
  getEndpointDetailsSchema,
  getEndpointDetails,
} from "./tools/get-endpoint-details.js";
import { callApiSchema, callApi } from "./tools/call-api.js";
import { getModelSchema, getModelDetails } from "./tools/get-model.js";
import {
  searchEndpointsSchema,
  searchEndpointsHandler,
} from "./tools/search-endpoints.js";
import { validateConfig } from "./api-client.js";
import { startHttpServer } from "./http.js";

function toolHandler(fn: (input: Record<string, unknown>) => Promise<string>) {
  return async (input: Record<string, unknown>) => {
    try {
      const text = await fn(input);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "rhacs",
    version: "1.0.0",
  });

  server.tool(
    "rhacs_list_services",
    "List all available RHACS API services with their endpoint counts. Use this first to discover which services exist (e.g. Alert Service, Deployment Service, Policy Service). Returns service names you can pass to rhacs_list_endpoints.",
    listServicesSchema.shape,
    toolHandler(listServices as (input: Record<string, unknown>) => Promise<string>),
  );

  server.tool(
    "rhacs_list_endpoints",
    "List all endpoints for a specific RHACS API service. Returns endpoint names, HTTP methods, paths, and descriptions. Use after rhacs_list_services to drill into a service.",
    listEndpointsSchema.shape,
    toolHandler(listEndpoints as (input: Record<string, unknown>) => Promise<string>),
  );

  server.tool(
    "rhacs_get_endpoint_details",
    "Get full details for a specific RHACS API endpoint including all parameters (query, path, body), return type, and response codes. Use to understand what to pass to rhacs_call_api.",
    getEndpointDetailsSchema.shape,
    toolHandler(getEndpointDetails as (input: Record<string, unknown>) => Promise<string>),
  );

  server.tool(
    "rhacs_call_api",
    "Call a RHACS Central API endpoint. Substitutes path parameters, adds query parameters, and sends the request body. Returns the JSON response. Use rhacs_get_endpoint_details first to understand required parameters.",
    callApiSchema.shape,
    toolHandler(callApi as (input: Record<string, unknown>) => Promise<string>),
  );

  server.tool(
    "rhacs_get_model",
    "Look up a RHACS data model definition. Returns field names and types for object models, or enum values for enums. Use to understand request body schemas and response shapes.",
    getModelSchema.shape,
    toolHandler(getModelDetails as (input: Record<string, unknown>) => Promise<string>),
  );

  server.tool(
    "rhacs_search_endpoints",
    "Search across all RHACS API endpoints by keyword. Searches endpoint names, paths, and descriptions. Faster than browsing service by service when you know what you're looking for.",
    searchEndpointsSchema.shape,
    toolHandler(searchEndpointsHandler as (input: Record<string, unknown>) => Promise<string>),
  );

  return server;
}

async function main() {
  const config = validateConfig();
  if (!config.valid) {
    for (const err of config.errors) {
      console.error(`Warning: ${err}`);
    }
    console.error(
      "Discovery tools (list, search, model) will work. rhacs_call_api requires ROX_ENDPOINT and ROX_API_TOKEN.",
    );
  }

  const mode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
  if (mode === "http") {
    await startHttpServer(createServer);
    return;
  }
  if (mode !== "stdio") {
    throw new Error(`Unknown MCP_TRANSPORT "${mode}". Use "stdio" or "http".`);
  }

  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  console.error("RHACS MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
