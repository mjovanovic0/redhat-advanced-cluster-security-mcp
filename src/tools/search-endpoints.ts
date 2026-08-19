import { z } from "zod";
import { searchEndpoints } from "../registry.js";

export const searchEndpointsSchema = z.object({
  keyword: z
    .string()
    .describe(
      "Search term to find matching API endpoints. Searches endpoint names, paths, and descriptions. Examples: 'vulnerability', 'deploy', 'policy', 'CVE', 'compliance'.",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum results to return (default: 20, max: 50)."),
});

export async function searchEndpointsHandler(input: {
  keyword: string;
  limit?: number;
}): Promise<string> {
  const max = Math.min(input.limit ?? 20, 50);
  const results = searchEndpoints(input.keyword);

  if (results.length === 0) {
    return `No endpoints found matching "${input.keyword}". Try a broader search term or use rhacs_list_services to browse by service.`;
  }

  const limited = results.slice(0, max);
  const lines = limited.map(({ service, endpoint }) => {
    const desc = endpoint.description ? ` — ${endpoint.description}` : "";
    return `[${service}] ${endpoint.method} ${endpoint.path}  ${endpoint.name}${desc}`;
  });

  const header =
    results.length > max
      ? `Found ${results.length} endpoints matching "${input.keyword}" (showing first ${max}):\n`
      : `Found ${results.length} endpoints matching "${input.keyword}":\n`;

  return header + lines.join("\n");
}
