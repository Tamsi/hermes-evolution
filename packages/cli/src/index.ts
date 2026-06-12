#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { CuratorPipeline, resolveDefaultPaths } from '@curator/scheduler';

const program = new Command();

function projectRoot(): string {
  const envRoot = process.env['CURATOR_ROOT'];
  if (envRoot) return resolve(envRoot);
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

function parseGithubTarget(): { owner: string; repo: string; baseBranch: string } {
  const target = process.env['CURATOR_TARGET_REPO'] ?? 'livingcolor/hermes-skills';
  const [owner = 'livingcolor', repo = 'hermes-skills'] = target.split('/');
  return { owner, repo, baseBranch: 'main' };
}

async function executePipeline(options: {
  skillsPath?: string | undefined;
  openPr: boolean;
  dryRun: boolean;
}): Promise<void> {
  const root = projectRoot();
  const paths = resolveDefaultPaths(root);
  const pipeline = new CuratorPipeline();
  const githubTarget = parseGithubTarget();
  const token = process.env['GITHUB_TOKEN'];

  const { report, pullRequest } = await pipeline.run({
    projectRoot: root,
    skillsPath: options.skillsPath ?? paths.skillsPath,
    configPath: paths.configPath,
    outputDir: paths.outputDir,
    cacheDir: paths.cacheDir,
    openPr: options.openPr,
    dryRun: options.dryRun,
    github: token
      ? { token, ...githubTarget }
      : { ...githubTarget },
  });

  console.log(`Curator run complete.`);
  console.log(`  Findings: ${String(report.findingsCount)}`);
  console.log(`  Knowledge: ${String(report.knowledgeCount)}`);
  console.log(`  Skills audited: ${String(report.audits.length)}`);
  console.log(`  Report: ${report.markdownPath}`);

  if (options.openPr) {
    if (pullRequest) {
      console.log(`  PR: ${pullRequest.url}`);
    } else {
      console.log(`  PR draft saved under .curator/pr-drafts/`);
    }
  }
}

program
  .name('curator')
  .description('Hermes Curator — autonomous AI Skills maintenance')
  .version('0.1.0');

program
  .command('run')
  .description('Full pipeline: research → audit → report')
  .option('--skills <path>', 'Path to hermes-skills registry')
  .action(async (options: { skills?: string }) => {
    await executePipeline({ skillsPath: options.skills, openPr: false, dryRun: true });
  });

program
  .command('audit')
  .description('Audit skills and print scores')
  .option('--skills <path>', 'Path to hermes-skills registry')
  .action(async (options: { skills?: string }) => {
    const root = projectRoot();
    const paths = resolveDefaultPaths(root);
    const pipeline = new CuratorPipeline();
    const { report } = await pipeline.run({
      projectRoot: root,
      skillsPath: options.skills ?? paths.skillsPath,
      configPath: paths.configPath,
      outputDir: paths.outputDir,
      cacheDir: paths.cacheDir,
      openPr: false,
      dryRun: true,
    });
    for (const audit of report.audits) {
      console.log(
        `${audit.skill}: ${String(audit.score.overall_score)}/100 (${String(audit.issues.length)} issues)`,
      );
    }
  });

program
  .command('pr')
  .description('Full pipeline and open GitHub PR (or draft in .curator/pr-drafts/)')
  .option('--dry-run', 'Write PR draft locally without calling GitHub API')
  .option('--skills <path>', 'Path to hermes-skills registry')
  .action(async (options: { dryRun?: boolean; skills?: string }) => {
    await executePipeline({
      skillsPath: options.skills,
      openPr: true,
      dryRun: options.dryRun ?? !process.env['GITHUB_TOKEN'],
    });
  });

const schedule = program.command('schedule').description('Scheduler commands');

schedule
  .command('run')
  .description('Execute scheduled weekly workflow')
  .action(async () => {
    await executePipeline({
      openPr: true,
      dryRun: !process.env['GITHUB_TOKEN'],
    });
  });

program.parse();
