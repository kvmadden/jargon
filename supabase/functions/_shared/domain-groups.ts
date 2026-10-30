// Domain → DomainGroup id, for Edge-Function lookups (B+1.8).
//
// Mirror of `src/lib/domains.ts` `DOMAIN_META[*].groupId` + the
// `DOMAIN_GROUPS` registry. Edge Functions can't import the TS-side
// registry, so we duplicate the small lookup here.
//
// HARD RULE: when you add a domain to `src/lib/domains.ts` AND assign
// it a groupId, you MUST add the matching entries here. Pre-deploy
// script gate-7 was extended in B+1.8 to also check group key drift.
//
// Today: one group ('knowledge-work') containing one domain ('coding').

const GROUP_BY_DOMAIN: Record<string, string> = {
  coding: 'knowledge-work',
  // B+1.9 — AI domain joins the same family. Future excel /
  // microsoft-365 / power-platform domains land here too.
  ai: 'knowledge-work',
};

/** Returns the group id for a domain, or 'knowledge-work' as the safe
 *  default for unknown domains. */
export function groupForDomain(domain: string | null | undefined): string {
  if (!domain) return 'knowledge-work';
  return GROUP_BY_DOMAIN[domain] ?? 'knowledge-work';
}
