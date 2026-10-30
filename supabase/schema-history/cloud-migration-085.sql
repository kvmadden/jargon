-- jargon Stage B+1.45 — taxonomy re-architecture (2026-05-31)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Promotes the B+1.20–1.44 "literacy pack" backlog (migrations 059–084) from
-- the coarse catch-all paths they were filed under (mostly 'systems' /
-- 'dev-concepts' / 'enterprise') into 16 first-class topic paths, so each pack
-- becomes its own focused learning path.
--
-- RUN ORDER: apply AFTER cloud-migration-059..084 (those insert the term rows
-- under coarse paths; this re-files them by exact id).
--
-- Mechanism: drop the path CHECK, re-file by exact id (no LIKE — backlog ids
-- share prefixes like sys-/dev-/data- with the original seed, so prefix matching
-- would move original terms too), then re-add the CHECK with the final 29-path
-- taxonomy (7 original coding + 16 new coding + 6 ai).
--
-- IDEMPOTENT: pure UPDATE-by-id + CHECK rebuild. Safe to re-run.

begin;

-- 1. Drop the CHECK so UPDATEs to new path values are allowed mid-transaction.
alter table terms drop constraint if exists terms_path_check;

-- 2. Re-file each backlog pack to its first-class path (exact ids only).

-- programming (077 — code grammar / language fundamentals)
update terms set path='programming' where id in (
  'code-variable','code-function','code-parameter','code-argument','code-type',
  'code-object','code-array','code-loop','code-conditional','code-exception',
  'code-stack-trace','code-module','code-import','code-recursion','code-algorithm');

-- dev-tooling (061 — package mgrs, bundlers, linters, React model)
update terms set path='dev-tooling' where id in (
  'dev-lockfile','dev-node-modules','dev-semver','dev-transitive-dependency',
  'dev-build-artifact','dev-bundler','dev-source-map','dev-hot-reload','dev-linter',
  'dev-formatter','dev-test-runner','dev-test-coverage','dev-component','dev-props',
  'dev-state','dev-hook');

-- dev-workflow (074 — repo/branch/commit/PR/CI loop)
update terms set path='dev-workflow' where id in (
  'flow-repository','flow-branch','flow-commit','flow-diff','flow-pull-request',
  'flow-code-review','flow-rebase','flow-merge','flow-conflict','flow-ci','flow-build',
  'flow-artifact','flow-localhost','flow-port','flow-debugger');

-- web-api (062 + 078 — http request/response, routing, web auth)
update terms set path='web-api' where id in (
  'sys-http-request','sys-http-response','sys-status-code','sys-http-method',
  'sys-http-header','sys-payload','sys-json','sys-query-param','sys-route','sys-middleware',
  'sys-cookie','sys-session','sys-jwt','sys-cors','sys-redirect','sys-origin',
  'web-url','web-domain','web-route','web-request','web-response','web-status-code',
  'web-header','web-body','web-cookie','web-session','web-cors','web-origin','web-webhook',
  'web-spa','web-ssr');

-- databases (063 + 079 — relational modeling + storage)
update terms set path='databases' where id in (
  'sys-table','sys-row','sys-column','sys-primary-key','sys-foreign-key','sys-join',
  'sys-transaction','sys-constraint','sys-null','sys-enum','sys-timestamp','sys-pagination',
  'sys-cursor','sys-upsert','sys-seed-data','sys-backfill',
  'data-table','data-row','data-column','data-primary-key','data-foreign-key','data-join',
  'data-index','data-query-plan','data-transaction','data-migration','data-backfill',
  'data-normalization','data-denormalization','data-warehouse','data-lake');

-- computing (065 + 081 os — hardware + operating-system foundations)
update terms set path='computing' where id in (
  'hw-cpu','hw-gpu','hw-core','hw-clock-speed','hw-cache','hw-ram','hw-ssd','hw-bus',
  'hw-pcie','hw-motherboard','hw-firmware','hw-bios-uefi','hw-instruction-set','hw-arm',
  'hw-soc','os-process','os-thread','os-kernel','os-system-call','os-filesystem','os-shell',
  'os-environment-variable','os-daemon','os-deadlock','os-path','os-permission','os-memory',
  'os-heap','os-garbage-collection','os-scheduler');

-- networking (066)
update terms set path='networking' where id in (
  'net-ip-address','net-dns','net-port','net-socket','net-tcp','net-udp','net-packet',
  'net-router','net-gateway','net-latency','net-bandwidth','net-throughput','net-vpn',
  'net-tls','net-certificate');

-- security (067 + 081 sec-sso)
update terms set path='security' where id in (
  'sec-permission','sec-role','sec-rbac','sec-oauth','sec-mfa','sec-encryption','sec-hash',
  'sec-secret','sec-threat-model','sec-attack-surface','sec-vulnerability','sec-zero-trust',
  'sec-sso');

-- architecture (070)
update terms set path='architecture' where id in (
  'arch-api','arch-interface','arch-abstraction','arch-service','arch-monolith',
  'arch-microservice','arch-coupling','arch-cohesion','arch-dependency-injection',
  'arch-event-driven','arch-message-bus','arch-idempotency-key','arch-consistency',
  'arch-eventual-consistency','arch-service-boundary');

-- systems-engineering (072)
update terms set path='systems-engineering' where id in (
  'se-requirement','se-constraint','se-tradeoff','se-interface-control','se-system-boundary',
  'se-stakeholder','se-use-case','se-verification','se-validation','se-traceability','se-fmea',
  'se-hazard-analysis','se-control-loop','se-feedback','se-lifecycle');

-- cloud-devops (071)
update terms set path='cloud-devops' where id in (
  'cloud-deploy','cloud-environment','cloud-container','cloud-image','cloud-kubernetes',
  'cloud-serverless','cloud-edge','cloud-cdn','cloud-cache','cloud-load-balancer',
  'cloud-autoscaling','cloud-observability','cloud-log','cloud-metric','cloud-alert');

-- qa-reliability (060 + 073 — testing + SRE/reliability)
update terms set path='qa-reliability' where id in (
  'dev-test-harness','dev-fixture','dev-mock','dev-selector','dev-snapshot-test',
  'dev-contract-test','dev-hydration','sys-race-condition','sys-rate-limit','sys-timeout',
  'sys-retry','sys-cache-invalidation','sys-rollback','qa-unit-test','qa-integration-test',
  'qa-e2e-test','qa-smoke-test','qa-regression-test','qa-flaky-test','qa-test-coverage',
  'qa-fixture','qa-mock','qa-sla','qa-slo','qa-error-budget','qa-mttr','qa-postmortem',
  'qa-root-cause');

-- math-logic (076)
update terms set path='math-logic' where id in (
  'math-boolean','math-set','math-graph','math-node','math-edge','math-tree','math-complexity',
  'math-big-o','math-probability','math-distribution','math-entropy','math-optimization',
  'math-constraint','math-state-machine','math-turing-complete');

-- tech-stack (082 — named languages/runtimes/tools/frameworks)
update terms set path='tech-stack' where id in (
  'lang-javascript','lang-typescript','lang-python','lang-rust','lang-c','lang-cpp',
  'lang-csharp','lang-java','lang-go','lang-swift','lang-kotlin','lang-html','lang-css',
  'lang-sql','lang-bash','runtime-nodejs','tool-npm','tool-pnpm','tool-vite','fw-react',
  'fw-nextjs','fw-vue','fw-svelte','data-postgres','data-redis','data-supabase','cloud-vercel',
  'tool-copilot','tool-playwright','tool-vitest');

-- enterprise-platforms (083 coding — MS365 / Power Platform / Azure / GitHub)
update terms set path='enterprise-platforms' where id in (
  'gh-actions','gh-workflow','gh-runner','ms365-tenant','ms365-admin-center','ms365-license',
  'ms365-group','ms365-sharepoint-site','ms365-entra','pp-environment','pp-power-apps',
  'pp-power-automate','pp-connector','dv-dataverse','dv-table','dv-column','dv-solution',
  'az-subscription','az-resource-group','az-resource-manager','az-key-vault',
  'az-managed-id','az-rbac');

-- data-analytics (084 — Excel / Power BI / Fabric)
update terms set path='data-analytics' where id in (
  'excel-workbook','excel-worksheet','excel-cell','excel-range','excel-table','excel-formula',
  'excel-function','excel-pivot-table','excel-power-query','excel-power-pivot','bi-report',
  'bi-dashboard','bi-workspace','bi-semantic-model','bi-measure','bi-dax','bi-calculated-column',
  'bi-slicer','bi-refresh','bi-gateway','bi-rls','fabric-microsoft-fabric','fabric-onelake',
  'fabric-lakehouse','fabric-warehouse','fabric-notebook','fabric-data-pipeline',
  'fabric-dataflow-gen2','fabric-direct-lake');

-- Merges into EXISTING coding paths (059 distributes by prefix; 075→enterprise; 080→ai-engineering)
update terms set path='git-cli' where id in ('git-worktree','git-cherry-pick','git-squash');
update terms set path='dev-concepts' where id in ('dev-monorepo','dev-typecheck','dev-codegen');
update terms set path='claude-code' where id in ('cc-handoff','cc-transcript','cc-guardrails','cc-compaction');
update terms set path='agile' where id in ('agile-smoke-test','agile-regression-test','agile-visual-qa','agile-acceptance-criteria');
update terms set path='systems' where id in ('sys-edge-function','sys-rls','sys-idempotent','sys-preview-environment');
update terms set path='ai-engineering' where id in (
  'ai-agent-loop','ai-structured-output','ai-model-routing',
  'ai-rag','ai-embedding','ai-tool-call','ai-vector-store','ai-evals','ai-guardrails');
update terms set path='enterprise' where id in (
  'ent-stacked-pr','ent-stack-preview','ent-draft-pr','ent-preview-deployment','ent-deployment-alias',
  'prod-roadmap','prod-milestone','prod-backlog','prod-ticket','prod-epic','prod-story',
  'prod-acceptance-criteria','prod-kpi','prod-okr','prod-crm','prod-erp','prod-system-of-record',
  'prod-sso','prod-audit-log','prod-compliance');

-- AI-domain packs (069 ml-* already on ai-foundations; 083 copilot-* already on ai-tools)
-- — set explicitly for determinism (no-ops if already correct):
update terms set path='ai-foundations', domain='ai' where id in (
  'ml-training-data','ml-label','ml-feature','ml-model','ml-inference','ml-classification',
  'ml-regression','ml-overfitting','ml-generalization','ml-validation-set','ml-test-set',
  'ml-precision','ml-recall','ml-gradient-descent','ml-loss-function');
update terms set path='ai-tools', domain='ai' where id in (
  'copilot-studio','copilot-agent','copilot-topic','copilot-action','copilot-knowledge-source',
  'copilot-connector');

-- 3. Re-add the CHECK with the final 29-path taxonomy.
alter table terms add constraint terms_path_check check (path in (
  -- coding (7 original + 16 re-architected)
  'git-cli','dev-concepts','enterprise','claude-code','ai-engineering','agile','systems',
  'programming','dev-tooling','dev-workflow','web-api','databases','computing','networking',
  'security','architecture','systems-engineering','cloud-devops','qa-reliability','math-logic',
  'tech-stack','enterprise-platforms','data-analytics',
  -- ai (6)
  'ai-foundations','ai-tools','ai-prompting','ai-products','ai-evaluation','ai-policy'
));

commit;
