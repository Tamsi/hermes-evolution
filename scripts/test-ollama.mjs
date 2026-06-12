#!/usr/bin/env node
/**
 * Test LLM extraction against Ollama (local or cloud).
 *
 * Usage:
 *   HERMES_LLM_PROVIDER=ollama CURATOR_LLM_MODEL=deepseek-v4-flash:cloud node scripts/test-ollama.mjs
 *   HERMES_LLM_PROVIDER=ollama CURATOR_LLM_MODEL=qwen3.5:4b node scripts/test-ollama.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
delete process.env['CURATOR_MOCK_LLM'];
delete process.env['HERMES_MOCK_LLM'];

const provider = process.env['HERMES_LLM_PROVIDER'] ?? 'ollama';
const model = process.env['CURATOR_LLM_MODEL'] ?? process.env['OLLAMA_MODEL'] ?? 'qwen3.5:4b';
const baseUrl = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';

process.env['HERMES_LLM_PROVIDER'] = provider;
process.env['CURATOR_LLM_MODEL'] = model;

const findings = [
  {
    source: 'Symfony CHANGELOG (8.2)',
    title: 'Deprecated ServiceSubscriberInterface',
    finding:
      'Implementing ServiceSubscriberInterface is deprecated since Symfony 8.2. Use constructor injection with readonly properties instead.',
    url: 'https://github.com/symfony/symfony/blob/8.2/CHANGELOG.md',
    fetchedAt: new Date().toISOString(),
    confidence: 0.95,
  },
  {
    source: 'Drupal CHANGELOG (11.4.x)',
    title: 'Plugin attributes preferred',
    finding:
      'Drupal 11 recommends PHP attributes over docblock annotations for plugin discovery in new modules.',
    url: 'https://api.drupal.org/api/drupal/core%21CHANGELOG.txt/11.4',
    fetchedAt: new Date().toISOString(),
    confidence: 0.93,
  },
];

console.log(`Testing Ollama extraction`);
console.log(`  Provider: ${provider}`);
console.log(`  Model:    ${model}`);
console.log(`  Base URL: ${baseUrl}`);
console.log('');

console.log('=== Preflight: Ollama model check ===');
const preflight = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    stream: false,
    options: { temperature: 0 },
  }),
});

const preflightBody = await preflight.json();

if (preflightBody.error) {
  console.error(`❌ Ollama rejected model "${model}":`);
  console.error(`   ${preflightBody.error}`);
  if (preflightBody.error.includes('subscription')) {
    console.error('\n   Cloud models require Ollama Plus: https://ollama.com/upgrade');
    console.error('   Or use a local model: CURATOR_LLM_MODEL=qwen3.5:4b');
  }
  process.exit(1);
}

const preflightContent = preflightBody.message?.content?.trim() ?? '';
if (!preflightContent) {
  console.warn(`⚠️  Model "${model}" responded with empty content (unusable for JSON extraction).`);
  console.warn('   Try another model, e.g. qwen3.5:4b (local) or deepseek-v4-flash:cloud (with subscription).');
  process.exit(1);
}

console.log(`  OK — model responded: "${preflightContent.slice(0, 60)}"`);
console.log('');

const { LlmKnowledgeExtractor } = await import('../packages/extraction/dist/application/llm-knowledge-extractor.js');

console.log('=== Extraction test ===');
const started = Date.now();
const extractor = new LlmKnowledgeExtractor({ providerName: 'ollama', batchSize: 2 });
const results = await extractor.extract(findings);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`Done in ${elapsed}s — ${String(results.length)} practice(s):\n`);

const fallbackPattern = /^\[mock-llm\]|^Review and migrate away from deprecated API:/;
let usedLlm = true;

for (const item of results) {
  if (fallbackPattern.test(item.practice)) {
    usedLlm = false;
  }
  console.log(`[${item.framework}/${item.category}] (${item.importance}, conf=${String(item.confidence)})`);
  console.log(`  ${item.practice}`);
  console.log(`  source: ${item.sourceRef}`);
  console.log('');
}

if (!usedLlm) {
  console.error('⚠️  Rule-based fallback was used — LLM JSON parse likely failed.');
  console.error('   Re-run with CURATOR_LLM_DEBUG=1 for details (if enabled).');
  process.exit(1);
}

console.log('✅ Ollama LLM extraction succeeded');
