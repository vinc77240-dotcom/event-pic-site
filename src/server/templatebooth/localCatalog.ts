import { promises as fs } from "node:fs";
import path from "node:path";
import { PhotoboothTemplate } from "@/src/shared/templatebooth";

const catalogPath = path.join(process.cwd(), "data", "templatebooth-templates.json");

export async function getLocalTemplates(): Promise<PhotoboothTemplate[]> {
  try {
    const raw = await fs.readFile(catalogPath, "utf8");
    const templates = JSON.parse(raw) as PhotoboothTemplate[];
    return templates.map((template) => ({ ...template, source: "local" }));
  } catch {
    return [];
  }
}

export async function getLocalTemplateById(id: string): Promise<PhotoboothTemplate | undefined> {
  const templates = await getLocalTemplates();
  return templates.find((template) => template.id === id);
}
