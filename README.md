# RHACS MCP Server

MCP (Model Context Protocol) server for the **Red Hat Advanced Cluster Security for Kubernetes** API.

Provides LLM access to all RHACS API services (71 services, 372 endpoints for 4.11.6) through a dynamic proxy pattern — 6 meta-tools that let an LLM discover, inspect, and call any RHACS endpoint.

## Tools

| Tool | Description |
|------|-------------|
| `rhacs_list_services` | List all API services with endpoint counts |
| `rhacs_list_endpoints` | List endpoints for a specific service |
| `rhacs_get_endpoint_details` | Get full parameter spec for an endpoint |
| `rhacs_get_model` | Look up data model definitions (fields, enums) |
| `rhacs_search_endpoints` | Keyword search across all endpoints |
| `rhacs_call_api` | Call a RHACS Central API endpoint |

The first 5 tools work offline against the bundled API spec. Only `rhacs_call_api` requires a live RHACS Central connection.

## API Spec

The `api_spec/` folder is not committed. Generate it from the official RHACS OpenAPI
spec matching your Central version (published at
`https://mirror.openshift.com/pub/rhacs/openapi-spec/<version>/v1.swagger.json` and `v2.swagger.json`):

```bash
npm run generate-spec -- 4.11.6
```

This downloads both v1 and v2 specs and converts them into `api_spec/`. You can also pass
local files or URLs instead of a version:

```bash
npm run generate-spec -- ./v1.swagger.json ./v2.swagger.json
```

The server exits with an error at startup if `api_spec/` is missing. The container build
copies `api_spec/` into the image, so generate it before running `./build.sh`.

## Quick Start

```bash
# Install, generate the API spec for your RHACS version, and build
npm install
npm run generate-spec -- 4.11.6
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
api_spec/               # Generated RHACS API spec (not committed)
scripts/                # generate-api-spec.mjs (swagger -> api_spec)
docs/                   # Documentation
Containerfile           # Multi-stage UBI9 container build
podman-compose.yml      # Local testing config
```

## License

See [LICENSE](LICENSE).
