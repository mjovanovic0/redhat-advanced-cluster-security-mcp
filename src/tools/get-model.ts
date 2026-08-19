import { z } from "zod";
import { getModel, findClosestModels } from "../registry.js";

export const getModelSchema = z.object({
  model_name: z
    .string()
    .describe(
      "Name of the data model (e.g. 'StorageAlert', 'V1ListAlertsResponse'). Model names appear in endpoint return types and body parameter references.",
    ),
});

export async function getModelDetails(input: {
  model_name: string;
}): Promise<string> {
  const model = getModel(input.model_name);
  if (!model) {
    const suggestions = findClosestModels(input.model_name);
    return `Model "${input.model_name}" not found.${suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : ""}\nTip: model names from endpoint specs often have a _CommonObjectReference suffix — try without it.`;
  }

  const sections: string[] = [`## ${model.name}`];

  if (model.fields?.length) {
    sections.push("\n| Field | Type | Format | Description |");
    sections.push("|-------|------|--------|-------------|");
    for (const f of model.fields) {
      const typeDisplay = f.type ?? "";
      const format = f.format ?? "";
      const desc = f.description ?? "";
      const ref = f.type_ref
        ? ` (→ rhacs_get_model: "${f.type_ref.replace(/_CommonObjectReference$/, "")}")`
        : "";
      sections.push(`| ${f.name} | ${typeDisplay}${ref} | ${format} | ${desc} |`);
    }
  }

  if (model.raw?.length) {
    sections.push("\nEnum values:");
    for (const v of model.raw) {
      sections.push(`- ${v["enum values"]}`);
    }
  }

  if (model.enum_values?.length) {
    sections.push("\nEnum values:");
    for (const v of model.enum_values) {
      sections.push(`- ${v}`);
    }
  }

  return sections.join("\n");
}
