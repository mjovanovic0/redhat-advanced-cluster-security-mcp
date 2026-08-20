import { z } from "zod";
import { getEndpoint, getService, findClosestServices, stripModelSuffix } from "../registry.js";
import type { EndpointSpec } from "../types.js";

export const getEndpointDetailsSchema = z.object({
  service_name: z
    .string()
    .describe("Name of the RHACS API service (e.g. 'Alert Service')."),
  endpoint_name: z
    .string()
    .describe(
      "Name of the endpoint (e.g. 'ListAlerts', 'GetDeployment'). Get valid names from rhacs_list_endpoints.",
    ),
});

function formatEndpoint(ep: EndpointSpec): string {
  const sections: string[] = [
    `## ${ep.name}`,
    `${ep.method} ${ep.path}`,
  ];

  if (ep.description) {
    sections.push(`\n${ep.description}`);
  }

  if (ep.path_parameters?.length) {
    sections.push("\n### Path Parameters");
    for (const p of ep.path_parameters) {
      const req = p.required === "X" ? " (required)" : "";
      const desc = p.description ? ` — ${p.description}` : "";
      sections.push(`- ${p.name}${req}${desc}`);
    }
  }

  if (ep.query_parameters?.length) {
    sections.push("\n### Query Parameters");
    for (const p of ep.query_parameters) {
      const req = p.required === "X" ? " (required)" : "";
      const def = p.default && p.default !== "null" ? ` [default: ${p.default}]` : "";
      const desc = p.description ? ` — ${p.description}` : "";
      sections.push(`- ${p.name}${req}${def}${desc}`);
    }
  }

  if (ep.body_parameter?.length) {
    sections.push("\n### Body Parameter");
    for (const p of ep.body_parameter) {
      const typeRef = (p.type_ref ? stripModelSuffix(p.type_ref) : undefined) ?? p.description;
      sections.push(
        `- ${p.name}: ${typeRef} (use rhacs_get_model to see the schema)`,
      );
    }
  }

  sections.push(`\n### Return Type`);
  const retRef = ep.return_type_ref ? stripModelSuffix(ep.return_type_ref) : undefined;
  if (retRef) {
    sections.push(
      `${ep.return_type} (use rhacs_get_model with "${retRef}" to see fields)`,
    );
  } else {
    sections.push(ep.return_type);
  }

  sections.push(`\n### Content Type\n${ep.content_type}`);

  if (ep.responses?.length) {
    sections.push("\n### Responses");
    for (const r of ep.responses) {
      sections.push(`- ${r.code}: ${r.message} → ${r.datatype}`);
    }
  }

  return sections.join("\n");
}

export async function getEndpointDetails(input: {
  service_name: string;
  endpoint_name: string;
}): Promise<string> {
  const svc = getService(input.service_name);
  if (!svc) {
    const suggestions = findClosestServices(input.service_name);
    return `Service "${input.service_name}" not found.${suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : ""} Use rhacs_list_services to see all available services.`;
  }

  const ep = getEndpoint(input.service_name, input.endpoint_name);
  if (!ep) {
    const names = svc.endpoints.map((e) => e.name).join(", ");
    return `Endpoint "${input.endpoint_name}" not found in ${svc.service}. Available endpoints: ${names}`;
  }

  return formatEndpoint(ep);
}
