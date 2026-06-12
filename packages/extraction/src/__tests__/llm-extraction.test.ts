import { describe, expect, it } from 'vitest';
import { ExtractionResponseSchema } from '../application/extraction-schema.js';
import { MockStructuredKnowledgeExtractor } from '../application/mock-structured-extractor.js';
import { LlmKnowledgeExtractor } from '../application/llm-knowledge-extractor.js';
import type { SourceFinding } from '@curator/core';

const sampleFinding: SourceFinding = {
  role: 'code-architect',
  source: 'Symfony CHANGELOG (8.2)',
  title: 'Deprecated container->get() in favor of constructor injection',
  finding: 'The container->get() method is deprecated when used outside compiled containers.',
  url: 'https://example.com/changelog',
  fetchedAt: new Date().toISOString(),
  confidence: 0.95,
};

describe('ExtractionResponseSchema', () => {
  it('validates LLM JSON shape', () => {
    const result = ExtractionResponseSchema.safeParse({
      items: [
        {
          sourceIndex: 0,
          category: 'deprecation',
          practice: 'Replace container->get() with constructor injection using readonly properties.',
          importance: 'high',
          confidence: 0.9,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('MockStructuredKnowledgeExtractor', () => {
  it('returns actionable mock practices', async () => {
    const extractor = new MockStructuredKnowledgeExtractor();
    const items = await extractor.extract([sampleFinding]);
    expect(items).toHaveLength(1);
    expect(items[0]?.practice).toContain('[mock-llm]');
    expect(items[0]?.role).toBe('code-architect');
  });
});

describe('LlmKnowledgeExtractor fallback', () => {
  it('falls back when provider unavailable', async () => {
    const extractor = new LlmKnowledgeExtractor({
      providerFactory: {
        create: () => ({
          name: 'openai',
          defaultModel: 'test',
          isAvailable: async () => false,
          complete: async () => ({ content: '', model: 'test', provider: 'openai' }),
        }),
        getDefault: () => ({
          name: 'openai',
          defaultModel: 'test',
          isAvailable: async () => false,
          complete: async () => ({ content: '', model: 'test', provider: 'openai' }),
        }),
        listAvailable: async () => [],
      } as never,
    });

    const items = await extractor.extract([sampleFinding]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.sourceRef).toBe(sampleFinding.url);
  });
});
