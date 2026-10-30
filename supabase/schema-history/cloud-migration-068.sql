-- jargon Stage B+1.28 - acronym expansion cleanup
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds explicit "what it stands for" language to existing acronym and
-- initialism terms. Pronunciation alone is not enough for learning.
--
-- Scope:
--   - terms.long_definition text only
--   - no new rows
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: guarded by ilike checks. Safe to re-apply.

update terms set long_definition = 'PR stands for pull request. ' || long_definition where id = 'git-pr' and long_definition not ilike '%pull request%';
update terms set long_definition = 'API stands for Application Programming Interface. ' || long_definition where id = 'dev-api' and long_definition not ilike '%Application Programming Interface%';
update terms set long_definition = 'CI stands for Continuous Integration. CD usually means Continuous Deployment or Continuous Delivery. ' || long_definition where id = 'dev-ci-cd' and long_definition not ilike '%Continuous Integration%';
update terms set long_definition = 'MVP stands for Minimum Viable Product. ' || long_definition where id = 'dev-mvp' and long_definition not ilike '%Minimum Viable Product%';
update terms set long_definition = 'MCP stands for Model Context Protocol. ' || long_definition where id = 'cc-mcp' and long_definition not ilike '%Model Context Protocol%';
update terms set long_definition = 'MCP stands for Model Context Protocol. ' || long_definition where id = 'cc-mcp-server' and long_definition not ilike '%Model Context Protocol%';
update terms set long_definition = 'MCP stands for Model Context Protocol. ' || long_definition where id = 'cc-mcp-client' and long_definition not ilike '%Model Context Protocol%';
update terms set long_definition = 'SDK stands for Software Development Kit. ' || long_definition where id = 'cc-sdk' and long_definition not ilike '%Software Development Kit%';
update terms set long_definition = 'JSON stands for JavaScript Object Notation. ' || long_definition where id = 'cc-settings-json' and long_definition not ilike '%JavaScript Object Notation%';
update terms set long_definition = 'LLM stands for Large Language Model. ' || long_definition where id = 'ai-llm' and long_definition not ilike '%Large Language Model%';
update terms set long_definition = 'RAG stands for Retrieval-Augmented Generation. ' || long_definition where id = 'ai-rag' and long_definition not ilike '%Retrieval-Augmented Generation%';
update terms set long_definition = 'CoT stands for chain of thought. ' || long_definition where id = 'ai-chain-of-thought' and long_definition not ilike '%chain of thought%';
update terms set long_definition = 'MoE stands for Mixture of Experts. ' || long_definition where id = 'ai-moe' and long_definition not ilike '%Mixture of Experts%';
update terms set long_definition = 'PO stands for product owner. ' || long_definition where id = 'agile-po' and long_definition not ilike '%product owner%';
update terms set long_definition = 'SM stands for scrum master. ' || long_definition where id = 'agile-sm' and long_definition not ilike '%scrum master%';
update terms set long_definition = 'PM stands for product manager. ' || long_definition where id = 'agile-pm' and long_definition not ilike '%product manager%';
update terms set long_definition = 'EM stands for engineering manager. ' || long_definition where id = 'agile-em' and long_definition not ilike '%engineering manager%';
update terms set long_definition = 'WIP stands for work in progress. ' || long_definition where id = 'agile-wip' and long_definition not ilike '%work in progress%';
update terms set long_definition = 'WIP stands for work in progress. ' || long_definition where id = 'agile-wip-limit' and long_definition not ilike '%work in progress%';
update terms set long_definition = 'PR stands for pull request. ' || long_definition where id = 'agile-code-review' and long_definition not ilike '%pull request%';
update terms set long_definition = 'QA stands for quality assurance. ' || long_definition where id = 'agile-visual-qa' and long_definition not ilike '%quality assurance%';
update terms set long_definition = 'API stands for Application Programming Interface. ' || long_definition where id = 'sys-api-gateway' and long_definition not ilike '%Application Programming Interface%';
update terms set long_definition = 'SQL stands for Structured Query Language. ' || long_definition where id = 'sys-sql' and long_definition not ilike '%Structured Query Language%';
update terms set long_definition = 'NoSQL is commonly read as not only SQL. ' || long_definition where id = 'sys-nosql' and long_definition not ilike '%not only SQL%';
update terms set long_definition = 'REST stands for Representational State Transfer. ' || long_definition where id = 'sys-rest' and long_definition not ilike '%Representational State Transfer%';
update terms set long_definition = 'CDN stands for content delivery network. ' || long_definition where id = 'sys-cdn' and long_definition not ilike '%content delivery network%';
update terms set long_definition = 'DNS stands for Domain Name System. ' || long_definition where id = 'sys-dns' and long_definition not ilike '%Domain Name System%';
update terms set long_definition = 'HTTPS stands for Hypertext Transfer Protocol Secure. TLS stands for Transport Layer Security. ' || long_definition where id = 'sys-https' and long_definition not ilike '%Hypertext Transfer Protocol Secure%';
update terms set long_definition = 'SSO stands for single sign-on. ' || long_definition where id = 'sys-sso' and long_definition not ilike '%single sign-on%';
update terms set long_definition = 'SLA stands for service-level agreement. ' || long_definition where id = 'sys-sla' and long_definition not ilike '%service-level agreement%';
update terms set long_definition = 'SLO stands for service-level objective. ' || long_definition where id = 'sys-slo' and long_definition not ilike '%service-level objective%';
update terms set long_definition = 'RLS stands for row-level security. ' || long_definition where id = 'sys-rls' and long_definition not ilike '%row-level security%';
update terms set long_definition = 'HTTP stands for Hypertext Transfer Protocol. ' || long_definition where id = 'sys-http-request' and long_definition not ilike '%Hypertext Transfer Protocol%';
update terms set long_definition = 'HTTP stands for Hypertext Transfer Protocol. ' || long_definition where id = 'sys-http-response' and long_definition not ilike '%Hypertext Transfer Protocol%';
update terms set long_definition = 'HTTP stands for Hypertext Transfer Protocol. ' || long_definition where id = 'sys-http-method' and long_definition not ilike '%Hypertext Transfer Protocol%';
update terms set long_definition = 'HTTP stands for Hypertext Transfer Protocol. ' || long_definition where id = 'sys-http-header' and long_definition not ilike '%Hypertext Transfer Protocol%';
update terms set long_definition = 'JSON stands for JavaScript Object Notation. ' || long_definition where id = 'sys-json' and long_definition not ilike '%JavaScript Object Notation%';
update terms set long_definition = 'JWT stands for JSON Web Token. ' || long_definition where id = 'sys-jwt' and long_definition not ilike '%JSON Web Token%';
update terms set long_definition = 'CORS stands for Cross-Origin Resource Sharing. ' || long_definition where id = 'sys-cors' and long_definition not ilike '%Cross-Origin Resource Sharing%';
update terms set long_definition = 'IP stands for Internet Protocol. ' || long_definition where id = 'net-ip-address' and long_definition not ilike '%Internet Protocol%';
update terms set long_definition = 'DNS stands for Domain Name System. ' || long_definition where id = 'net-dns' and long_definition not ilike '%Domain Name System%';
update terms set long_definition = 'TCP stands for Transmission Control Protocol. ' || long_definition where id = 'net-tcp' and long_definition not ilike '%Transmission Control Protocol%';
update terms set long_definition = 'UDP stands for User Datagram Protocol. ' || long_definition where id = 'net-udp' and long_definition not ilike '%User Datagram Protocol%';
update terms set long_definition = 'VPN stands for virtual private network. ' || long_definition where id = 'net-vpn' and long_definition not ilike '%virtual private network%';
update terms set long_definition = 'TLS stands for Transport Layer Security. ' || long_definition where id = 'net-tls' and long_definition not ilike '%Transport Layer Security%';
update terms set long_definition = 'RBAC stands for role-based access control. ' || long_definition where id = 'sec-rbac' and long_definition not ilike '%role-based access control%';
update terms set long_definition = 'OAuth is commonly expanded as Open Authorization, though in practice OAuth names the delegated authorization protocol. ' || long_definition where id = 'sec-oauth' and long_definition not ilike '%Open Authorization%';
update terms set long_definition = 'MFA stands for multi-factor authentication. ' || long_definition where id = 'sec-mfa' and long_definition not ilike '%multi-factor authentication%';
update terms set long_definition = 'CPU stands for central processing unit. ' || long_definition where id = 'hw-cpu' and long_definition not ilike '%central processing unit%';
update terms set long_definition = 'GPU stands for graphics processing unit. ' || long_definition where id = 'hw-gpu' and long_definition not ilike '%graphics processing unit%';
update terms set long_definition = 'RAM stands for random-access memory. ' || long_definition where id = 'hw-ram' and long_definition not ilike '%random-access memory%';
update terms set long_definition = 'SSD stands for solid-state drive. ' || long_definition where id = 'hw-ssd' and long_definition not ilike '%solid-state drive%';
update terms set long_definition = 'PCIe stands for Peripheral Component Interconnect Express. ' || long_definition where id = 'hw-pcie' and long_definition not ilike '%Peripheral Component Interconnect Express%';
update terms set long_definition = 'BIOS stands for Basic Input/Output System. UEFI stands for Unified Extensible Firmware Interface. ' || long_definition where id = 'hw-bios-uefi' and long_definition not ilike '%Basic Input/Output System%';
update terms set long_definition = 'ARM has historically been expanded as Advanced RISC Machines; today it names the ARM instruction-set architecture family. ' || long_definition where id = 'hw-arm' and long_definition not ilike '%Advanced RISC Machines%';
update terms set long_definition = 'SoC stands for system on a chip. ' || long_definition where id = 'hw-soc' and long_definition not ilike '%system on a chip%';
update terms set long_definition = 'AWS stands for Amazon Web Services. ' || long_definition where id = 'ent-aws' and long_definition not ilike '%Amazon Web Services%';
update terms set long_definition = 'GCP stands for Google Cloud Platform. ' || long_definition where id = 'ent-gcp' and long_definition not ilike '%Google Cloud Platform%';
update terms set long_definition = 'SAP is commonly expanded in English as Systems, Applications, and Products in Data Processing. ' || long_definition where id = 'ent-sap' and long_definition not ilike '%Systems, Applications, and Products%';
update terms set long_definition = 'BI stands for business intelligence. ' || long_definition where id = 'ent-powerbi' and long_definition not ilike '%business intelligence%';
