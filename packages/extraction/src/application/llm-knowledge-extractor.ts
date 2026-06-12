import type { LLMProvider, LLMProviderFactory, LLMProviderName } from '@hermes/core';
import { extractJsonFromText } from '@hermes/core';
import { DefaultLLMProviderFactory } from '@hermes/runner';
import type { RawKnowledge, SourceFinding } from '@curator/core';
import type { KnowledgeExtractorPort } from '@curator/core';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './extraction-prompt.js';
import { ExtractionResponseSchema } from './extraction-schema.js';
import { RuleBasedKnowledgeExtractor } from './rule-based-extractor.js';
import { MockStructuredKnowledgeExtractor } from './mock-structured-extractor.js';

const BATCH_SIZE = 5;

/** Auto-detect order — Ollama excluded unless HERMES_LLM_PROVIDER=ollama is set explicitly. */
const DEFAULT_PROVIDER_ORDER: LLMProviderName[] = ['anthropic', 'openai', 'gemini'];

export interface LlmKnowledgeExtractorOptions {
  providerFactory?: LLMProviderFactory;
  providerName?: LLMProviderName;
  batchSize?: number;
  fallback?: KnowledgeExtractorPort;
}

export class LlmKnowledgeExtractor implements KnowledgeExtractorPort {
  private readonly fallback: KnowledgeExtractorPort;
  private readonly batchSize: number;
  private readonly providerFactory: LLMProviderFactory;
  private readonly providerName?: LLMProviderName;

  constructor(options: LlmKnowledgeExtractorOptions = {}) {
    const useMock =
      process.env['CURATOR_MOCK_LLM'] === 'true' || process.env['HERMES_MOCK_LLM'] === 'true';
    this.providerFactory = options.providerFactory ?? new DefaultLLMProviderFactory(useMock);
    this.fallback = options.fallback ?? new RuleBasedKnowledgeExtractor();
    this.batchSize = options.batchSize ?? BATCH_SIZE;
    if (options.providerName !== undefined) {
      this.providerName = options.providerName;
    }
  }

  async extract(findings: SourceFinding[]): Promise<RawKnowledge[]> {
    if (findings.length === 0) {
      return [];
    }

    const provider = await this.resolveProvider();
    if (!provider) {
      return this.fallback.extract(findings);
    }

    const results: RawKnowledge[] = [];

    for (let i = 0; i < findings.length; i += this.batchSize) {
      const batch = findings.slice(i, i + this.batchSize);
      const batchResults = await this.extractBatch(batch, provider);
      results.push(...batchResults);
    }

    return results.length > 0 ? results : this.fallback.extract(findings);
  }

  private async resolveProvider(): Promise<LLMProvider | null> {
    const envProvider = process.env['HERMES_LLM_PROVIDER'] as LLMProviderName | undefined;

    if (envProvider) {
      const provider = this.providerFactory.create(envProvider);
      if (await provider.isAvailable()) {
        return provider;
      }
      return null;
    }

    if (this.providerName !== undefined) {
      const provider = this.providerFactory.create(this.providerName);
      if (await provider.isAvailable()) {
        return provider;
      }
      return null;
    }

    for (const name of DEFAULT_PROVIDER_ORDER) {
      const provider = this.providerFactory.create(name);
      if (await provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  private resolveModel(): string | undefined {
    return process.env['CURATOR_LLM_MODEL'] ?? process.env['HERMES_LLM_MODEL'];
  }

  private async extractBatch(
    batch: SourceFinding[],
    provider: LLMProvider,
  ): Promise<RawKnowledge[]> {
    try {
      const model = this.resolveModel();
      const response = await provider.complete({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        userPrompt: buildExtractionUserPrompt(batch),
        temperature: 0.1,
        maxTokens: 4096,
        ...(model !== undefined ? { model } : {}),
      });

      const parsed = extractJsonFromText(response.content);
      if (parsed === null) {
        return this.fallback.extract(batch);
      }

      const validated = ExtractionResponseSchema.safeParse(parsed);
      if (!validated.success) {
        return this.fallback.extract(batch);
      }

      return validated.data.items
        .filter((item) => item.sourceIndex >= 0 && item.sourceIndex < batch.length)
        .map((item) => {
          const source = batch[item.sourceIndex];
          if (!source) {
            throw new Error(`Invalid sourceIndex ${String(item.sourceIndex)}`);
          }
          return {
            category: item.category,
            framework: item.framework,
            practice: item.practice.trim(),
            importance: item.importance,
            confidence: Math.min(item.confidence, source.confidence),
            sourceRef: source.url,
          };
        });
    } catch (error) {
      if (process.env['CURATOR_LLM_DEBUG'] === '1') {
        console.error('[curator/extraction] LLM batch failed:', error);
      }
      return this.fallback.extract(batch);
    }
  }
}

export function createKnowledgeExtractor(): KnowledgeExtractorPort {
  const useMock =
    process.env['CURATOR_MOCK_LLM'] === 'true' || process.env['HERMES_MOCK_LLM'] === 'true';
  if (useMock) {
    return new MockStructuredKnowledgeExtractor();
  }
  return new LlmKnowledgeExtractor();
}
