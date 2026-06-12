export interface ChangelogLine {
  title: string;
  content: string;
}

const SIGNAL_PATTERNS = [
  /deprecat/i,
  /breaking/i,
  /bc break/i,
  /removed/i,
  /security/i,
  /recommend/i,
  /best practice/i,
  /new feature/i,
];

export function parseChangelogLines(text: string): ChangelogLine[] {
  const lines = text.split('\n');
  const results: ChangelogLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 20) continue;
    if (!SIGNAL_PATTERNS.some((p) => p.test(trimmed))) continue;

    results.push({
      title: trimmed.slice(0, 80),
      content: trimmed,
    });

    if (results.length >= 30) break;
  }

  return results;
}
