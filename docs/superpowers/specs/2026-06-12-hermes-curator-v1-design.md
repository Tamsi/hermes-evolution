# Hermes Curator V1 — Design Specification

**Date:** 2026-06-12  
**Status:** Draft — pending approval  
**Scope:** Minimal viable curator pipeline (V1)

---

## 1. Context

### Existing assets

- `**hermes-skills`** (sibling repo): mature monorepo with hexagonal architecture, skill registry, evaluator, and LLM runner.
- `**hermes-evolution**`: empty workspace → becomes `**hermes-curator**` repository.
- **Integration choice:** sibling dependency on `@hermes/core`, `@hermes/evaluator`, and `@hermes/runner` via `file:../hermes-skills/packages/`*.

### V1 success criteria

1. Load all skills from `hermes-skills/registry/`
2. Scan Tier-1 official sources (Symfony, API Platform, Drupal, PHP)
3. Extract structured best practices
4. Audit each skill against the knowledge base
5. Generate a human-readable audit report (Markdown + JSON)
6. Open a GitHub Pull Request on `hermes-skills` with findings and optional prompt patches

---

## 2. Architecture Overview

### Monorepo layout

```
hermes-curator/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── packages/
│   ├── core/                    # Domain types, ports, DI, scoring engine
│   ├── research/                # Agent 1: Trend Scout — source fetchers
│   ├── extraction/              # Agents 2–3: Extractor + Normalizer
│   ├── auditing/                # Agent 4: Skill Auditor
│   ├── refactoring/             # Agent 5: Skill Refactorer (V1: patch proposals)
│   ├── evaluation/              # Agent 6: wraps @hermes/evaluator
│   ├── github/                  # Agent 7: PR Generator
│   ├── scheduler/               # Cron workflow orchestrator
│   └── cli/                     # `curator run`, `curator audit`, `curator schedule`
├── config/
│   └── sources.yaml             # Tier-1 source definitions
└── docs/
```

### Hexagonal boundaries


| Layer                                   | Responsibility                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Domain** (`core/domain`)              | `KnowledgeItem`, `AuditReport`, `SkillScore`, `SourceFinding`, workflow events                         |
| **Application** (`*/application`)       | Use cases: `RunResearch`, `ExtractKnowledge`, `AuditSkill`, `GenerateReport`, `OpenPullRequest`        |
| **Ports** (`core/ports`)                | `SourceFetcher`, `KnowledgeExtractor`, `SkillAuditor`, `PatchGenerator`, `GitHubClient`, `LLMProvider` |
| **Infrastructure** (`*/infrastructure`) | HTTP fetchers, GitHub API, file system, LLM adapters (delegates to `@hermes/runner`)                   |


**Rules:** No business logic in infrastructure. No God objects. Max 500 lines per file. No circular dependencies between packages (dependency graph flows toward `core`).

### Package dependency graph

```
cli → scheduler → [research, extraction, auditing, refactoring, evaluation, github] → core
evaluation → @hermes/evaluator → @hermes/core
auditing → @hermes/core (skill loading)
github → (no domain deps from other agent packages)
```

---

## 3. Agent Pipeline (V1)

```
Trend Scout (research)
    ↓ SourceFinding[]
Knowledge Extractor (extraction)
    ↓ RawKnowledge[]
Knowledge Normalizer (extraction)
    ↓ KnowledgeItem[] (deduplicated)
Skill Auditor (auditing)
    ↓ AuditReport[] + SkillScore[]
Skill Refactorer (refactoring) — V1: conservative prompt patches only
    ↓ GitPatch[]
Evaluator (evaluation)
    ↓ EvaluationGate (pass/fail)
Pull Request Generator (github)
    ↓ GitHub PR URL
```

### Agent 1 — Trend Scout (`@curator/research`)

**V1 sources (Tier 1 only):**

Versions are **never hardcoded in code** — they live in `config/sources.yaml` and align with skill manifests (e.g. `symfony-architect` → **Symfony 8**, `drupal-reviewer` → **Drupal 10/11**).

| Source | URL pattern | Fetch strategy |
| ------ | ----------- | -------------- |
| Symfony Blog RSS | `https://symfony.com/blog/rss.xml` | RSS parser |
| Symfony CHANGELOG | `…/symfony/symfony/{branch}/CHANGELOG.md` | Raw markdown |
| Symfony UPGRADE | `…/symfony/symfony/{branch}/UPGRADE-{major}.{minor}.md` | Raw markdown |
| Symfony docs | `https://symfony.com/doc/current/` | Sitemap / section diff (V1: static page list) |
| API Platform releases | GitHub API `/repos/api-platform/core/releases` | JSON |
| API Platform docs | `https://api-platform.com/docs/` | Static page list |
| Drupal core releases RSS | `https://www.drupal.org/project/drupal/releases?format=feed` | RSS parser |
| Drupal CHANGELOG | `https://api.drupal.org/api/drupal/core%21CHANGELOG.txt/{branch}` | Raw text |
| Drupal core (GitHub) | `…/drupal/drupal/{branch}` — `core/CHANGELOG.txt`, release tags | Raw markdown / GitHub API |
| Drupal change records | `https://www.drupal.org/list-changes/{major}.{minor}` | HTML scrape (deprecations, BC breaks) |
| Drupal docs | `https://www.drupal.org/docs` | Static page list (V1: core dev handbook sections) |
| PHP RFC index | `https://wiki.php.net/rfc` | HTML scrape (headings + links) |

**Default framework branches (config, June 2026):**

| Framework | Branch | Role |
| --------- | ------ | ---- |
| Symfony | `8.2` | **Primary** — matches `symfony8` skills |
| Symfony | `7.4` | **Secondary** — LTS; migration context |
| Drupal | `11.4.x` | **Primary** — matches `drupal11` skills |
| Drupal | `10.6.x` | **Secondary** — matches `drupal10` skills; migration context |

Example `config/sources.yaml` excerpt:

```yaml
frameworks:
  symfony:
    primary_branch: "8.2"
    secondary_branches: ["7.4"]
    upgrade_guides:
      - branch: "8.2"
        file: "UPGRADE-8.2.md"
      - branch: "8.0"
        file: "UPGRADE-8.0.md"
  drupal:
    primary_branch: "11.4.x"
    secondary_branches: ["10.6.x"]
    changelog:
      api_path: "drupal/core%21CHANGELOG.txt/{branch}"
    change_records:
      - major_minor: "11.4"
      - major_minor: "10.6"
  api-platform:
    primary_version: "4"
  php:
    minimum_version: "8.4"
```

The Trend Scout resolves URLs from this config. When Symfony ships `8.3` or Drupal `11.5.x`, only the config changes — no code change.

**Skill ↔ source mapping:** the auditor filters `KnowledgeItem[]` by skill tags (`symfony8`, `drupal10`, `drupal11`, etc.) so Drupal findings feed `drupal-reviewer` and Symfony findings feed `symfony-architect`.

**Output:** `SourceFinding { source, title, finding, url, fetchedAt, confidence }`

**V1 simplification:** No Tier 2–5 sources. Scheduler config reserves slots for future tiers.

### Agent 2 — Knowledge Extractor (`@curator/extraction`)

Transforms `SourceFinding` → `RawKnowledge`:

```typescript
interface RawKnowledge {
  category: 'architecture' | 'security' | 'performance' | 'deprecation' | 'api' | 'testing';
  framework: 'symfony' | 'api-platform' | 'doctrine' | 'drupal' | 'php' | 'general';
  practice: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  sourceRef: string;
}
```

**Implementation:** LLM extraction via `@hermes/runner` (`LlmKnowledgeExtractor`) with structured JSON output (Zod-validated). Batches of 5 findings per request. Falls back to rule-based extraction on parse failure or missing provider. Offline: `CURATOR_MOCK_LLM=true` uses `MockStructuredKnowledgeExtractor`.

### Agent 3 — Knowledge Normalizer (`@curator/extraction`)

- Dedupe by semantic similarity (V1: normalized practice text + framework + category hash)
- Merge sources into `KnowledgeItem { id, practice, framework, category, sources[], confidence, importance }`

### Agent 4 — Skill Auditor (`@curator/auditing`)

For each skill loaded via `YamlSkillLoader` from `@hermes/core`:

1. Parse manifest, prompt, examples, tests
2. Compare prompt content against `KnowledgeItem[]` filtered by skill tags
3. Detect: missing practices, obsolete references, inconsistencies
4. Compute score across 7 dimensions (see §5)

**Output:** `AuditReport { skill, score, issues[], recommendations[] }`

### Agent 5 — Skill Refactorer (`@curator/refactoring`)

**V1 scope (conservative):**

- Generate prompt **additions** (new sections) — never delete without explicit deprecation match
- Bump patch version in `skill.yaml` when prompt changes
- Produce unified diff via `git diff` format

**Out of V1 scope:** Autonomous rewriting of entire prompts, manifest structural changes.

### Agent 6 — Evaluator (`@curator/evaluation`)

Before PR:

1. Run `@hermes/evaluator` test suite for modified skills
2. Compare audit score before/after (must not decrease)
3. Gate: `EvaluationGate { passed, regressions[], scoreDelta }`

### Agent 7 — PR Generator (`@curator/github`)

- Target repo: `hermes-skills` (configurable via `CURATOR_TARGET_REPO`)
- Branch: `curator/YYYY-MM-DD-<skill-name>`
- PR title/body template from spec
- Requires `GITHUB_TOKEN` with repo scope

---

## 4. Scoring Engine

Seven dimensions (0–100 each), weighted average → `overall_score`:


| Dimension               | Weight | V1 heuristic                                      |
| ----------------------- | ------ | ------------------------------------------------- |
| `prompt_quality`        | 20%    | Structure, clarity, actionable sections           |
| `reasoning_quality`     | 15%    | Review process, decision trees                    |
| `tool_usage`            | 10%    | `required_tools` alignment with instructions      |
| `architecture_guidance` | 20%    | Coverage vs knowledge base (Symfony, API Platform, Drupal) |
| `evaluation_coverage`   | 15%    | Test suite presence and assertion quality         |
| `guardrails`            | 10%    | "When not to use", severity tables, anti-patterns |
| `maintainability`       | 10%    | Version tags, framework version references        |


Score history stored in `.curator/scores/<skill>.yaml` (committed in PR for traceability).

---

## 5. Scheduler

**Cron:** `0 4 * * 0` (Sunday 04:00 UTC)

**V1:** CLI command `curator schedule run` + GitHub Actions workflow (manual trigger + weekly cron). No external cron daemon.

```yaml
# .github/workflows/curator-weekly.yml
on:
  schedule: [{ cron: '0 4 * * 0' }]
  workflow_dispatch:
```

---

## 6. Configuration

### Environment variables


| Variable              | Required | Description                          |
| --------------------- | -------- | ------------------------------------ |
| `GITHUB_TOKEN`        | For PR   | GitHub PAT or Actions token          |
| `CURATOR_SKILLS_PATH` | No       | Default: `../hermes-skills/registry` |
| `CURATOR_TARGET_REPO` | No       | Default: `owner/hermes-skills`       |
| `CURATOR_MOCK_LLM`    | No       | Offline mode for CI                  |
| `HERMES_LLM_PROVIDER` | No       | Inherited from hermes-skills runner  |


### Source tiers (config/sources.yaml)

```yaml
frameworks:
  symfony:
    primary_branch: "8.2"
    secondary_branches: ["7.4"]
  drupal:
    primary_branch: "11.4.x"
    secondary_branches: ["10.6.x"]
  api-platform:
    primary_version: "4"
  php:
    minimum_version: "8.4"

tiers:
  tier1:
    auto_apply: true
    sources: [...]
  tier2:
    auto_apply: false
    requires_review: true
```

---

## 7. CLI Commands (V1)


| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `curator research`      | Run Trend Scout only            |
| `curator extract`       | Research → normalized knowledge |
| `curator audit [skill]` | Audit one or all skills         |
| `curator run`           | Full pipeline → report          |
| `curator pr`            | Full pipeline → GitHub PR       |
| `curator schedule run`  | Entry point for cron/Actions    |


---

## 8. Testing Strategy

- **Unit tests:** Each package, Vitest, mocked ports
- **Integration tests:** Full pipeline with `CURATOR_MOCK_LLM=true` and fixture sources
- **Contract tests:** Skill loader compatibility with `@hermes/core`
- **CI:** lint + typecheck + test on every push

---

## 9. Out of V1 Scope

- Tier 2–5 sources (experts, Reddit, HN, private knowledge)
- Autonomous prompt deletion or major rewrites
- Multi-thousand skill scale optimizations
- MCP server exposure
- Web UI / dashboard
- Score history visualization

---

## 10. Risks & Mitigations


| Risk                            | Mitigation                                                           |
| ------------------------------- | -------------------------------------------------------------------- |
| LLM hallucination in extraction | Tier-1 only for auto-apply; confidence thresholds; human-readable PR |
| Bad automatic patches           | V1 additive-only refactorer; evaluator gate; no merge without review |
| Source rate limits              | Cache fetched content in `.curator/cache/` with TTL                  |
| GitHub API failures             | Retry with backoff; fallback to local report                         |


---

## 11. Approval Checklist

- [ ] Monorepo structure approved
- [ ] V1 agent scope approved (conservative refactorer)
- [ ] Scoring dimensions approved
- [ ] Integration with hermes-skills approved
- [ ] Ready for implementation plan