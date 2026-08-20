const MAX_RESPONSE_CHARS = 100_000;

export const productConfig = {
  name: "RHACS Central",
  endpointEnvVar: "ROX_ENDPOINT",
  tokenEnvVar: "ROX_API_TOKEN",
  tokenUiPath:
    "Platform Configuration > Integrations > Authentication Tokens > API Token",
  endpointExample: "https://central.example.com:443",
};

if (process.env.ROX_INSECURE_SKIP_TLS_VERIFY === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export interface ApiResponse {
  status: number;
  data: unknown;
  truncated: boolean;
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!process.env[productConfig.endpointEnvVar]) {
    errors.push(
      `${productConfig.endpointEnvVar} is not set. Set it to your ${productConfig.name} URL (e.g. ${productConfig.endpointExample}).`,
    );
  }
  if (!process.env[productConfig.tokenEnvVar]) {
    errors.push(
      `${productConfig.tokenEnvVar} is not set. Generate an API token in ${productConfig.name} > ${productConfig.tokenUiPath}.`,
    );
  }
  return { valid: errors.length === 0, errors };
}

function getTimeout(): number {
  const env = process.env.ROX_TIMEOUT_MS;
  if (env) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30_000;
}

function truncateResponse(data: unknown): { data: unknown; truncated: boolean } {
  const json = JSON.stringify(data);
  if (json.length <= MAX_RESPONSE_CHARS) {
    return { data, truncated: false };
  }

  if (Array.isArray(data)) {
    let kept = data.length;
    while (kept > 1) {
      kept = Math.floor(kept / 2);
      const slice = data.slice(0, kept);
      if (JSON.stringify(slice).length <= MAX_RESPONSE_CHARS - 200) {
        return {
          data: [
            ...slice,
            {
              _truncated: true,
              _message: `Showing ${kept} of ${data.length} items. Use pagination query parameters (pagination.limit, pagination.offset) to page through results.`,
            },
          ],
          truncated: true,
        };
      }
    }
  }

  return {
    data: {
      _truncated: true,
      _message: `Response too large (${json.length} chars). Use more specific query parameters or pagination to reduce the response size.`,
      _preview: json.slice(0, 2000),
    },
    truncated: true,
  };
}

function formatNetworkError(err: unknown, url: string): string {
  const endpoint = process.env[productConfig.endpointEnvVar] ?? "(not set)";
  if (err instanceof TypeError && String(err.cause ?? err.message).includes("ECONNREFUSED")) {
    return `Cannot connect to ${productConfig.name} at ${endpoint}. Verify the URL and that the server is running.`;
  }
  if (err instanceof TypeError && String(err.cause ?? err.message).includes("ETIMEDOUT")) {
    return `Request to ${productConfig.name} timed out. The server may be overloaded or unreachable at ${endpoint}.`;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return `Request to ${url} timed out after ${getTimeout()}ms.`;
  }
  if (err instanceof Error) {
    return `Network error calling ${url}: ${err.message}`;
  }
  return `Unknown error calling ${url}: ${String(err)}`;
}

function formatHttpError(status: number, body: string, url: string): string {
  const snippet = body.slice(0, 500);
  switch (status) {
    case 401:
      return `Authentication failed. The API token may be expired or invalid. Generate a new token in ${productConfig.name} > ${productConfig.tokenUiPath}.`;
    case 403:
      return `Access denied for ${url}. The API token does not have permission for this operation. Check the token's role and access scope.`;
    case 404:
      return `Endpoint not found: ${url}. Verify the path using rhacs_get_endpoint_details.`;
    default:
      if (status >= 500) {
        return `${productConfig.name} returned server error ${status}: ${snippet}`;
      }
      return `${productConfig.name} returned HTTP ${status} for ${url}: ${snippet}`;
  }
}

export async function rhacsApiCall(
  method: string,
  path: string,
  options?: {
    queryParams?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  },
): Promise<ApiResponse> {
  const baseUrl = process.env[productConfig.endpointEnvVar];
  if (!baseUrl) {
    throw new Error(
      `${productConfig.endpointEnvVar} environment variable is not set. Set it to your ${productConfig.name} URL (e.g. ${productConfig.endpointExample}).`,
    );
  }
  const apiToken = process.env[productConfig.tokenEnvVar];
  if (!apiToken) {
    throw new Error(
      `${productConfig.tokenEnvVar} environment variable is not set. Generate an API token in ${productConfig.name} > ${productConfig.tokenUiPath}.`,
    );
  }

  const url = new URL(path, baseUrl);
  if (options?.queryParams) {
    for (const [k, v] of Object.entries(options.queryParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const timeout = options?.timeoutMs ?? getTimeout();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (options?.body !== undefined && !["GET", "DELETE"].includes(method)) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(formatHttpError(res.status, body, url.toString()));
    }

    const data = await res.json();
    const { data: finalData, truncated } = truncateResponse(data);
    return { status: res.status, data: finalData, truncated };
  } catch (err) {
    clearTimeout(timer);
    if (
      err instanceof Error &&
      (err.message.startsWith("Authentication failed") ||
        err.message.startsWith("Access denied") ||
        err.message.startsWith("Endpoint not found") ||
        err.message.startsWith(productConfig.name))
    )
      throw err;
    throw new Error(formatNetworkError(err, url.toString()));
  }
}
