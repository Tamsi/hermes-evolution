import type { CuratorConfig, SourceFinding } from '@curator/core';
import type { CachePort, HttpClientPort, SourceFetcherPort } from '@curator/core';
import { parseRssItems } from './infrastructure/rss-parser.js';
import { parseChangelogLines } from './infrastructure/changelog-parser.js';

export class TrendScout implements SourceFetcherPort {
  constructor(
    private readonly http: HttpClientPort,
    private readonly cache: CachePort,
  ) {}

  async fetchAll(config: CuratorConfig): Promise<SourceFinding[]> {
    const findings: SourceFinding[] = [];
    const tasks = [
      this.fetchSymfony(config),
      this.fetchDrupal(config),
      this.fetchApiPlatform(config),
    ];
    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        findings.push(...result.value);
      }
    }
    return findings;
  }

  private async fetchSymfony(config: CuratorConfig): Promise<SourceFinding[]> {
    const findings: SourceFinding[] = [];
    const symfonySources = config.sources['symfony'];
    if (!symfonySources) return findings;

    const rssUrl = symfonySources['blog_rss'];
    if (rssUrl) {
      findings.push(...(await this.fetchRss('Symfony Blog', rssUrl, 0.9)));
    }

    const repo = symfonySources['github_repo'] ?? 'symfony/symfony';
    const branches = [
      config.frameworks.symfony.primary_branch,
      ...config.frameworks.symfony.secondary_branches,
    ];

    for (const branch of branches) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/CHANGELOG.md`;
      findings.push(...(await this.fetchChangelog('Symfony CHANGELOG', url, branch, 0.95)));
    }

    for (const guide of config.frameworks.symfony.upgrade_guides) {
      const url = `https://raw.githubusercontent.com/${repo}/${guide.branch}/${guide.file}`;
      findings.push(...(await this.fetchChangelog('Symfony UPGRADE', url, guide.branch, 0.95)));
    }

    return findings;
  }

  private async fetchDrupal(config: CuratorConfig): Promise<SourceFinding[]> {
    const findings: SourceFinding[] = [];
    const drupalSources = config.sources['drupal'];
    if (!drupalSources) return findings;

    const rssUrl = drupalSources['releases_rss'];
    if (rssUrl) {
      findings.push(...(await this.fetchRss('Drupal Releases', rssUrl, 0.9)));
    }

    const branches = [
      config.frameworks.drupal.primary_branch,
      ...config.frameworks.drupal.secondary_branches,
    ];

    for (const branch of branches) {
      const apiBranch = branch.replace('.x', '');
      const url = `${drupalSources['changelog_api'] ?? 'https://api.drupal.org/api/drupal/core%21CHANGELOG.txt'}/${apiBranch}`;
      findings.push(...(await this.fetchChangelog('Drupal CHANGELOG', url, branch, 0.95)));
    }

    return findings;
  }

  private async fetchApiPlatform(config: CuratorConfig): Promise<SourceFinding[]> {
    const findings: SourceFinding[] = [];
    const repo = config.sources['api-platform']?.['github_repo'] ?? 'api-platform/core';
    const url = `https://api.github.com/repos/${repo}/releases?per_page=10`;

    try {
      const releases = await this.http.fetchJson<
        { name: string; body: string | null; html_url: string; published_at: string }[]
      >(url);
      for (const release of releases) {
        if (!release.body) continue;
        findings.push({
          source: 'API Platform Releases',
          title: release.name,
          finding: release.body.slice(0, 500),
          url: release.html_url,
          fetchedAt: new Date().toISOString(),
          confidence: 0.92,
        });
      }
    } catch {
      // Non-fatal: rate limit or offline
    }

    return findings;
  }

  private async fetchRss(
    source: string,
    url: string,
    confidence: number,
  ): Promise<SourceFinding[]> {
    const cached = await this.cache.get(url);
    const xml = cached ?? (await this.http.fetchText(url));
    if (!cached) {
      await this.cache.set(url, xml, 3600);
    }

    return parseRssItems(xml).map((item) => ({
      source,
      title: item.title,
      finding: item.description.slice(0, 500),
      url: item.link,
      fetchedAt: new Date().toISOString(),
      confidence,
    }));
  }

  private async fetchChangelog(
    source: string,
    url: string,
    branch: string,
    confidence: number,
  ): Promise<SourceFinding[]> {
    try {
      const cached = await this.cache.get(url);
      const text = cached ?? (await this.http.fetchText(url));
      if (!cached) {
        await this.cache.set(url, text, 86400);
      }

      return parseChangelogLines(text).map((line) => ({
        source: `${source} (${branch})`,
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
}

export { parseRssItems } from './infrastructure/rss-parser.js';
export { parseChangelogLines } from './infrastructure/changelog-parser.js';
