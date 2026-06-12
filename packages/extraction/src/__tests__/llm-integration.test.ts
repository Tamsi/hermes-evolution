import { describe, expect, it } from 'vitest';
import { LlmKnowledgeExtractor } from '../application/llm-knowledge-extractor.js';
import { createKnowledgeExtractor } from '../application/llm-knowledge-extractor.js';
import { MockStructuredKnowledgeExtractor } from '../application/mock-structured-extractor.js';
import type { SourceFinding } from '@curator/core';
import type { LLMProvider, LLMProviderFactory, LLMProviderName } from '@hermes/core';

const sampleFindings: SourceFinding[] = [
  {
    source: 'Symfony CHANGELOG (8.2)',
    title: 'Deprecated ServiceSubscriberInterface',
    finding:
      'Implementing ServiceSubscriberInterface is deprecated. Use constructor injection with readonly properties instead.',
    url: 'https://github.com/symfony/symfony/blob/8.2/CHANGELOG.md',
    fetchedAt: new Date().toISOString(),
    confidence: 0.95,
  },
  {
    source: 'Drupal CHANGELOG (11.4.x)',
    title: 'Plugin discovery attributes',
    finding: 'Drupal 11 prefers PHP attributes over annotations for plugin discovery in new modules.',
    url: 'https://api.drupal.org/api/drupal/core%21CHANGELOG.txt/11.4',
    fetchedAt: new Date().toISOString(),
    confidence: 0.93,
  },
];

function createFakeLlmFactory(responseJson: object): LLMProviderFactory {
  const provider: LLMProvider = {
    name: 'anthropic',
    isAvailable: async () => true,
    complete: async () => ({
      content: JSON.stringify(responseJson),
      model: 'test-model',
      provider: 'anthropic',
    }),
  };

  return {
    create: (_name: LLMProviderName) => provider,
    getDefault: () => provider,
    listAvailable: async () => ['anthropic'],
  };
}

describe('LlmKnowledgeExtractor integration', () => {
  it('parses structured JSON from LLM provider', async () => {
    const extractor = new LlmKnowledgeExtractor({
      providerFactory: createFakeLlmFactory({
        items: [
          {
            sourceIndex: 0,
            category: 'deprecation',
            framework: 'symfony',
            practice:
              'Replace ServiceSubscriberInterface with constructor injection using readonly promoted properties.',
            importance: 'high',
            confidence: 0.94,
          },
          {
            sourceIndex: 1,
            category: 'architecture',
            framework: 'drupal',
            practice: 'Use PHP attributes for plugin discovery on Drupal 11 new code.',
            importance: 'high',
            confidence: 0.91,
          },
        ],
      }),
      batchSize: 5,
    });

    const results = await extractor.extract(sampleFindings);

    expect(results).toHaveLength(2);
    expect(results[0]?.framework).toBe('symfony');
    expect(results[0]?.practice).toContain('constructor injection');
    expect(results[0]?.sourceRef).toContain('symfony');
    expect(results[1]?.framework).toBe('drupal');
    expect(results[1]?.practice).toContain('attributes');
  });

  it('createKnowledgeExtractor uses mock when CURATOR_MOCK_LLM=true', () => {
    const prev = process.env['CURATOR_MOCK_LLM'];
    process.env['CURATOR_MOCK_LLM'] = 'true';
    const extractor = createKnowledgeExtractor();
    expect(extractor).toBeInstanceOf(MockStructuredKnowledgeExtractor);
    if (prev === undefined) {
      delete process.env['CURATOR_MOCK_LLM'];
    } else {
      process.env['CURATOR_MOCK_LLM'] = prev;
    }
  });
});
