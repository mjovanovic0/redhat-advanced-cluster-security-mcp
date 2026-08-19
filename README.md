# RHACS MCP Server

MCP (Model Context Protocol) server for the **Red Hat Advanced Cluster Security for Kubernetes** API.

Provides LLM access to all 69 RHACS API services (361 endpoints) through a dynamic proxy pattern — 6 meta-tools that let an LLM discover, inspect, and call any RHACS endpoint.

## Tools

| Tool | Description |
|------|-------------|
| `rhacs_list_services` | List all 69 API services with endpoint counts |
| `rhacs_list_endpoints` | List endpoints for a specific service |
| `rhacs_get_endpoint_details` | Get full parameter spec for an endpoint |
| `rhacs_get_model` | Look up data model definitions (fields, enums) |
| `rhacs_search_endpoints` | Keyword search across all endpoints |
| `rhacs_call_api` | Call a RHACS Central API endpoint |

The first 5 tools work offline against the bundled API spec. Only `rhacs_call_api` requires a live RHACS Central connection.

## Quick Start

```bash
# Install and build
npm install
npm run build

# Run (discovery tools work without env vars)
npm start

# With RHACS Central access
ROX_ENDPOINT=https://central.example.com:443 \
ROX_API_TOKEN=your-token \
npm start
```

## Container

```bash
# Build
./build.sh

# Run
podman run -i --rm \
  -e ROX_ENDPOINT=https://central.example.com:443 \
  -e ROX_API_TOKEN=your-token \
  rhacs-mcp
```

## Documentation

- [Building and Running](docs/building.md)
- [Claude Desktop / Claude Code Setup](docs/claude-desktop-setup.md)
- [Tools Reference](docs/tools.md)
- [Architecture](docs/architecture.md)

## Project Structure

```
src/
  index.ts              # MCP server entry point
  api-client.ts         # HTTP client (auth, TLS, errors)
  registry.ts           # API spec loader and indexer
  types.ts              # TypeScript interfaces
  tools/                # 6 MCP tool implementations
api_spec/               # RHACS 4.10 API spec (69 services, 900 models)
docs/                   # Documentation
Containerfile           # Multi-stage UBI9 container build
podman-compose.yml      # Local testing config
```

## License

See [LICENSE](LICENSE).
