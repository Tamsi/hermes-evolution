import type { SkillAuditContext } from '@curator/core';
import { loadSkillContexts, NodeFileSystem } from '@curator/core';
import type { SkillRegistryPort } from '@curator/core';
import { YamlSkillLoader, type FileSystemPort } from '@hermes/core';

class HermesFileSystemAdapter implements FileSystemPort {
  constructor(private readonly fs: NodeFileSystem) {}

  readFile(path: string): Promise<string> {
    return this.fs.readFile(path);
  }

  writeFile(path: string, content: string): Promise<void> {
    return this.fs.writeFile(path, content);
  }

  exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  mkdir(path: string, recursive?: boolean): Promise<void> {
    void recursive;
    return Promise.resolve();
  }

  readdir(path: string): Promise<string[]> {
    return this.fs.readdir(path);
  }

  listFiles(path: string): Promise<string[]> {
    return this.fs.listFiles(path);
  }

  copyDir(): Promise<void> {
    return Promise.resolve();
  }

  readDirRecursive(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

export class HermesSkillRegistry implements SkillRegistryPort {
  private readonly fs = new NodeFileSystem();
  private readonly loader = new YamlSkillLoader(new HermesFileSystemAdapter(this.fs));

  constructor(private readonly registryPath: string) {}

  async listSkills(registryPath = this.registryPath): Promise<SkillAuditContext[]> {
    return loadSkillContexts(registryPath, this.loader, this.fs);
  }
}

export { SkillAuditor } from './application/skill-auditor.js';
