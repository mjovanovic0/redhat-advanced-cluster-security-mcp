#!/usr/bin/env node
// Generate api_spec/ from the RHACS OpenAPI (Swagger 2.0) specs.
//
// Usage:
//   node scripts/generate-api-spec.mjs <version>                 # e.g. 4.11.6, fetched from the Red Hat mirror
//   node scripts/generate-api-spec.mjs <file-or-url> [...]       # explicit v1/v2 swagger files or URLs
//
// The RHACS specs are published at
//   https://mirror.openshift.com/pub/rhacs/openapi-spec/<version>/v1.swagger.json
//   https://mirror.openshift.com/pub/rhacs/openapi-spec/<version>/v2.swagger.json

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIRROR = "https://mirror.openshift.com/pub/rhacs/openapi-spec";
const SUFFIX = "_CommonObjectReference";
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "api_spec");
const METHODS = ["get", "post", "put", "patch", "delete"];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/generate-api-spec.mjs <rhacs-version> | <swagger-file-or-url> [...]\n" +
      "Example: node scripts/generate-api-spec.mjs 4.11.6",
  );
  process.exit(1);
}

let version = "unknown";
let sources = args;
if (args.length === 1 && /^\d+\.\d+(\.\d+)?$/.test(args[0])) {
  version = args[0];
  sources = ["v1", "v2"].map((v) => `${MIRROR}/${version}/${v}.swagger.json`);
} else {
  const m = args.join(" ").match(/\/(\d+\.\d+(?:\.\d+)?)\//);
  if (m) version = m[1];
}

async function load(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`GET ${src} failed: HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(readFileSync(src, "utf-8"));
}

// "storageAlert" -> "StorageAlert"
const modelName = (defKey) => defKey.charAt(0).toUpperCase() + defKey.slice(1);
const refName = (ref) => modelName(ref.replace(/^#\/definitions\//, ""));
// "APITokenService" -> "API Token Service", "BaseImageServiceV2" -> "Base Image Service V2"
const humanize = (tag) =>
  tag
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])(V\d+)$/, "$1 $2");
const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// Describe a schema as {type, type_ref?}
function describeSchema(schema) {
  if (!schema) return { type: "Object" };
  if (schema.$ref) {
    const name = refName(schema.$ref);
    return { type: name, type_ref: name + SUFFIX };
  }
  if (schema.type === "array") {
    const inner = describeSchema(schema.items);
    return { type: `List of ${inner.type}`, type_ref: inner.type_ref };
  }
  if (schema.type === "object" && schema.additionalProperties) {
    const inner = describeSchema(schema.additionalProperties);
    return { type: `Map of ${inner.type}`, type_ref: inner.type_ref };
  }
  if (schema.title?.startsWith("Stream result of")) {
    const inner = describeSchema(schema.properties?.result);
    return { type: `Stream result of ${inner.type}`, type_ref: inner.type_ref };
  }
  return { type: schema.type ?? "Object" };
}

function convertParam(p) {
  const extra = [];
  const t = p.type === "array" ? `array of ${p.items?.type ?? "string"}` : p.type;
  if (t) extra.push(`Type: ${t}${p.format ? ` (${p.format})` : ""}.`);
  const enumValues = p.enum ?? p.items?.enum;
  if (enumValues) extra.push(`One of: ${enumValues.join(", ")}.`);
  return {
    name: p.name,
    description: [clean(p.description), ...extra].filter(Boolean).join(" "),
    required: p.required ? "X" : "",
    default: p.default !== undefined ? String(p.default) : "null",
    pattern: p.pattern ?? "",
  };
}

function convertOperation(method, path, op) {
  const params = op.parameters ?? [];
  const ep = {
    name: op.operationId.replace(/^[^_]+_/, ""),
    method: method.toUpperCase(),
    path,
  };
  const description = clean([op.summary, op.description].filter(Boolean).join(" — "));
  if (description) ep.description = description;

  const pathParams = params.filter((p) => p.in === "path").map(convertParam);
  const queryParams = params.filter((p) => p.in === "query").map(convertParam);
  const body = params.filter((p) => p.in === "body");
  if (pathParams.length) ep.path_parameters = pathParams;
  if (queryParams.length) ep.query_parameters = queryParams;
  if (body.length) {
    ep.body_parameter = body.map((p) => {
      const d = describeSchema(p.schema);
      return {
        name: p.name,
        ...(d.type_ref ? { type_ref: d.type_ref } : {}),
        description: d.type_ref ? clean(p.description) || d.type : d.type,
        required: p.required ? "X" : "",
      };
    });
  }

  const ok = describeSchema(op.responses?.["200"]?.schema);
  ep.return_type = ok.type;
  if (ok.type_ref) ep.return_type_ref = ok.type_ref;
  ep.content_type = "application/json";
  ep.responses = Object.entries(op.responses ?? {}).map(([code, r]) => {
    const d = describeSchema(r.schema);
    return {
      code,
      message: clean(r.description),
      datatype: d.type,
      ...(d.type_ref ? { datatype_ref: d.type_ref } : {}),
    };
  });
  return ep;
}

function convertModel(key, def) {
  const name = modelName(key);
  if (def.enum) return { name, enum_values: def.enum.map(String) };
  const required = new Set(def.required ?? []);
  const fields = Object.entries(def.properties ?? {}).map(([fname, prop]) => {
    const d = describeSchema(prop);
    const field = { name: fname, type: d.type };
    if (d.type_ref) field.type_ref = d.type_ref;
    if (prop.format) field.format = prop.format;
    const desc = clean(prop.description ?? prop.title);
    const enumValues = prop.enum ?? prop.items?.enum;
    const full = [desc, enumValues ? `One of: ${enumValues.join(", ")}.` : ""].filter(Boolean).join(" ");
    if (full) field.description = full;
    if (required.has(fname)) field.required = true;
    return field;
  });
  return { name, fields };
}

const services = new Map(); // title -> { title, endpoints }
const models = {};
const sourceNames = [];

for (const src of sources) {
  console.error(`Loading ${src}`);
  const spec = await load(src);
  if (spec.swagger !== "2.0") throw new Error(`${src}: expected Swagger 2.0, got ${spec.swagger ?? spec.openapi}`);
  sourceNames.push(src);

  // Services that already exist from an earlier spec get the API version appended.
  const titleFor = new Map();
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const op = ops[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? op.operationId.split("_")[0];
      if (!titleFor.has(tag)) {
        let title = humanize(tag);
        if (services.has(title)) {
          const apiVersion = path.split("/")[1] ?? "alt";
          title = `${title} (${apiVersion})`;
        }
        titleFor.set(tag, title);
      }
      const title = titleFor.get(tag);
      if (!services.has(title)) services.set(title, { title, endpoints: [] });
      services.get(title).endpoints.push(convertOperation(method, path, op));
    }
  }

  for (const [key, def] of Object.entries(spec.definitions ?? {})) {
    const name = modelName(key);
    if (!(name in models)) models[name] = convertModel(key, def);
  }
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const sorted = [...services.values()].sort((a, b) => a.title.localeCompare(b.title));
const indexEntries = [];
let chapter = 0;
for (const svc of sorted) {
  chapter++;
  const file = `${slugify(svc.title)}.json`;
  svc.endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  writeFileSync(
    resolve(OUT_DIR, file),
    JSON.stringify(
      { chapter, service: svc.title, endpoint_count: svc.endpoints.length, endpoints: svc.endpoints },
      null,
      2,
    ),
  );
  indexEntries.push({ chapter, title: svc.title, file, endpoint_count: svc.endpoints.length });
}

const modelEntries = Object.fromEntries(
  Object.entries(models)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, m]) => [name + SUFFIX, m]),
);
writeFileSync(resolve(OUT_DIR, "common_object_reference.json"), JSON.stringify({ models: modelEntries }, null, 2));
indexEntries.push({
  chapter: chapter + 1,
  title: "Common Object Reference",
  file: "common_object_reference.json",
  model_count: Object.keys(models).length,
});

const endpointTotal = sorted.reduce((n, s) => n + s.endpoints.length, 0);
writeFileSync(
  resolve(OUT_DIR, "_index.json"),
  JSON.stringify(
    {
      product: "Red Hat Advanced Cluster Security for Kubernetes",
      version,
      source: sourceNames.join(", "),
      service_count: sorted.length,
      services: indexEntries,
    },
    null,
    2,
  ),
);

console.error(
  `Wrote ${OUT_DIR}: ${sorted.length} services, ${endpointTotal} endpoints, ${Object.keys(models).length} models (RHACS ${version})`,
);
