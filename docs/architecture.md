# Architecture

## The Problem

RHACS has 69 API services with 361 endpoints and 900 data models. Registering all 361 endpoints as individual MCP tools would flood the LLM's tool-use context, degrading tool selection accuracy and wasting tokens.

## Dynamic Proxy Pattern

Instead of static tools, we provide 6 meta-tools that let the LLM dynamically discover and call any endpoint:

```
rhacs_list_services  →  rhacs_list_endpoints  →  rhacs_get_endpoint_details  →  rhacs_call_api
                                                          ↕
                                                   rhacs_get_model
```

- **5 discovery tools** work offline against the bundled API spec JSON files
- **1 execution tool** (`rhacs_call_api`) makes live HTTP calls to RHACS Central

This keeps the MCP tool count small (6 tools) while providing access to all 361 endpoints.

## API Spec Registry

At startup, the server loads all JSON files from `api_spec/` into memory:

- `_index.json` — service catalog
- 69 service JSON files — endpoint definitions with parameters, types, responses
- `common_object_reference.json` — 900 data model definitions

The registry builds three indexes for fast lookup:
- **Services** — by name (with fuzzy matching)
- **Endpoints** — flat list for keyword search
- **Models** — by model name

## Response Handling

- Responses over 100K characters are truncated with pagination hints
- Streaming endpoints (6 export paths) use a 120s timeout
- HTTP errors return actionable messages (e.g. where to generate a new API token)

## Graceful Degradation

The server starts and serves discovery tools even without `ROX_ENDPOINT` or `ROX_API_TOKEN`. Only `rhacs_call_api` requires credentials. This lets users explore the API specification before configuring access.
