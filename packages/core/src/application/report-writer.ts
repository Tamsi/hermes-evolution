import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CuratorRunReport } from '../domain/types.js';
import type { ReportWriterPort } from '../ports/index.js';

export class MarkdownReportWriter implements ReportWriterPort {
  async write(
    report: CuratorRunReport,
    outputDir: string,
  ): Promise<{ markdownPath: string; jsonPath: string }> {
    await mkdir(outputDir, { recursive: true });
    const markdownPath = join(outputDir, `report-${report.runId}.md`);
    const jsonPath = join(outputDir, `report-${report.runId}.json`);

    const markdown = renderMarkdown(report);
    await writeFile(markdownPath, markdown, 'utf-8');
    await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    return { markdownPath, jsonPath };
  }
}

function renderMarkdown(report: CuratorRunReport): string {
  const lines: string[] = [
    `# Hermes Curator Report`,
    ``,
    `- **Run ID:** ${report.runId}`,
    `- **Started:** ${report.startedAt}`,
    `- **Completed:** ${report.completedAt}`,
    `- **Findings:** ${report.findingsCount}`,
    `- **Knowledge items:** ${report.knowledgeCount}`,
    ``,
    `## Skill Audits`,
    ``,
  ];

  for (const audit of report.audits) {
    lines.push(`### ${audit.skill} — score ${audit.score.overall_score}/100`, ``);
    if (audit.issues.length === 0) {
      lines.push(`No issues detected.`, ``);
      continue;
    }
    for (const issue of audit.issues) {
      lines.push(`- **[${issue.severity}]** ${issue.type}: ${issue.message}`);
    }
    lines.push(``);
    if (audit.recommendations.length > 0) {
      lines.push(`**Recommendations:**`);
      for (const rec of audit.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push(``);
    }
  }

  if (report.patches.length > 0) {
    lines.push(`## Proposed Patches`, ``);
    for (const patch of report.patches) {
      lines.push(`- **${patch.skill}** / ${patch.filePath}: ${patch.summary}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
