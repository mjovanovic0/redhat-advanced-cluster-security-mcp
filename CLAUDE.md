# RHACS MCP Server

MCP server providing LLM access to the Red Hat Advanced Cluster Security for Kubernetes (RHACS) API via a dynamic proxy pattern.

## What This Is

- ~70 RHACS API services, 370+ endpoints, 900+ data models (4.11.6: 71 / 372 / 945)
- 6 MCP meta-tools instead of hundreds of static tools (LLMs can't handle huge tool lists)
- 5 discovery tools work offline; 1 execution tool calls live RHACS Central

## Project Structure

```
src/index.ts              Entry point: McpServer, 6 tool registrations, StdioServerTransport
src/api-client.ts         HTTP client: Bearer auth, TLS, timeout, error messages
src/registry.ts           Loads api_spec/ JSON at startup, fuzzy service/model lookup
src/types.ts              TypeScript interfaces for api_spec data shapes
src/tools/                One file per tool: list-services, list-endpoints,
                          get-endpoint-details, call-api, get-model, search-endpoints
api_spec/                 Generated (gitignored): service JSONs + _index.json + common_object_reference.json
scripts/generate-api-spec.mjs  Converts RHACS v1+v2 swagger into api_spec/
docs/                     Building, Claude setup, tool reference, architecture
Containerfile             Multi-stage UBI9; builder generates api_spec (ARG ACS_VERSION)
tekton/                   OpenShift Pipelines: git-clone + buildah -> internal registry
podman-compose.yml        stdin_open: true for stdio transport
```

## Tech Stack

- TypeScript (ES2022, Node16 modules, strict)
- Node.js 20+
- `@modelcontextprotocol/sdk` — `McpServer` class, `StdioServerTransport`
- `zod` — tool input validation with `.describe()` for LLM consumption
- Native `fetch()` — no axios; Node 20+ handles gzip automatically
- UBI9 container images

## MCP Tools

| Tool | Purpose | Live RHACS? |
|------|---------|:-----------:|
| `rhacs_list_services` | List all services | No |
| `rhacs_list_endpoints` | Endpoints for a service | No |
| `rhacs_get_endpoint_details` | Full param/response spec | No |
| `rhacs_get_model` | Model fields or enum values | No |
| `rhacs_search_endpoints` | Keyword search | No |
| `rhacs_call_api` | HTTP call to RHACS Central | Yes |

## Build & Run

```bash
npm install && npm run build    # compile TypeScript
npm run generate-spec -- 4.11.6 # generate api_spec/ from RHACS swagger
npm start                       # run MCP server on stdio
npm run dev                     # watch mode
./build.sh                      # podman container build
```

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `ROX_ENDPOINT` | For API calls | — | RHACS Central URL |
| `ROX_API_TOKEN` | For API calls | — | Bearer token |
| `ROX_INSECURE_SKIP_TLS_VERIFY` | No | `false` | Skip TLS verification |
| `ROX_TIMEOUT_MS` | No | `30000` | Request timeout (ms) |

## Claude Desktop / Claude Code Config

```json
{
  "mcpServers": {
    "rhacs": {
      "command": "node",
      "args": ["/path/to/rhacs-mcp/dist/index.js"],
      "env": {
        "ROX_ENDPOINT": "https://central.example.com:443",
        "ROX_API_TOKEN": "your-token"
      }
    }
  }
}
```

For self-signed certs, add `"ROX_INSECURE_SKIP_TLS_VERIFY": "true"` or `"NODE_EXTRA_CA_CERTS": "/path/to/ca.pem"`.

## Design Decisions

- **Dynamic proxy over static tools**: 6 meta-tools scale to any API size without flooding LLM context
- **Offline discovery**: registry loaded from bundled JSON at startup; no network needed for browsing
- **Graceful degradation**: server starts without credentials; only `rhacs_call_api` fails
- **Response truncation**: arrays over 100K chars are trimmed with pagination hints
- **Streaming**: 6 export paths use 120s timeout and NDJSON parsing
- **Error messages**: human-readable, actionable (tells user where to generate tokens, what to check)
- **`schema.shape`**: pass Zod schema's `.shape` property to `server.tool()`, not the schema itself
- **All logging to stderr**: stdout is reserved for MCP JSON-RPC protocol

## API Spec Data

- `api_spec/_index.json` — service catalog with filenames and endpoint counts
- Each service JSON has: `service`, `endpoints[]` with `method`, `path`, `*_parameters`, `return_type`, `responses`
- `common_object_reference.json` — models with `fields[]` (objects) or `enum_values[]` (enums)
- Path params use `{name}` notation including dotted names like `{config.id}`
- References use `_CommonObjectReference` suffix (e.g. `StorageAlert_CommonObjectReference`)

## Conventions

- Tool handlers return `Promise<string>` — the `toolHandler` wrapper in index.ts adds MCP content envelope
- Errors caught by `toolHandler` return `{ isError: true }` so LLMs can reason about failures
- Registry normalizes service names: "Alert Service", "alert service", "alert_service", "alert" all resolve
- Model lookup strips `_CommonObjectReference` suffix automatically
