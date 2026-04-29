import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve } from "path";
// Resolves to <project_root>/templates/ at runtime.
// This file compiles to dist/prompts/template-loader.js, so two levels up is the project root.
const TEMPLATE_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "templates");
/**
 * Reads a template file from the project-root `templates/` directory and
 * substitutes {{variable}} placeholders with the supplied values.
 * Unknown placeholders are left as-is.
 * Throws if the file is missing.
 */
export function renderTemplate(name, vars) {
    const filePath = resolve(TEMPLATE_DIR, name);
    let content;
    try {
        content = readFileSync(filePath, "utf-8");
    }
    catch {
        throw new Error(`Prompt template not found: ${filePath}`);
    }
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => key in vars ? vars[key] : `{{${key}}}`);
}
