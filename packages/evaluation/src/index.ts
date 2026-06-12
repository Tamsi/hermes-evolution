import { SkillEvaluator } from '@hermes/evaluator';
import { YamlSkillLoader, type FileSystemPort } from '@hermes/core';
import { NodeFileSystem } from '@curator/core';
import type { AuditReport, EvaluationGate } from '@curator/core';
import type { EvaluationGatePort } from '@curator/core';

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

  mkdir(): Promise<void> {
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

export class CuratorEvaluationGate implements EvaluationGatePort {
  private readonly evaluator: SkillEvaluator;

  constructor() {
    const fs = new NodeFileSystem();
    const adapter = new HermesFileSystemAdapter(fs);
    this.evaluator = new SkillEvaluator(adapter, new YamlSkillLoader(adapter), undefined, false);
  }

  async evaluate(
    skillPath: string,
    before: AuditReport,
    after: AuditReport,
  ): Promise<EvaluationGate> {
    const validation = await this.evaluator.validate(skillPath);
    const scoreDelta = after.score.overall_score - before.score.overall_score;
    const regressions: string[] = [];

    if (scoreDelta < 0) {
      regressions.push(`Score decreased by ${String(Math.abs(scoreDelta))} points`);
    }
    if (!validation.valid) {
      regressions.push(...validation.manifestErrors, ...validation.promptErrors);
    }

    return {
      passed: regressions.length === 0 && scoreDelta >= 0,
      skill: before.skill,
      scoreDelta,
      regressions,
      validationValid: validation.valid,
    };
  }
}
