import fs from "fs";
import path from "path";
import matter from "gray-matter";

export function getVaultPath(): string {
  return path.resolve(process.cwd(), "..", "knowledge");
}

export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function entityExists(type: string, id: string): boolean {
  const filePath = path.join(getVaultPath(), type, `${id}.md`);
  return fs.existsSync(filePath);
}

export function writeEntity(
  type: string,
  id: string,
  frontmatter: Record<string, unknown>,
  content: string
): void {
  const dir = path.join(getVaultPath(), type);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${id}.md`);
  const file = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, file, "utf-8");
}
