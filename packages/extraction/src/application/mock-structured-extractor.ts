import type { RawKnowledge, SourceFinding } from '@curator/core';
import type { KnowledgeExtractorPort } from '@curator/core';
import { RuleBasedKnowledgeExtractor } from './rule-based-extractor.js';

/**
 * Offline stand-in when CURATOR_MOCK_LLM or HERMES_MOCK_LLM is set.
 * Produces the same RawKnowledge shape as LlmKnowledgeExtractor without API calls.
 */
export class MockStructuredKnowledgeExtractor implements KnowledgeExtractorPort {
  private readonly base = new RuleBasedKnowledgeExtractor();

  async extract(findings: SourceFinding[]): Promise<RawKnowledge[]> {
    const raw = await this.base.extract(findings);
    return raw.map((item) => ({
      ...item,
      practice: `[mock-llm] ${item.practice}`,
      confidence: Math.min(item.confidence + 0.15, 0.95),
    }));
  }
}
