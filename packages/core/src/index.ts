import { FetchHttpClient } from './infrastructure/http-client.js';
import { FileCache } from './infrastructure/file-cache.js';
import { YamlConfigLoader } from './application/config-loader.js';
import { MarkdownReportWriter } from './application/report-writer.js';

export * from './domain/types.js';
export * from './ports/index.js';
export { YamlConfigLoader } from './application/config-loader.js';
export { MarkdownReportWriter } from './application/report-writer.js';
export {
  knowledgeId,
  filterKnowledgeForSkill,
  detectIssues,
  computeSkillScore,
  buildRecommendations,
} from './application/scoring-engine.js';
export { FetchHttpClient } from './infrastructure/http-client.js';
export { FileCache } from './infrastructure/file-cache.js';
export { NodeFileSystem, loadSkillContexts } from './infrastructure/node-filesystem.js';

export function createCoreServices(cacheDir: string) {
  return {
    http: new FetchHttpClient(),
    cache: new FileCache(cacheDir),
    configLoader: new YamlConfigLoader(),
    reportWriter: new MarkdownReportWriter(),
  };
}
