import { dirname, join } from 'node:path';

export class NodeFileSystem {
  async readFile(path: string): Promise<string> {
    const { readFile } = await import('node:fs/promises');
    return readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
  }

  async exists(path: string): Promise<boolean> {
    const { access } = await import('node:fs/promises');
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async readdir(path: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  async listFiles(path: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  }
}

export async function loadSkillContexts(
  registryPath: string,
  loader: { loadFromPath: (path: string) => Promise<{ manifest: { name: string; tags: string[]; version: string }; prompt: string; rootPath: string }> },
  fs: NodeFileSystem,
): Promise<import('../domain/types.js').SkillAuditContext[]> {
  const skillDirs = await fs.readdir(registryPath);
  const skills: import('../domain/types.js').SkillAuditContext[] = [];

  for (const dir of skillDirs) {
    const skillPath = join(registryPath, dir);
    const manifestPath = join(skillPath, 'skill.yaml');
    if (!(await fs.exists(manifestPath))) continue;

    const pkg = await loader.loadFromPath(skillPath);
    skills.push({
      name: pkg.manifest.name,
      tags: pkg.manifest.tags,
      prompt: pkg.prompt,
      version: pkg.manifest.version,
      hasTests: await fs.exists(join(skillPath, 'tests')),
      hasExamples: await fs.exists(join(skillPath, 'examples')),
      rootPath: skillPath,
    });
  }

  return skills;
}
