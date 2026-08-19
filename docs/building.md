# Building and Running

## Prerequisites

- Node.js 20+ and npm
- Podman (for container builds)

## From Source

```bash
npm install
npm run build
npm start
```

Development mode (recompile on changes):

```bash
npm run dev
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `ROX_ENDPOINT` | For API calls | — | RHACS Central URL (e.g. `https://central.example.com:443`) |
| `ROX_API_TOKEN` | For API calls | — | API token from RHACS Central |
| `ROX_INSECURE_SKIP_TLS_VERIFY` | No | `false` | Skip TLS certificate verification |
| `ROX_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds |

Generate an API token in RHACS Central: **Platform Configuration > Integrations > Authentication Tokens > API Token**.

The discovery tools (`rhacs_list_services`, `rhacs_list_endpoints`, `rhacs_get_endpoint_details`, `rhacs_get_model`, `rhacs_search_endpoints`) work without any environment variables. Only `rhacs_call_api` requires `ROX_ENDPOINT` and `ROX_API_TOKEN`.

## Container Build

```bash
# Build with podman
./build.sh

# Or manually
podman build -t rhacs-mcp -f Containerfile .

# Run
podman run -i --rm \
  -e ROX_ENDPOINT=https://central.example.com:443 \
  -e ROX_API_TOKEN=your-token-here \
  rhacs-mcp
```

## Podman Compose

Set environment variables in your shell or a `.env` file, then:

```bash
podman-compose up --build
```
