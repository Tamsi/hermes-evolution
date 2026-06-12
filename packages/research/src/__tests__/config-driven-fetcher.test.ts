import { describe, expect, it } from 'vitest';
import type { CachePort, CuratorConfig, HttpClientPort } from '@curator/core';
import { ConfigDrivenFetcher } from '../index.js';

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss><channel>
<item><title>New OWASP guidance</title><link>https://owasp.org/a</link><description>Validate all inputs.</description></item>
</channel></rss>`;

const noCache: CachePort = {
  get: async () => null,
  set: async () => undefined,
};

function httpReturning(text: string, json: unknown = []): HttpClientPort {
  return {
    fetchText: async () => text,
    fetchJson: async <T>() => json as T,
  };
}

const config: CuratorConfig = {
  roles: {
    'security-auditor': [
      { type: 'rss', url: 'https://owasp.org/feed.xml', confidence: 0.9 },
      { type: 'github_releases', repo: 'OWASP/Top10' },
    ],
  },
  tiers: { tier1: { auto_apply: true }, tier2: { auto_apply: false, requires_review: true } },
};

describe('ConfigDrivenFetcher', () => {
  it('fetches rss sources and tags findings with the role', async () => {
    const fetcher = new ConfigDrivenFetcher(
      httpReturning(RSS_FIXTURE, [
        { name: 'v2', body: 'Release notes', html_url: 'https://github.com/r', published_at: '2026-01-01' },
      ]),
      noCache,
    );
    const findings = await fetcher.fetchAll(config);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.role === 'security-auditor')).toBe(true);
    expect(findings.some((f) => f.title === 'New OWASP guidance')).toBe(true);
  });

  it('survives a failing source without throwing', async () => {
    const failingHttp: HttpClientPort = {
      fetchText: async () => {
        throw new Error('offline');
      },
      fetchJson: async () => {
        throw new Error('offline');
      },
    };
    const fetcher = new ConfigDrivenFetcher(failingHttp, noCache);
    const findings = await fetcher.fetchAll(config);
    expect(findings).toEqual([]);
  });
});
