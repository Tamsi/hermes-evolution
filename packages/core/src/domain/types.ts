export type KnowledgeCategory =
  | 'architecture'
  | 'security'
  | 'performance'
  | 'deprecation'
  | 'api'
  | 'testing';

export type KnowledgeFramework =
  | 'symfony'
  | 'api-platform'
  | 'doctrine'
  | 'drupal'
  | 'php'
  | 'general';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SourceFinding {
  source: string;
  title: string;
  finding: string;
  url: string;
  fetchedAt: string;
  confidence: number;
}

export interface RawKnowledge {
  category: KnowledgeCategory;
  framework: KnowledgeFramework;
  practice: string;
  importance: ImportanceLevel;
  confidence: number;
  sourceRef: string;
}

export interface KnowledgeItem {
  id: string;
  category: KnowledgeCategory;
  framework: KnowledgeFramework;
  practice: string;
  importance: ImportanceLevel;
  confidence: number;
  sources: string[];
}

export interface AuditIssue {
  type: 'missing' | 'obsolete' | 'inconsistent' | 'opportunity';
  severity: ImportanceLevel;
  message: string;
  knowledgeId?: string;
  recommendation?: string;
}

export interface SkillScoreDimensions {
  prompt_quality: number;
  reasoning_quality: number;
  tool_usage: number;
  architecture_guidance: number;
  evaluation_coverage: number;
  guardrails: number;
  maintainability: number;
}

export interface SkillScore {
  skill: string;
  dimensions: SkillScoreDimensions;
  overall_score: number;
  recorded_at: string;
}

export interface AuditReport {
  skill: string;
  score: SkillScore;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface GitPatch {
  skill: string;
  filePath: string;
  diff: string;
  summary: string;
}

export interface EvaluationGate {
  passed: boolean;
  skill: string;
  scoreDelta: number;
  regressions: string[];
  validationValid: boolean;
}

export interface CuratorRunReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  findingsCount: number;
  knowledgeCount: number;
  audits: AuditReport[];
  patches: GitPatch[];
  evaluationGates: EvaluationGate[];
  markdownPath: string;
  jsonPath: string;
}

export interface PullRequestResult {
  url: string;
  branch: string;
  number: number;
}

export interface CuratorConfig {
  frameworks: {
    symfony: {
      primary_branch: string;
      secondary_branches: string[];
      upgrade_guides: { branch: string; file: string }[];
    };
    drupal: {
      primary_branch: string;
      secondary_branches: string[];
      changelog: { api_path: string };
      change_records: { major_minor: string }[];
    };
    'api-platform': { primary_version: string };
    php: { minimum_version: string };
  };
  sources: Record<string, Record<string, string>>;
  tiers: {
    tier1: { auto_apply: boolean };
    tier2: { auto_apply: boolean; requires_review: boolean };
  };
}

export interface SkillAuditContext {
  name: string;
  tags: string[];
  prompt: string;
  version: string;
  hasTests: boolean;
  hasExamples: boolean;
  rootPath: string;
}
