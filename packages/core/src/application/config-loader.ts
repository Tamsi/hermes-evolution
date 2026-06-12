import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { CuratorConfig } from '../domain/types.js';
import type { ConfigLoaderPort } from '../ports/index.js';

const CuratorConfigSchema = z.object({
  frameworks: z.object({
    symfony: z.object({
      primary_branch: z.string(),
      secondary_branches: z.array(z.string()),
      upgrade_guides: z.array(z.object({ branch: z.string(), file: z.string() })),
    }),
    drupal: z.object({
      primary_branch: z.string(),
      secondary_branches: z.array(z.string()),
      changelog: z.object({ api_path: z.string() }),
      change_records: z.array(z.object({ major_minor: z.string() })),
    }),
    'api-platform': z.object({ primary_version: z.string() }),
    php: z.object({ minimum_version: z.string() }),
  }),
  sources: z.record(z.record(z.string())),
  tiers: z.object({
    tier1: z.object({ auto_apply: z.boolean() }),
    tier2: z.object({ auto_apply: z.boolean(), requires_review: z.boolean() }),
  }),
});

export class YamlConfigLoader implements ConfigLoaderPort {
  async loadConfig(configPath: string): Promise<CuratorConfig> {
    const content = await readFile(configPath, 'utf-8');
    const raw: unknown = parseYaml(content);
    return CuratorConfigSchema.parse(raw) as CuratorConfig;
  }
}
