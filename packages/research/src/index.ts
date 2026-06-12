import type { CuratorConfig, RoleSource, SourceFinding } from '@curator/core';
import type { CachePort, HttpClientPort, SourceFetcherPort } from '@curator/core';
import { parseRssItems } from './infrastructure/rss-parser.js';
import { parseChangelogLines } from './infrastructure/changelog-parser.js';

export class ConfigDrivenFetcher implements SourceFetcherPort {
  constructor(
    private readonly http: HttpClientPort,
    private readonly cache: CachePort,
  ) {}

  async fetchAll(config: CuratorConfig): Promise<SourceFinding[]> {
    const tasks: Promise<SourceFinding[]>[] = [];
    for (const [role, sources] of Object.entries(config.roles)) {
      for (const source of sources) {
        tasks.push(this.fetchSource(role, source));
      }
    }

    const findings: SourceFinding[] = [];
    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        findings.push(...result.value);
      }
    }
    return findings;
  }

  private async fetchSource(role: string, source: RoleSource): Promise<SourceFinding[]> {
    switch (source.type) {
      case 'rss':
        return this.fetchRss(role, source.url ?? '', source.confidence ?? 0.9);
      case 'changelog_url':
        return this.fetchChangelog(role, source.url ?? '', source.confidence ?? 0.95);
      case 'github_releases':
        return this.fetchGithubReleases(role, source.repo ?? '', source.confidence ?? 0.92);
    }
  }

  private async fetchRss(role: string, url: string, confidence: number): Promise<SourceFinding[]> {
    const cached = await this.cache.get(url);
    const xml = cached ?? (await this.http.fetchText(url));
    if (!cached) {
      await this.cache.set(url, xml, 3600);
    }

    return parseRssItems(xml).map((item) => ({
      role,
      source: `rss:${url}`,
      title: item.title,
      finding: item.description.slice(0, 500),
      url: item.link,
      fetchedAt: new Date().toISOString(),
      confidence,
    }));
  }

  private async fetchChangelog(role: string, url: string, confidence: number): Promise<SourceFinding[]> {
    try {
      const cached = await this.cache.get(url);
      const text = cached ?? (await this.http.fetchText(url));
      if (!cached) {
        await this.cache.set(url, text, 86400);
      }

      return parseChangelogLines(text).map((line) => ({
        role,
        source: `changelog:${url}`,
        title: line.title,
        finding: line.content,
        url,
        fetchedAt: new Date().toISOString(),
        confidence,
      }));
    } catch {
      return [];
    }
  }

  private async fetchGithubReleases(role: string, repo: string, confidence: number): Promise<SourceFinding[]> {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=10`;
    try {
      const releases = await this.http.fetchJson<
        { name: string; body: string | null; html_url: string; published_at: string }[]
      >(url);
      return releases
        .filter((release) => Boolean(release.body))
        .map((release) => ({
          role,
          source: `github:${repo}`,
          title: release.name,
          finding: (release.body ?? '').slice(0, 500),
          url: release.html_url,
          fetchedAt: new Date().toISOString(),
          confidence,
        }));
    } catch {
      return [];
    }
  }
}

export { parseRssItems } from './infrastructure/rss-parser.js';
export { parseChangelogLines } from './infrastructure/changelog-parser.js';
