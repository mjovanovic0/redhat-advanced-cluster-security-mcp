import { z } from "zod";
import { getService, findClosestServices } from "../registry.js";

export const listEndpointsSchema = z.object({
  service_name: z
    .string()
    .describe(
      "Name of the RHACS API service (e.g. 'Alert Service', 'Deployment Service'). Get valid names from rhacs_list_services.",
    ),
});

export async function listEndpoints(input: {
  service_name: string;
}): Promise<string> {
  const svc = getService(input.service_name);
  if (!svc) {
    const suggestions = findClosestServices(input.service_name);
    return `Service "${input.service_name}" not found.${suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : ""} Use rhacs_list_services to see all available services.`;
  }

  const lines = svc.endpoints.map((ep) => {
    const desc = ep.description ? ` — ${ep.description}` : "";
    return `${ep.method} ${ep.path}  [${ep.name}]${desc}`;
  });

  return [`${svc.service} — ${svc.endpoint_count} endpoints\n`, ...lines].join(
    "\n",
  );
}
