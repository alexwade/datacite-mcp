/**
 * Reads a template file from the project-root `templates/` directory and
 * substitutes {{variable}} placeholders with the supplied values.
 * Unknown placeholders are left as-is.
 * Throws if the file is missing.
 */
export declare function renderTemplate(name: string, vars: Record<string, string>): string;
