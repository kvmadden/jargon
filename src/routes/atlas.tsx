import { Link } from 'react-router-dom';
import { CONCEPT_ATLAS, conceptAtlasSummary, type ConceptStatus } from '../lib/concept-atlas';
import { JARGON_FEEDBACK_LOOP, freshnessSummary } from '../lib/content-freshness';
import { Wordmark } from '../components/wordmark';
import { PronounceButton } from '../components/pronounce-button';
import { ErrorBoundary } from './error-boundary';

const STATUS_LABEL: Record<ConceptStatus, string> = {
  seeded: 'already seeded',
  'priority-core': 'priority core',
  candidate: 'candidate',
  'needs-curation': 'needs curation',
};

const STATUS_DOT: Record<ConceptStatus, string> = {
  seeded: 'bg-accent-jargon-hi',
  'priority-core': 'bg-text-primary',
  candidate: 'bg-text-muted',
  'needs-curation': 'bg-border-default',
};

export default function Atlas() {
  return (
    <ErrorBoundary>
      <AtlasContent />
    </ErrorBoundary>
  );
}

function AtlasContent() {
  const summary = conceptAtlasSummary();
  const sourceSummary = freshnessSummary();

  return (
    <div className="min-h-screen bg-bg-base text-text-primary safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 md:px-8 xl:px-12">
        <header className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.65fr)] lg:items-end">
          <section>
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center rounded-md pr-3 text-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-jargon"
            >
              <Wordmark size={28} className="mr-3 text-accent-jargon" />
              back to sign in
            </Link>
            <p className="mt-8 font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              concept atlas
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              concept atlas
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              a working list of terms to turn into lessons: AI, ML, code,
              hardware, systems, security, networks, cloud, data, product, and
              computation.
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 rounded-md border border-border-default bg-surface-card p-4 sm:grid-cols-4 lg:grid-cols-2">
            <Stat value={`${summary.totalLanes} lanes`} label="territory" />
            <Stat value={`${summary.totalConcepts} concepts`} label="net size" />
            <Stat value={`${summary.statusCounts.seeded}`} label="seeded" />
            <Stat value={`${summary.statusCounts.candidate}`} label="candidates" />
          </section>
        </header>

        <section
          aria-label="atlas status legend"
          className="flex flex-wrap gap-2 rounded-md border border-border-default bg-surface-card/70 p-3"
        >
          {(Object.keys(STATUS_LABEL) as ConceptStatus[]).map((status) => (
            <span
              key={status}
              className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-border-default px-3 font-mono text-2xs uppercase tracking-wider text-text-secondary"
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </section>

        <section className="grid gap-3 rounded-md border border-border-default bg-surface-card/70 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)] md:p-5">
          <div>
            <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              source freshness
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-text-primary">
              fast-moving AI names get checked against official docs
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              Kevin's notes become a solo review queue: the AI drafts corrections,
              source checks, acronym expansions, and pronunciation fixes; Kevin
              approves what becomes durable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2">
            <Stat value={`${sourceSummary.total}`} label="sources" />
            <Stat value={`${sourceSummary.fresh}`} label="fresh" />
            <Stat value={`${sourceSummary.reviewSoon}`} label="review soon" />
            <Stat value={`${sourceSummary.stale}`} label="stale" />
          </div>
          <div className="md:col-span-2">
            <p className="text-xs leading-relaxed text-text-muted">
              loop: {JARGON_FEEDBACK_LOOP.feedbackSource}; AI drafts; Kevin approves.
            </p>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          {CONCEPT_ATLAS.map((lane, laneIndex) => (
            <article
              key={lane.id}
              className="scroll-mt-16 rounded-md border border-border-default bg-surface-card p-4 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi tabular-nums">
                  {(laneIndex + 1).toString().padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="scroll-mt-16 text-lg font-semibold leading-snug text-text-primary">
                      {lane.title}
                    </h2>
                    <span className="shrink-0 rounded-full border border-border-default px-2 py-1 font-mono text-2xs uppercase tracking-wider text-text-muted sm:hidden">
                      {lane.concepts.length}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {lane.frame}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {lane.concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="min-h-[72px] rounded-md border border-border-default bg-bg-base/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-snug text-text-primary">
                        {concept.term}
                      </h3>
                      <span
                        aria-label={STATUS_LABEL[concept.status]}
                        title={STATUS_LABEL[concept.status]}
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[concept.status]}`}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                      {concept.plainMeaning}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {concept.pronunciation ? (
                        <p className="font-mono text-2xs text-accent-jargon-hi">
                          say: {concept.pronunciation}
                        </p>
                      ) : (
                        <span />
                      )}
                      <PronounceButton text={concept.term} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-border-default bg-bg-base/40 p-3">
      <p className="text-lg font-semibold leading-tight text-text-primary">{value}</p>
      <p className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </p>
    </div>
  );
}
