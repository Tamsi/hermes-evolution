import type { AuditReport, GitPatch, SkillAuditContext } from '@curator/core';
import type { PatchGeneratorPort } from '@curator/core';

export class AdditivePatchGenerator implements PatchGeneratorPort {
  generate(reports: AuditReport[], skills: SkillAuditContext[]): GitPatch[] {
    const patches: GitPatch[] = [];
    const skillMap = new Map(skills.map((s) => [s.name, s]));

    for (const report of reports) {
      if (report.issues.length === 0) continue;
      const skill = skillMap.get(report.skill);
      if (!skill) continue;

      const missing = report.issues.filter((i) => i.type === 'missing' && i.recommendation);
      if (missing.length === 0) continue;

      const section = buildAdditionSection(missing.map((m) => m.recommendation as string));
      const diff = buildUnifiedDiff('prompt.md', skill.prompt, `${skill.prompt.trim()}\n\n${section}`);

      patches.push({
        skill: report.skill,
        filePath: 'prompt.md',
        diff,
        summary: `Add ${String(missing.length)} knowledge gap section(s) from curator audit`,
      });
    }

    return patches;
  }
}

function buildAdditionSection(recommendations: string[]): string {
  const lines = [
    '## Curator Recommendations (auto-generated)',
    '',
    'The following practices were identified from official sources but are not yet covered:',
    '',
  ];
  for (const rec of recommendations.slice(0, 5)) {
    lines.push(`- ${rec}`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1 +1 @@`,
    `-`,
    `+${newContent.split('\n').join('\n+')}`,
  ].join('\n');
}
