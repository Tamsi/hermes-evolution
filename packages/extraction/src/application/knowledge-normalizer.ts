import type { KnowledgeItem, RawKnowledge } from '@curator/core';
import { knowledgeId } from '@curator/core';
import type { ImportanceLevel } from '@curator/core';
import type { KnowledgeNormalizerPort } from '@curator/core';

export class KnowledgeNormalizer implements KnowledgeNormalizerPort {
  normalize(raw: RawKnowledge[]): KnowledgeItem[] {
    const map = new Map<string, KnowledgeItem>();

    for (const item of raw) {
      const id = knowledgeId(item.practice, item.framework, item.category);
      const existing = map.get(id);
      if (existing) {
        if (!existing.sources.includes(item.sourceRef)) {
          existing.sources.push(item.sourceRef);
        }
        existing.confidence = Math.max(existing.confidence, item.confidence);
        if (rankImportance(item.importance) > rankImportance(existing.importance)) {
          existing.importance = item.importance;
        }
      } else {
        map.set(id, {
          id,
          category: item.category,
          framework: item.framework,
          practice: item.practice,
          importance: item.importance,
          confidence: item.confidence,
          sources: [item.sourceRef],
        });
      }
    }

    return [...map.values()];
  }
}

function rankImportance(level: ImportanceLevel): number {
  const ranks: Record<ImportanceLevel, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return ranks[level];
}
