import type {
  ImportanceLevel,
  KnowledgeCategory,
  RawKnowledge,
  SourceFinding,
} from '@curator/core';
import type { KnowledgeExtractorPort } from '@curator/core';

export class RuleBasedKnowledgeExtractor implements KnowledgeExtractorPort {
  async extract(findings: SourceFinding[]): Promise<RawKnowledge[]> {
    return findings.map((finding) => this.extractOne(finding));
  }

  private extractOne(finding: SourceFinding): RawKnowledge {
    const text = `${finding.title} ${finding.finding}`;
    return {
      category: inferCategory(text),
      role: finding.role,
      practice: toActionablePractice(text),
      importance: inferImportance(text),
      confidence: finding.confidence * 0.7,
      sourceRef: finding.url,
    };
  }
}

function toActionablePractice(text: string): string {
  const trimmed = text.trim().slice(0, 300);
  if (/deprecat/i.test(trimmed)) {
    return `Review and migrate away from deprecated API: ${trimmed}`;
  }
  if (/breaking|bc break/i.test(trimmed)) {
    return `Address breaking change during upgrade: ${trimmed}`;
  }
  if (/security/i.test(trimmed)) {
    return `Apply security guidance: ${trimmed}`;
  }
  return trimmed;
}

function inferCategory(text: string): KnowledgeCategory {
  if (/deprecat|removed|bc break/i.test(text)) return 'deprecation';
  if (/security|xss|csrf|injection/i.test(text)) return 'security';
  if (/performance|cache|optim/i.test(text)) return 'performance';
  if (/test|coverage/i.test(text)) return 'testing';
  if (/api|endpoint|resource/i.test(text)) return 'api';
  return 'architecture';
}

function inferImportance(text: string): ImportanceLevel {
  if (/security|breaking|bc break|critical/i.test(text)) return 'critical';
  if (/deprecat|removed|recommend/i.test(text)) return 'high';
  if (/feature|enhancement/i.test(text)) return 'medium';
  return 'low';
}
