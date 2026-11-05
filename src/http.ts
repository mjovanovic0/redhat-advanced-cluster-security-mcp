import { timingSafeEqual } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

function jsonRpcError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

function isAuthorized(req: IncomingMessage, expected: Buffer): boolean {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1].trim());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

/**
 * Serve MCP over Streamable HTTP (stateless: a fresh server per request) on MCP_PATH.
 * Every request must carry "Authorization: Bearer <MCP_AUTH_TOKEN>", because the server
 * acts on RHACS Central with its own API token.
 */
export async function startHttpServer(createServer: () => McpServer): Promise<void> {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    throw new Error(
      "MCP_AUTH_TOKEN must be set when MCP_TRANSPORT=http. Clients must send it as 'Authorization: Bearer <token>'.",
    );
  }
  const expected = Buffer.from(token);
  const port = parseInt(process.env.MCP_PORT ?? "8080", 10);
  const host = process.env.MCP_HOST ?? "0.0.0.0";
  const mcpPath = process.env.MCP_PATH ?? "/mcp";

  const httpServer = createHttpServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (path === "/healthz") {
      sendJson(res, 200, { status: "ok" });
      return;
    }
    if (path !== mcpPath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    if (!isAuthorized(req, expected)) {
      res.setHeader("WWW-Authenticate", "Bearer");
      jsonRpcError(res, 401, "Unauthorized: missing or invalid bearer token");
      return;
    }
    if (req.method !== "POST") {
      // Stateless mode: no server-initiated SSE stream and no sessions to delete.
      res.setHeader("Allow", "POST");
      jsonRpcError(res, 405, "Method not allowed");
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      jsonRpcError(res, 400, err instanceof Error ? err.message : "Invalid request body");
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error("Error handling MCP request:", err);
      if (!res.headersSent) jsonRpcError(res, 500, "Internal server error");
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  console.error(`RHACS MCP server listening on http://${host}:${port}${mcpPath}`);

  const shutdown = () => {
    console.error("Shutting down");
    httpServer.close(() => process.exit(0));
    httpServer.closeIdleConnections();
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
