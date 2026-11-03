-- Term expansions (Kevin's ruling, 2026-11-03): every term that is an
-- abbreviation, initialism, acronym or clipped word says what it stands for,
-- right under its title. This is data, not a guess at render time.
--
-- expansion is null for an ordinary word. Otherwise it is one of:
--   {"parts": [{"abbr": "RLS", "expansion": "row-level security", "kind": "letters"}]}
--   {"parts": [{"abbr": "repo", "expansion": "repository", "kind": "clipped"}]}
--   {"not_abbreviation": true}  (looks like one, but is a name)
-- An entry may carry "review" with the reason a person should confirm it.
--
-- Generated from supabase/term-expansions.json. Safe to rerun: each update
-- sets the same value again.

alter table terms add column if not exists expansion jsonb;

update terms set expansion = '{"parts": [{"abbr": "PR", "expansion": "pull request", "kind": "letters"}]}'::jsonb where id = 'agile-code-review';
update terms set expansion = '{"parts": [{"abbr": "demo", "expansion": "demonstration", "kind": "clipped"}]}'::jsonb where id = 'agile-demo';
update terms set expansion = '{"parts": [{"abbr": "EM", "expansion": "engineering manager", "kind": "letters"}]}'::jsonb where id = 'agile-em';
update terms set expansion = '{"parts": [{"abbr": "PM", "expansion": "product manager", "kind": "letters"}]}'::jsonb where id = 'agile-pm';
update terms set expansion = '{"parts": [{"abbr": "PO", "expansion": "product owner", "kind": "letters"}]}'::jsonb where id = 'agile-po';
update terms set expansion = '{"parts": [{"abbr": "SM", "expansion": "scrum master", "kind": "letters"}]}'::jsonb where id = 'agile-sm';
update terms set expansion = '{"parts": [{"abbr": "QA", "expansion": "quality assurance", "kind": "letters"}]}'::jsonb where id = 'agile-visual-qa';
update terms set expansion = '{"parts": [{"abbr": "WIP", "expansion": "work in progress", "kind": "letters"}]}'::jsonb where id = 'agile-wip';
update terms set expansion = '{"parts": [{"abbr": "WIP", "expansion": "work in progress", "kind": "letters"}]}'::jsonb where id = 'agile-wip-limit';
update terms set expansion = '{"parts": [{"abbr": "eval", "expansion": "evaluation", "kind": "clipped"}]}'::jsonb where id = 'ai-eval';
update terms set expansion = '{"parts": [{"abbr": "evals", "expansion": "evaluations", "kind": "clipped"}]}'::jsonb where id = 'ai-evals';
update terms set expansion = '{"parts": [{"abbr": "LLM", "expansion": "large language model", "kind": "letters"}]}'::jsonb where id = 'ai-llm';
update terms set expansion = '{"parts": [{"abbr": "RAG", "expansion": "retrieval-augmented generation", "kind": "letters"}]}'::jsonb where id = 'ai-rag';
update terms set expansion = '{"parts": [{"abbr": "AGI", "expansion": "artificial general intelligence", "kind": "letters"}]}'::jsonb where id = 'aid-agi';
update terms set expansion = '{"parts": [{"abbr": "AI", "expansion": "artificial intelligence", "kind": "letters"}]}'::jsonb where id = 'aid-ai';
update terms set expansion = '{"parts": [{"abbr": "AI", "expansion": "artificial intelligence", "kind": "letters"}]}'::jsonb where id = 'aid-assistant';
update terms set expansion = '{"parts": [{"abbr": "GPT", "expansion": "generative pre-trained transformer", "kind": "letters"}]}'::jsonb where id = 'aid-chatgpt';
update terms set expansion = '{"parts": [{"abbr": "evals", "expansion": "evaluations", "kind": "clipped"}]}'::jsonb where id = 'aid-evals';
update terms set expansion = '{"parts": [{"abbr": "eval", "expansion": "evaluation", "kind": "clipped"}]}'::jsonb where id = 'aid-human-eval';
update terms set expansion = '{"parts": [{"abbr": "LLM", "expansion": "large language model", "kind": "letters"}]}'::jsonb where id = 'aid-llm';
update terms set expansion = '{"parts": [{"abbr": "MCP", "expansion": "Model Context Protocol", "kind": "letters"}]}'::jsonb where id = 'aid-mcp';
update terms set expansion = '{"parts": [{"abbr": "RAG", "expansion": "retrieval-augmented generation", "kind": "letters"}]}'::jsonb where id = 'aid-rag';
update terms set expansion = '{"parts": [{"abbr": "API", "expansion": "application programming interface", "kind": "letters"}]}'::jsonb where id = 'arch-api';
update terms set expansion = '{"parts": [{"abbr": "RBAC", "expansion": "role-based access control", "kind": "letters"}]}'::jsonb where id = 'az-rbac';
update terms set expansion = '{"parts": [{"abbr": "BI", "expansion": "business intelligence", "kind": "letters"}]}'::jsonb where id = 'bi-dashboard';
update terms set expansion = '{"parts": [{"abbr": "DAX", "expansion": "Data Analysis Expressions", "kind": "letters"}]}'::jsonb where id = 'bi-dax';
update terms set expansion = '{"parts": [{"abbr": "BI", "expansion": "business intelligence", "kind": "letters"}]}'::jsonb where id = 'bi-report';
update terms set expansion = '{"parts": [{"abbr": "RLS", "expansion": "row-level security", "kind": "letters"}]}'::jsonb where id = 'bi-rls';
update terms set expansion = '{"parts": [{"abbr": "BI", "expansion": "business intelligence", "kind": "letters"}]}'::jsonb where id = 'bi-workspace';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'cc-askuserquestion';
update terms set expansion = '{"parts": [{"abbr": ".md", "expansion": "Markdown", "kind": "clipped"}]}'::jsonb where id = 'cc-claude-md';
update terms set expansion = '{"parts": [{"abbr": "MCP", "expansion": "Model Context Protocol", "kind": "letters"}]}'::jsonb where id = 'cc-mcp';
update terms set expansion = '{"parts": [{"abbr": "MCP", "expansion": "Model Context Protocol", "kind": "letters"}]}'::jsonb where id = 'cc-mcp-client';
update terms set expansion = '{"parts": [{"abbr": "MCP", "expansion": "Model Context Protocol", "kind": "letters"}]}'::jsonb where id = 'cc-mcp-server';
update terms set expansion = '{"parts": [{"abbr": "SDK", "expansion": "software development kit", "kind": "letters"}]}'::jsonb where id = 'cc-sdk';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'cc-todowrite';
update terms set expansion = '{"parts": [{"abbr": "CDN", "expansion": "content delivery network", "kind": "letters"}]}'::jsonb where id = 'cloud-cdn';
update terms set expansion = '{"parts": [{"abbr": "API", "expansion": "application programming interface", "kind": "letters"}]}'::jsonb where id = 'dev-api';
update terms set expansion = '{"parts": [{"abbr": "CI", "expansion": "continuous integration", "kind": "letters"}, {"abbr": "CD", "expansion": "continuous delivery or continuous deployment", "kind": "letters"}]}'::jsonb where id = 'dev-ci-cd';
update terms set expansion = '{"parts": [{"abbr": "MVP", "expansion": "minimum viable product", "kind": "letters"}]}'::jsonb where id = 'dev-mvp';
update terms set expansion = '{"parts": [{"abbr": "props", "expansion": "properties", "kind": "clipped"}]}'::jsonb where id = 'dev-props';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'dev-readme';
update terms set expansion = '{"parts": [{"abbr": "AWS", "expansion": "Amazon Web Services", "kind": "letters"}]}'::jsonb where id = 'ent-aws';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-bigquery';
update terms set expansion = '{"parts": [{"abbr": "PR", "expansion": "pull request", "kind": "letters"}]}'::jsonb where id = 'ent-draft-pr';
update terms set expansion = '{"parts": [{"abbr": "GCP", "expansion": "Google Cloud Platform", "kind": "letters"}]}'::jsonb where id = 'ent-gcp';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-github';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-gitlab';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-hubspot';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-jira';
update terms set expansion = '{"parts": [{"abbr": "BI", "expansion": "business intelligence", "kind": "letters"}]}'::jsonb where id = 'ent-powerbi';
update terms set expansion = '{"parts": [{"abbr": "SAP", "expansion": "Systems, Applications and Products in Data Processing", "kind": "letters"}], "review": "SAP is a company name. The expansion is the English form of the founders'' German name, and the company rarely uses it."}'::jsonb where id = 'ent-sap';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'ent-servicenow';
update terms set expansion = '{"parts": [{"abbr": "PR", "expansion": "pull request", "kind": "letters"}]}'::jsonb where id = 'ent-stacked-pr';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'excel-pivot-table';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'fabric-onelake';
update terms set expansion = '{"parts": [{"abbr": "CI", "expansion": "continuous integration", "kind": "letters"}]}'::jsonb where id = 'flow-ci';
update terms set expansion = '{"parts": [{"abbr": "PR", "expansion": "pull request", "kind": "letters"}]}'::jsonb where id = 'flow-pull-request';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'git-head';
update terms set expansion = '{"parts": [{"abbr": "PR", "expansion": "pull request", "kind": "letters"}]}'::jsonb where id = 'git-pr';
update terms set expansion = '{"parts": [{"abbr": "ARM", "expansion": "Advanced RISC Machines", "kind": "letters"}], "review": "ARM first stood for Acorn RISC Machine, later Advanced RISC Machines, and the company now writes Arm as a name. RISC is itself short for reduced instruction set computer."}'::jsonb where id = 'hw-arm';
update terms set expansion = '{"parts": [{"abbr": "BIOS", "expansion": "Basic Input/Output System", "kind": "letters"}, {"abbr": "UEFI", "expansion": "Unified Extensible Firmware Interface", "kind": "letters"}]}'::jsonb where id = 'hw-bios-uefi';
update terms set expansion = '{"parts": [{"abbr": "CPU", "expansion": "central processing unit", "kind": "letters"}]}'::jsonb where id = 'hw-cache';
update terms set expansion = '{"parts": [{"abbr": "CPU", "expansion": "central processing unit", "kind": "letters"}]}'::jsonb where id = 'hw-cpu';
update terms set expansion = '{"parts": [{"abbr": "GPU", "expansion": "graphics processing unit", "kind": "letters"}]}'::jsonb where id = 'hw-gpu';
update terms set expansion = '{"parts": [{"abbr": "PCIe", "expansion": "Peripheral Component Interconnect Express", "kind": "letters"}]}'::jsonb where id = 'hw-pcie';
update terms set expansion = '{"parts": [{"abbr": "RAM", "expansion": "random-access memory", "kind": "letters"}]}'::jsonb where id = 'hw-ram';
update terms set expansion = '{"parts": [{"abbr": "SSD", "expansion": "solid-state drive", "kind": "letters"}]}'::jsonb where id = 'hw-ssd';
update terms set expansion = '{"parts": [{"abbr": "CSS", "expansion": "Cascading Style Sheets", "kind": "letters"}]}'::jsonb where id = 'lang-css';
update terms set expansion = '{"parts": [{"abbr": "HTML", "expansion": "Hypertext Markup Language", "kind": "letters"}]}'::jsonb where id = 'lang-html';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'lang-javascript';
update terms set expansion = '{"parts": [{"abbr": "SQL", "expansion": "Structured Query Language", "kind": "letters"}]}'::jsonb where id = 'lang-sql';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'lang-typescript';
update terms set expansion = '{"parts": [{"abbr": "admin", "expansion": "administration", "kind": "clipped"}], "review": "\"admin\" can also mean administrator. In \"admin center\" it is read as administration."}'::jsonb where id = 'ms365-admin-center';
update terms set expansion = '{"parts": [{"abbr": "ID", "expansion": "identity", "kind": "clipped"}], "review": "In Microsoft Entra ID, Microsoft treats \"ID\" as identity. It is a product name, so a reviewer should confirm the wording."}'::jsonb where id = 'ms365-entra';
update terms set expansion = '{"parts": [{"abbr": "DNS", "expansion": "Domain Name System", "kind": "letters"}]}'::jsonb where id = 'net-dns';
update terms set expansion = '{"parts": [{"abbr": "IP", "expansion": "Internet Protocol", "kind": "letters"}]}'::jsonb where id = 'net-ip-address';
update terms set expansion = '{"parts": [{"abbr": "TCP", "expansion": "Transmission Control Protocol", "kind": "letters"}]}'::jsonb where id = 'net-tcp';
update terms set expansion = '{"parts": [{"abbr": "TLS", "expansion": "Transport Layer Security", "kind": "letters"}]}'::jsonb where id = 'net-tls';
update terms set expansion = '{"parts": [{"abbr": "UDP", "expansion": "User Datagram Protocol", "kind": "letters"}]}'::jsonb where id = 'net-udp';
update terms set expansion = '{"parts": [{"abbr": "VPN", "expansion": "virtual private network", "kind": "letters"}]}'::jsonb where id = 'net-vpn';
update terms set expansion = '{"parts": [{"abbr": "OS", "expansion": "operating system", "kind": "letters"}]}'::jsonb where id = 'os-permission';
update terms set expansion = '{"parts": [{"abbr": "apps", "expansion": "applications", "kind": "clipped"}]}'::jsonb where id = 'pp-power-apps';
update terms set expansion = '{"parts": [{"abbr": "CRM", "expansion": "customer relationship management", "kind": "letters"}]}'::jsonb where id = 'prod-crm';
update terms set expansion = '{"parts": [{"abbr": "ERP", "expansion": "enterprise resource planning", "kind": "letters"}]}'::jsonb where id = 'prod-erp';
update terms set expansion = '{"parts": [{"abbr": "KPI", "expansion": "key performance indicator", "kind": "letters"}]}'::jsonb where id = 'prod-kpi';
update terms set expansion = '{"parts": [{"abbr": "OKR", "expansion": "objectives and key results", "kind": "letters"}]}'::jsonb where id = 'prod-okr';
update terms set expansion = '{"parts": [{"abbr": "SSO", "expansion": "single sign-on", "kind": "letters"}]}'::jsonb where id = 'prod-sso';
update terms set expansion = '{"parts": [{"abbr": "MTTR", "expansion": "mean time to recovery", "kind": "letters"}], "review": "MTTR is also read as mean time to repair or to restore. The canonical entry uses recovery."}'::jsonb where id = 'qa-mttr';
update terms set expansion = '{"parts": [{"abbr": "SLA", "expansion": "service-level agreement", "kind": "letters"}]}'::jsonb where id = 'qa-sla';
update terms set expansion = '{"parts": [{"abbr": "SLO", "expansion": "service-level objective", "kind": "letters"}]}'::jsonb where id = 'qa-slo';
update terms set expansion = '{"parts": [{"abbr": "FMEA", "expansion": "failure mode and effects analysis", "kind": "letters"}]}'::jsonb where id = 'se-fmea';
update terms set expansion = '{"parts": [{"abbr": "MFA", "expansion": "multi-factor authentication", "kind": "letters"}]}'::jsonb where id = 'sec-mfa';
update terms set expansion = '{"parts": [{"abbr": "OAuth", "expansion": "open authorization", "kind": "letters"}]}'::jsonb where id = 'sec-oauth';
update terms set expansion = '{"parts": [{"abbr": "RBAC", "expansion": "role-based access control", "kind": "letters"}]}'::jsonb where id = 'sec-rbac';
update terms set expansion = '{"parts": [{"abbr": "SSO", "expansion": "single sign-on", "kind": "letters"}]}'::jsonb where id = 'sec-sso';
update terms set expansion = '{"parts": [{"abbr": "API", "expansion": "application programming interface", "kind": "letters"}]}'::jsonb where id = 'sys-api-gateway';
update terms set expansion = '{"parts": [{"abbr": "CDN", "expansion": "content delivery network", "kind": "letters"}]}'::jsonb where id = 'sys-cdn';
update terms set expansion = '{"parts": [{"abbr": "CORS", "expansion": "cross-origin resource sharing", "kind": "letters"}]}'::jsonb where id = 'sys-cors';
update terms set expansion = '{"parts": [{"abbr": "DNS", "expansion": "Domain Name System", "kind": "letters"}]}'::jsonb where id = 'sys-dns';
update terms set expansion = '{"parts": [{"abbr": "GraphQL", "expansion": "graph query language", "kind": "clipped"}], "review": "GraphQL is a product name. \"QL\" is commonly read as query language, but the project does not publish an official expansion."}'::jsonb where id = 'sys-graphql';
update terms set expansion = '{"parts": [{"abbr": "HTTP", "expansion": "Hypertext Transfer Protocol", "kind": "letters"}]}'::jsonb where id = 'sys-http-header';
update terms set expansion = '{"parts": [{"abbr": "HTTP", "expansion": "Hypertext Transfer Protocol", "kind": "letters"}]}'::jsonb where id = 'sys-http-method';
update terms set expansion = '{"parts": [{"abbr": "HTTP", "expansion": "Hypertext Transfer Protocol", "kind": "letters"}]}'::jsonb where id = 'sys-http-request';
update terms set expansion = '{"parts": [{"abbr": "HTTP", "expansion": "Hypertext Transfer Protocol", "kind": "letters"}]}'::jsonb where id = 'sys-http-response';
update terms set expansion = '{"parts": [{"abbr": "HTTPS", "expansion": "Hypertext Transfer Protocol Secure", "kind": "letters"}, {"abbr": "TLS", "expansion": "Transport Layer Security", "kind": "letters"}]}'::jsonb where id = 'sys-https';
update terms set expansion = '{"parts": [{"abbr": "JSON", "expansion": "JavaScript Object Notation", "kind": "letters"}]}'::jsonb where id = 'sys-json';
update terms set expansion = '{"parts": [{"abbr": "JWT", "expansion": "JSON Web Token", "kind": "letters"}]}'::jsonb where id = 'sys-jwt';
update terms set expansion = '{"parts": [{"abbr": "NoSQL", "expansion": "not only SQL", "kind": "letters"}], "review": "Usage varies: some sources say \"not only SQL\", others \"non-SQL\" or \"non-relational\"."}'::jsonb where id = 'sys-nosql';
update terms set expansion = '{"parts": [{"abbr": "REST", "expansion": "representational state transfer", "kind": "letters"}]}'::jsonb where id = 'sys-rest';
update terms set expansion = '{"parts": [{"abbr": "RLS", "expansion": "row-level security", "kind": "letters"}]}'::jsonb where id = 'sys-rls';
update terms set expansion = '{"parts": [{"abbr": "SLA", "expansion": "service-level agreement", "kind": "letters"}]}'::jsonb where id = 'sys-sla';
update terms set expansion = '{"parts": [{"abbr": "SLO", "expansion": "service-level objective", "kind": "letters"}]}'::jsonb where id = 'sys-slo';
update terms set expansion = '{"parts": [{"abbr": "SQL", "expansion": "Structured Query Language", "kind": "letters"}]}'::jsonb where id = 'sys-sql';
update terms set expansion = '{"parts": [{"abbr": "SSO", "expansion": "single sign-on", "kind": "letters"}]}'::jsonb where id = 'sys-sso';
update terms set expansion = '{"not_abbreviation": true}'::jsonb where id = 'sys-websocket';
update terms set expansion = '{"parts": [{"abbr": "app", "expansion": "application", "kind": "clipped"}]}'::jsonb where id = 'web-spa';
update terms set expansion = '{"parts": [{"abbr": "URL", "expansion": "Uniform Resource Locator", "kind": "letters"}]}'::jsonb where id = 'web-url';
