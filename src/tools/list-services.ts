import { z } from "zod";
import { getServiceList } from "../registry.js";

export const listServicesSchema = z.object({});

export async function listServices(): Promise<string> {
  const services = getServiceList();
  const lines = services.map(
    (s) => `${s.name} (${s.endpointCount} endpoints)`,
  );
  return [
    `RHACS API — ${services.length} services, ${services.reduce((sum, s) => sum + s.endpointCount, 0)} total endpoints\n`,
    ...lines,
  ].join("\n");
}
