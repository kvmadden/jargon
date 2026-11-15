import { Link } from 'react-router-dom';
import { Wordmark } from '../components/wordmark';

/** Public fallback for unknown app routes, including before sign-in. */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8 safe-top safe-bottom">
      <section
        aria-labelledby="not-found-title"
        className="w-full max-w-sm rounded-xl border border-border-default bg-surface-card p-6 text-center sm:p-8"
      >
        <Wordmark size={36} className="text-accent-jargon" />
        <p className="mt-8 font-mono text-xs font-semibold tracking-widest text-accent-jargon-hi">
          404
        </p>
        <h1
          id="not-found-title"
          className="mt-2 text-2xl font-semibold tracking-tight text-text-primary"
        >
          page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          that page isn't in the dictionary.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-accent-jargon px-6 text-sm font-semibold text-text-primary transition-colors hover:bg-accent-jargon-lo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-jargon-hi"
        >
          jargon home
        </Link>
      </section>
    </main>
  );
}
