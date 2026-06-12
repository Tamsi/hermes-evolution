import { describe, expect, it } from 'vitest';
import { computeSkillScore, detectIssues, filterKnowledgeForSkill, knowledgeId } from '../application/scoring-engine.js';
import type { KnowledgeItem, SkillAuditContext } from '../domain/types.js';

describe('scoring-engine', () => {
  const skill: SkillAuditContext = {
    name: 'symfony-architect',
    tags: ['symfony', 'symfony8'],
    prompt: '# Symfony Architect\n\nReview process step by step. Anti-patterns. Symfony 8 PHP 8.4',
    version: '1.0.0',
    hasTests: true,
    hasExamples: true,
    rootPath: '/tmp',
  };

  const knowledge: KnowledgeItem[] = [
    {
      id: knowledgeId('Use constructor injection', 'symfony', 'architecture'),
      category: 'architecture',
      framework: 'symfony',
      practice: 'Use constructor injection with readonly properties',
      importance: 'high',
      confidence: 0.9,
      sources: ['https://symfony.com/doc'],
    },
  ];

  it('filters knowledge by skill tags', () => {
    const filtered = filterKnowledgeForSkill(knowledge, skill.tags);
    expect(filtered).toHaveLength(1);
  });

  it('detects missing practices', () => {
    const issues = detectIssues(skill, knowledge);
    expect(issues.some((i) => i.type === 'missing')).toBe(true);
  });

  it('computes overall score', () => {
    const issues = detectIssues(skill, knowledge);
    const score = computeSkillScore(skill, issues);
    expect(score.overall_score).toBeGreaterThan(0);
    expect(score.overall_score).toBeLessThanOrEqual(100);
  });
});
