import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  EndpointSpec,
  ModelSpec,
  ServiceIndex,
  ServiceSpec,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_SPEC_DIR = resolve(__dirname, "..", "api_spec");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const servicesByKey = new Map<string, ServiceSpec>();
const allEndpoints: Array<{ service: string; endpoint: EndpointSpec }> = [];
const modelsByKey = new Map<string, ModelSpec>();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\s-]+/g, " ").trim();
}

function registerService(service: ServiceSpec, filename: string): void {
  const slug = filename.replace(/\.json$/, "");
  const keys = new Set([
    service.service,
    service.service.toLowerCase(),
    normalize(service.service),
    slug,
    slug.replace(/_/g, " "),
    normalize(service.service).replace(/ service$/, ""),
  ]);
  for (const key of keys) {
    servicesByKey.set(key, service);
  }
  for (const ep of service.endpoints) {
    allEndpoints.push({ service: service.service, endpoint: ep });
  }
}

// Load on module initialization
const index = readJson<ServiceIndex>(resolve(API_SPEC_DIR, "_index.json"));
for (const entry of index.services) {
  if (entry.file === "common_object_reference.json") continue;
  const spec = readJson<ServiceSpec>(resolve(API_SPEC_DIR, entry.file));
  registerService(spec, entry.file);
}

// Load models
const modelsFile = readJson<{
  models: Record<string, ModelSpec>;
}>(resolve(API_SPEC_DIR, "common_object_reference.json"));
for (const [key, model] of Object.entries(modelsFile.models)) {
  modelsByKey.set(key, model);
  modelsByKey.set(model.name, model);
  modelsByKey.set(model.name.toLowerCase(), model);
  const withoutSuffix = key.replace(/_CommonObjectReference$/, "");
  if (withoutSuffix !== key) {
    modelsByKey.set(withoutSuffix, model);
  }
}

export function getServiceList(): Array<{
  name: string;
  endpointCount: number;
  chapter: number;
}> {
  const seen = new Set<string>();
  const results: Array<{
    name: string;
    endpointCount: number;
    chapter: number;
  }> = [];
  for (const entry of index.services) {
    if (entry.file === "common_object_reference.json") continue;
    if (seen.has(entry.title)) continue;
    seen.add(entry.title);
    results.push({
      name: entry.title,
      endpointCount: entry.endpoint_count ?? 0,
      chapter: entry.chapter,
    });
  }
  return results;
}

export function getService(name: string): ServiceSpec | undefined {
  return servicesByKey.get(name) ?? servicesByKey.get(normalize(name));
}

export function getEndpoint(
  serviceName: string,
  endpointName: string,
): EndpointSpec | undefined {
  const svc = getService(serviceName);
  if (!svc) return undefined;
  const lower = endpointName.toLowerCase();
  return svc.endpoints.find((ep) => ep.name.toLowerCase() === lower);
}

export function getModel(name: string): ModelSpec | undefined {
  return (
    modelsByKey.get(name) ??
    modelsByKey.get(name.toLowerCase()) ??
    modelsByKey.get(name.replace(/_CommonObjectReference$/, ""))
  );
}

export function searchEndpoints(
  keyword: string,
): Array<{ service: string; endpoint: EndpointSpec }> {
  const lower = keyword.toLowerCase();
  return allEndpoints.filter(
    ({ service, endpoint }) =>
      endpoint.name.toLowerCase().includes(lower) ||
      endpoint.path.toLowerCase().includes(lower) ||
      (endpoint.description?.toLowerCase().includes(lower) ?? false) ||
      service.toLowerCase().includes(lower),
  );
}

export function findClosestServices(name: string, max = 5): string[] {
  const lower = normalize(name);
  const scored: Array<{ name: string; score: number }> = [];
  const seen = new Set<string>();
  for (const entry of index.services) {
    if (entry.file === "common_object_reference.json") continue;
    if (seen.has(entry.title)) continue;
    seen.add(entry.title);
    const normalized = normalize(entry.title);
    let score = 0;
    if (normalized.includes(lower)) score += 2;
    if (lower.includes(normalized.replace(/ service$/, ""))) score += 1;
    const words = lower.split(" ");
    for (const w of words) {
      if (normalized.includes(w)) score += 1;
    }
    if (score > 0) scored.push({ name: entry.title, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.name);
}

export function findClosestModels(name: string, max = 5): string[] {
  const lower = name.toLowerCase();
  const results: string[] = [];
  const seen = new Set<string>();
  for (const [, model] of modelsByKey) {
    if (seen.has(model.name)) continue;
    seen.add(model.name);
    if (model.name.toLowerCase().includes(lower)) {
      results.push(model.name);
      if (results.length >= max) break;
    }
  }
  return results;
}
