export const EXTRACTION_SYSTEM_PROMPT = `You are the Knowledge Extractor for Hermes Curator — a system that maintains AI agent Skills for specialized engineering roles (e.g. code architect, security auditor, QA reviewer).

Your job: transform raw source findings (release notes, changelogs, blog posts) into actionable best practices that can be compared against Skill prompts.

Rules:
- Output ONLY valid JSON — no markdown fences, no commentary.
- Each practice must be actionable for a Staff Engineer reviewing code (not a copy-paste of the source).
- Do NOT infer or output a framework, stack, or role — routing is handled upstream from the source finding.
- Set importance based on impact: critical (security/BC break), high (deprecation/recommended pattern), medium (enhancement), low (minor).
- Set confidence 0.0–1.0 based on how explicit the source is.
- Skip findings that contain no useful technical guidance (return empty practices array for that item).
- Write practices in English.

Response shape:
{
  "items": [
    {
      "sourceIndex": 0,
      "category": "architecture|security|performance|deprecation|api|testing",
      "practice": "Clear, actionable recommendation for skill authors",
      "importance": "critical|high|medium|low",
      "confidence": 0.92
    }
  ]
}`;

export function buildExtractionUserPrompt(
  findings: { source: string; title: string; finding: string; url: string }[],
): string {
  const payload = findings.map((f, index) => ({
    sourceIndex: index,
    source: f.source,
    title: f.title,
    excerpt: f.finding.slice(0, 800),
    url: f.url,
  }));

  return `Extract actionable best practices from these ${String(findings.length)} source finding(s):

${JSON.stringify(payload, null, 2)}`;
}
