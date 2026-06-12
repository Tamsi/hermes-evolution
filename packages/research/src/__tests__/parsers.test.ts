import { describe, expect, it } from 'vitest';
import { parseChangelogLines } from '../infrastructure/changelog-parser.js';
import { parseRssItems } from '../infrastructure/rss-parser.js';

describe('rss-parser', () => {
  it('parses RSS items', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Symfony 8.2</title><link>https://example.com</link><description>Release</description></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Symfony 8.2');
  });
});

describe('changelog-parser', () => {
  it('extracts signal lines', () => {
    const text = 'Random line\n* Deprecated FooBar service\nAnother line';
    const lines = parseChangelogLines(text);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]?.content).toContain('Deprecated');
  });
});
