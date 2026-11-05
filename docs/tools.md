# MCP Tools Reference

This server provides 6 tools that wrap the RHACS API using a dynamic proxy pattern.

## Workflow

The recommended workflow for calling RHACS APIs:

1. **`rhacs_list_services`** — Discover available services
2. **`rhacs_list_endpoints`** — List endpoints for a service
3. **`rhacs_get_endpoint_details`** — Get full parameter spec for an endpoint
4. **`rhacs_get_model`** — Understand request/response data shapes
5. **`rhacs_call_api`** — Make the actual API call

Or use **`rhacs_search_endpoints`** to jump directly to relevant endpoints by keyword.

## Tool Details

### rhacs_list_services

List all RHACS API services with endpoint counts.

**Parameters:** None

**Example result:**
```
RHACS API — 71 services, 372 total endpoints

Administration Event Service (3 endpoints)
Alert Service (9 endpoints)
...
```

### rhacs_list_endpoints

List all endpoints for a specific service.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `service_name` | string | Yes | Service name (e.g. "Alert Service") |

### rhacs_get_endpoint_details

Get full specification for a single endpoint.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `service_name` | string | Yes | Service name |
| `endpoint_name` | string | Yes | Endpoint name (e.g. "GetAlert") |

Returns: method, path, all parameters (path, query, body), return type, and response codes.

### rhacs_call_api

Call a RHACS Central API endpoint.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `method` | string | Yes | HTTP method: GET, POST, PUT, PATCH, DELETE |
| `path` | string | Yes | API path (e.g. "/v1/alerts/{id}") |
| `path_params` | object | No | Path parameter substitutions (e.g. `{"id": "abc-123"}`) |
| `query_params` | object | No | Query string parameters |
| `body` | any | No | Request body for POST/PUT/PATCH |

Requires `ROX_ENDPOINT` and `ROX_API_TOKEN` environment variables.

### rhacs_get_model

Look up a data model definition from the API specification.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `model_name` | string | Yes | Model name (e.g. "StorageAlert") |

Returns field definitions for objects or valid values for enums.

### rhacs_search_endpoints

Search across all endpoints by keyword.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `keyword` | string | Yes | Search term |
| `limit` | number | No | Max results (default: 20, max: 50) |

Searches endpoint names, paths, descriptions, and service names.
