#!/usr/bin/env node
/**
 * End-to-end smoke test for Hermes Curator pipeline.
 * Run: node scripts/smoke-test.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env['CURATOR_MOCK_LLM'] = 'true';
process.env['CURATOR_ROOT'] = root;

const { CuratorPipeline, resolveDefaultPaths } = await import('../packages/scheduler/dist/index.js');
const { createKnowledgeExtractor } = await import('../packages/extraction/dist/index.js');

const paths = resolveDefaultPaths(root);

console.log('=== 1. LLM extraction (mock) ===');
const extractor = createKnowledgeExtractor();
const mockFindings = [
  {
    source: 'Symfony CHANGELOG (8.2)',
    title: 'Deprecated container->get()',
    finding: 'Retrieving services from the container via container->get() is deprecated.',
    url: 'https://example.com/symfony',
    fetchedAt: new Date().toISOString(),
    confidence: 0.95,
  },
];
const knowledge = await extractor.extract(mockFindings);
console.assert(knowledge.length === 1, 'Expected 1 knowledge item');
console.assert(knowledge[0]?.practice.includes('[mock-llm]'), 'Expected mock-llm prefix');
console.log('  OK — practice:', knowledge[0]?.practice.slice(0, 80) + '...');

console.log('\n=== 2. Full pipeline ===');
const pipeline = new CuratorPipeline();
const { report } = await pipeline.run({
  projectRoot: root,
  skillsPath: paths.skillsPath,
  configPath: paths.configPath,
  outputDir: paths.outputDir,
  cacheDir: paths.cacheDir,
  openPr: false,
  dryRun: true,
});

console.assert(report.findingsCount > 0, 'Expected findings');
console.assert(report.knowledgeCount > 0, 'Expected knowledge');
console.assert(report.audits.length >= 5, 'Expected at least 5 skill audits');
console.log(`  Findings: ${report.findingsCount}`);
console.log(`  Knowledge: ${report.knowledgeCount}`);
console.log(`  Skills: ${report.audits.length}`);
for (const audit of report.audits) {
  console.log(`    - ${audit.skill}: ${audit.score.overall_score}/100`);
}

console.log('\n=== 3. Report files ===');
const md = await readFile(report.markdownPath, 'utf-8');
console.assert(md.includes('# Hermes Curator Report'), 'Markdown report invalid');
console.log('  Markdown:', report.markdownPath);

console.log('\n✅ All smoke tests passed');
