# Deploying on OpenShift (HTTP)

By default the server speaks MCP over stdio, which only works when the client starts it as a
local process. To run it as a shared service, set `MCP_TRANSPORT=http`: the server then serves
MCP Streamable HTTP on `:8080/mcp` (stateless, JSON responses) plus an unauthenticated
`/healthz` for probes.

The server calls RHACS Central with its own API token, so anyone who can reach `/mcp` can
use that token. HTTP mode therefore requires `MCP_AUTH_TOKEN`, and every request must send
`Authorization: Bearer <MCP_AUTH_TOKEN>`. Give the RHACS API token only the role the MCP users
need (for example a read-only role such as `Analyst`).

The manifests in `deploy/openshift/` assume the image was built into the `rhacs-mcp` ImageStream
of the same namespace by the [Tekton pipeline](tekton.md).

| File | Purpose |
|------|---------|
| `deployment.yaml` | One replica, `MCP_TRANSPORT=http`, probes on `/healthz`, redeploys when the pipeline pushes `rhacs-mcp:latest` |
| `service.yaml` | ClusterIP service on port 8080 |
| `route.yaml` | Edge-TLS Route, HTTP redirected to HTTPS, 150s timeout for streaming exports |
| `ingress.example.yaml` | Alternative to the Route (not applied by default) |
| `secret.example.yaml` | Shape of the `rhacs-mcp` Secret (create it with `oc create secret`, not from this file) |

## Deploy

```bash
oc project rhacs-mcp      # the namespace the pipeline pushed the image to

oc create secret generic rhacs-mcp \
  --from-literal=ROX_ENDPOINT=https://central-stackrox.apps.example.com:443 \
  --from-literal=ROX_API_TOKEN='<rhacs-api-token>' \
  --from-literal=MCP_AUTH_TOKEN="$(openssl rand -hex 32)"

oc apply -k deploy/openshift

oc rollout status deployment/rhacs-mcp
oc get route rhacs-mcp -o jsonpath='https://{.spec.host}/mcp{"\n"}'
```

Print the MCP token for your clients:

```bash
oc get secret rhacs-mcp -o jsonpath='{.data.MCP_AUTH_TOKEN}' | base64 -d; echo
```

### HSTS policy

If the Route is rejected with `HSTS max-age must be set correctly in HSTS annotation`, the cluster
enforces HSTS on Routes. `route.yaml` sets
`haproxy.router.openshift.io/hsts_header: max-age=31536000;includeSubDomains;preload`; adjust it to
what the cluster requires:

```bash
oc get ingresses.config cluster -o jsonpath='{.spec.requiredHSTSPolicies}'
```

`maxAge.smallestMaxAge` / `largestMaxAge` bound `max-age`, and `includeSubDomainsPolicy` /
`preloadPolicy` say whether those flags must or must not be present.

### Central TLS

Central's default certificate is signed by the RHACS internal CA, which Node does not trust, so
calls fail with `TLS verification failed ... self-signed certificate in certificate chain`.

**Recommended: trust the RHACS CA.** The Deployment mounts the optional ConfigMap
`rhacs-central-ca` and sets `NODE_EXTRA_CA_CERTS=/etc/rhacs-ca/ca.pem`:

```bash
# RHACS in the same cluster (namespace stackrox):
oc get secret central-tls -n stackrox -o jsonpath='{.data.ca\.pem}' | base64 -d > rhacs-ca.pem
# or with roxctl:  roxctl -e <central>:443 central cert > rhacs-ca.pem

oc create configmap rhacs-central-ca --from-file=ca.pem=rhacs-ca.pem -n rhacs-mcp
oc rollout restart deployment/rhacs-mcp -n rhacs-mcp
```

Central's own certificate is issued for `central.stackrox.svc`, not for the Route hostname. With
the CA approach, point `ROX_ENDPOINT` at the service (or at a Route host that matches the
certificate), otherwise verification fails with a hostname mismatch:

```bash
oc set data secret/rhacs-mcp ROX_ENDPOINT=https://central.stackrox.svc:443 -n rhacs-mcp
```

If the Central Route is `reencrypt`/`edge` with a certificate from a CA the system already trusts,
nothing is needed. If it is signed by a different private CA, put that CA in `ca.pem` instead.

**Testing only: skip verification.** Uncomment `ROX_INSECURE_SKIP_TLS_VERIFY: "true"` in
`deployment.yaml` (or `oc set env deployment/rhacs-mcp ROX_INSECURE_SKIP_TLS_VERIFY=true`).

## Test

```bash
URL=$(oc get route rhacs-mcp -o jsonpath='https://{.spec.host}/mcp')
TOKEN=$(oc get secret rhacs-mcp -o jsonpath='{.data.MCP_AUTH_TOKEN}' | base64 -d)

curl -s "$URL" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rhacs_call_api","arguments":{"method":"GET","path":"/v1/ping"}}}'
```

A `{"status":"ok"}` from Central inside the result means the whole chain works.

## Connect a client

Claude Code:

```bash
claude mcp add --transport http rhacs https://<route-host>/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "rhacs": {
      "type": "http",
      "url": "https://<route-host>/mcp",
      "headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
    }
  }
}
```

## HTTP mode settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | `http` to serve Streamable HTTP |
| `MCP_AUTH_TOKEN` | — | Required in HTTP mode; clients send it as a bearer token |
| `MCP_PORT` | `8080` | Listen port |
| `MCP_HOST` | `0.0.0.0` | Listen address |
| `MCP_PATH` | `/mcp` | MCP endpoint path |
