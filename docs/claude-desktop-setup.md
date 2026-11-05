# Claude Desktop and Claude Code Setup

## Claude Desktop

Add to your Claude Desktop MCP configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Option 1: Node.js (from source)

```json
{
  "mcpServers": {
    "rhacs": {
      "command": "node",
      "args": ["/path/to/rhacs-mcp/dist/index.js"],
      "env": {
        "ROX_ENDPOINT": "https://central.example.com:443",
        "ROX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Option 2: Podman container

```json
{
  "mcpServers": {
    "rhacs": {
      "command": "podman",
      "args": [
        "run", "-i", "--rm",
        "-e", "ROX_ENDPOINT",
        "-e", "ROX_API_TOKEN",
        "quay.io/danclark/rhacs-mcp:latest"
      ],
      "env": {
        "ROX_ENDPOINT": "https://central.example.com:443",
        "ROX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Claude Code CLI

Add to your project `.mcp.json` or global `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "rhacs": {
      "command": "node",
      "args": ["/path/to/rhacs-mcp/dist/index.js"],
      "env": {
        "ROX_ENDPOINT": "https://central.example.com:443",
        "ROX_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Remote server (HTTP mode)

If the server runs as a shared service (see [Deploying on OpenShift](openshift-deploy.md)):

```bash
claude mcp add --transport http rhacs https://<route-host>/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

## Self-Signed Certificates

RHACS Central often uses self-signed TLS certificates. Two options:

**Option A** — Skip TLS verification (development only):

```json
"env": {
  "ROX_INSECURE_SKIP_TLS_VERIFY": "true"
}
```

**Option B** — Custom CA certificate (recommended for production):

```json
"env": {
  "NODE_EXTRA_CA_CERTS": "/path/to/ca.pem"
}
```

## Verification

After configuring, ask Claude:

> "Use the RHACS tools to list all available API services."

Claude should call `rhacs_list_services` and return the list of services.
