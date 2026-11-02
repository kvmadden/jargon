import { useEffect, useMemo, useState } from 'react';
import type { EducationLevel, UserProfileRow } from '../lib/database.types';
import { searchInterests } from '../lib/interest-dictionary';
import {
  ONBOARDING_DOMAIN_OPTIONS,
  isLiveDomainOption,
  pickableDomain,
  onboardingIconUrl,
  type Domain,
} from '../lib/domains';
import { LivedIconStrip } from './lived-icon-strip';

/**
 * The 6-field profile capture form. Used in two places:
 *   1. Onboarding step 3 (`/onboarding/profile`) — see B+1.2 wizard, that
 *      route does NOT use this component (it has its own per-question
 *      wizard); this form remains the Settings backfill surface.
 *   2. Settings → your translator → edit profile — UPDATE path, pre-filled.
 *
 * The component is presentational — the parent owns the save/skip side-effects
 * (route navigation, profile-step session marking). It just renders the fields,
 * validates "all empty" client-side, and hands the assembled patch back via
 * `onSave`.
 *
 * Education uses single-select chips (toggleable — tap the same chip to clear).
 * Interests use a tag-input pattern with dictionary autocomplete (B+1.4-A):
 * type → top-10 suggestions from `interest-dictionary.ts` drop down; tap a row
 * or hit enter on the top match to add as a chip; enter on text not in the
 * dictionary adds as a free-form chip; backspace on empty pops the last chip.
 *
 * Stage B+1.2 added two more fields below interests so the Settings surface
 * stays in sync with the onboarding wizard:
 *   - heritage (text, free-form geography/culture/lineage)
 *   - roles (multi-select chips: parent / mentor / immigrant / etc.)
 *
 * Background remains the catch-all 500-char textarea at the bottom.
 *
 * Spec: the design spec §4.1 (revised B+1.2).
 */

export interface ProfileFormValue {
  /**
   * B+1.10 — which domain the user is actively learning. Resolves to a
   * strict Domain via `pickableDomain()` at save time; coming-soon picks
   * fall back to DEFAULT_DOMAIN.
   */
  active_domain: Domain;
  /**
   * B+1.10 (display_name push) — preferred display name for greetings.
   * Capitalization preserved verbatim. Null = not provided.
   */
  display_name: string | null;
  /**
   * B+1.10 — freeform "what brings you to jargon?" answer. Replaces the
   * legacy `goals_extended` chip array on the onboarding wizard, and is
   * surfaced here so the field is editable post-onboarding too.
   */
  goals_freeform: string | null;
  /**
   * B+1.11 — self-described relationship to the gifter (recipient view) or
   * just to "the people who shape your world" (self-onboarding). Single chip
   * pick from RELATIONSHIP_OPTIONS OR a freeform "other" value (≤60 chars).
   * Null = not provided.
   */
  relationship: string | null;
  education_level: EducationLevel | null;
  job: string | null;
  interests: string[];
  heritage: string | null;
  roles: string[];
  background_text: string | null;
  personalization_enabled: boolean;
}

interface ProfileFormProps {
  /**
   * Initial values. `null` = no row exists (new user). When provided, the form
   * pre-fills (edit mode in Settings) and toggles the save copy to "save changes".
   */
  initial?: UserProfileRow | null;
  /** Called when the user taps the primary CTA. Parent owns side-effects. */
  onSave: (value: ProfileFormValue) => void | Promise<void>;
  /** Called when the user taps the secondary skip link. Optional — when omitted, the link is hidden. */
  onSkip?: () => void;
  /** Primary CTA copy. Default "save and finish". */
  saveLabel?: string;
  /** Secondary link copy. Default "skip — i'll keep it generic". */
  skipLabel?: string;
  /** Disables both CTAs while a parent-owned save is in flight. */
  busy?: boolean;
  /**
   * B+1.11 — optional callback to regenerate the lived-icons strip via Opus.
   * Parent owns the actual side-effect (calling pickLivedIcons + persisting
   * via upsertUserProfile). The form renders a small section displaying the
   * current `initial.lived_icons` + the regenerate button only when this
   * prop is provided. Returns the new slug array so the form can show a
   * pre-save preview before the parent re-fetches `initial`.
   *
   * Editable manual override is OUT OF SCOPE for v1 — there's no chooser UI,
   * the only edit affordance is "regenerate from my profile."
   */
  onRegenerateLivedIcons?: () => Promise<string[]>;
}

const MAX_BACKGROUND_CHARS = 500;
const MAX_HERITAGE_CHARS = 120;
const MAX_GOALS_FREEFORM_CHARS = 500;
const MAX_DISPLAY_NAME_CHARS = 80;
const MAX_RELATIONSHIP_CHARS = 60;

const EDUCATION_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: 'high-school', label: 'high school' },
  { value: 'some-college', label: 'some college' },
  { value: 'associates', label: 'associate’s' },
  { value: 'bachelors', label: 'bachelor’s' },
  { value: 'masters', label: 'master’s' },
  { value: 'doctorate', label: 'doctorate' },
  { value: 'other', label: 'other' },
];

// Stage B+1.2 — locked role chip set (mirrors onboarding-profile.tsx ROLE_OPTIONS).
const ROLE_OPTIONS = [
  'parent',
  'grandparent',
  'partner',
  'manager',
  'mentor',
  'student',
  'immigrant',
  'veteran',
  'caretaker',
  'freelancer',
  'entrepreneur',
  'other',
];

// Stage B+1.11 — single-select relationship chip set. MUST be kept in lockstep
// with RELATIONSHIP_OPTIONS in src/routes/gift-send.tsx — same labels in the
// same order so the gift-send sender-pick and the recipient's editable Settings
// view present identically. The "other" sentinel opens a freeform input.
const RELATIONSHIP_OPTIONS = [
  'father-in-law',
  'mother-in-law',
  'parent',
  'sibling',
  'partner / spouse',
  'friend',
  'mentor',
  'colleague',
  'adult child',
  'other',
];

export function ProfileForm({
  initial,
  onSave,
  onSkip,
  saveLabel = 'save and finish',
  skipLabel = 'skip — i’ll keep it generic',
  busy = false,
  onRegenerateLivedIcons,
}: ProfileFormProps) {
  const [domainPick, setDomainPick] = useState<string>(initial?.active_domain ?? 'coding');
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [goalsFreeform, setGoalsFreeform] = useState(initial?.goals_freeform ?? '');
  const [education, setEducation] = useState<EducationLevel | null>(initial?.education_level ?? null);
  const [job, setJob] = useState(initial?.job ?? '');
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [interestInput, setInterestInput] = useState('');
  const [heritage, setHeritage] = useState(initial?.heritage ?? '');
  const [roles, setRoles] = useState<string[]>(initial?.roles ?? []);
  const [background, setBackground] = useState(initial?.background_text ?? '');
  // B+1.11 — relationship state. We track the picked chip + the freeform
  // "other" value separately so toggling between presets and "other" doesn't
  // lose what the user typed. The actual `relationship` value passed to onSave
  // is computed at save time: presetPick if non-empty, else otherText.trim().
  const [relationshipPreset, setRelationshipPreset] = useState<string>(() => {
    const r = (initial?.relationship ?? '').trim();
    if (r.length === 0) return '';
    if (RELATIONSHIP_OPTIONS.includes(r) && r !== 'other') return r;
    return 'other';
  });
  const [relationshipOther, setRelationshipOther] = useState<string>(() => {
    const r = (initial?.relationship ?? '').trim();
    if (r.length === 0) return '';
    if (RELATIONSHIP_OPTIONS.includes(r) && r !== 'other') return '';
    return r;
  });
  const [hint, setHint] = useState<string | null>(null);
  // B+1.11 — local copy of lived_icons so the regenerate button can show an
  // immediate preview of the new strip without waiting for the parent to
  // re-fetch `initial`. Re-primed by the same useEffect that reseeds the
  // other fields.
  const [livedIcons, setLivedIcons] = useState<string[]>(initial?.lived_icons ?? []);
  const [regenerating, setRegenerating] = useState(false);

  // Re-prime when `initial` changes (e.g. parent re-fetches profile after save).
  useEffect(() => {
    if (initial) {
      setDomainPick(initial.active_domain ?? 'coding');
      setDisplayName(initial.display_name ?? '');
      setGoalsFreeform(initial.goals_freeform ?? '');
      setEducation(initial.education_level);
      setJob(initial.job ?? '');
      setInterests(initial.interests);
      setHeritage(initial.heritage ?? '');
      setRoles(initial.roles ?? []);
      setBackground(initial.background_text ?? '');
      const r = (initial.relationship ?? '').trim();
      if (r.length === 0) {
        setRelationshipPreset('');
        setRelationshipOther('');
      } else if (RELATIONSHIP_OPTIONS.includes(r) && r !== 'other') {
        setRelationshipPreset(r);
        setRelationshipOther('');
      } else {
        setRelationshipPreset('other');
        setRelationshipOther(r);
      }
      setLivedIcons(initial.lived_icons ?? []);
    }
  }, [initial]);

  // Resolved relationship value — preset wins if non-empty, else the freeform
  // "other" text (trimmed). Empty string → null at save.
  const resolvedRelationship: string =
    relationshipPreset === 'other'
      ? relationshipOther.trim()
      : relationshipPreset.trim();

  // Domain is always set (defaults to 'coding') so it doesn't count toward
  // "all empty" — that check still fires only when every freeform/multi field
  // is empty, matching the prior behavior so the hint copy still makes sense.
  // display_name also doesn't count toward "all empty" — it's a cosmetic
  // axis that doesn't drive personalization, and a user filling ONLY the
  // display name shouldn't be punished. relationship counts — it IS a
  // personalization signal (drives register / emotional distance).
  const isAllEmpty =
    !education &&
    job.trim().length === 0 &&
    interests.length === 0 &&
    heritage.trim().length === 0 &&
    roles.length === 0 &&
    background.trim().length === 0 &&
    goalsFreeform.trim().length === 0 &&
    resolvedRelationship.length === 0;

  function toggleRole(value: string) {
    setRoles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  // Lowercased set of currently-picked interests for O(1) dedupe + dictionary
  // exclusion on each keystroke. Matches the wizard's pattern in
  // onboarding-profile.tsx StepInterests so behavior stays identical between
  // the two profile-capture surfaces.
  const interestsLower = useMemo(
    () => new Set(interests.map((v) => v.toLowerCase())),
    [interests],
  );

  // Top-10 dictionary autocomplete suggestions, excluding already-picked.
  const interestSuggestions = useMemo(
    () => searchInterests(interestInput, { excludeLower: interestsLower, limit: 10 }),
    [interestInput, interestsLower],
  );

  function addInterest(raw: string) {
    // Casing decision (B+1.4-A): preserve dictionary case for dictionary picks
    // (NFL, K-pop, Premier League stay capitalized) and preserve user-typed
    // case for free-form additions. Dedupe is case-insensitive — first one in
    // wins, so adding "NFL" then "nfl" yields a single "NFL" chip.
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (interestsLower.has(cleaned.toLowerCase())) {
      setInterestInput('');
      return;
    }
    setInterests((prev) => [...prev, cleaned]);
    setInterestInput('');
  }

  function removeInterest(value: string) {
    setInterests((prev) => prev.filter((v) => v !== value));
  }

  function handleInterestKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // Prefer the top suggestion when it exact-matches the typed string
      // (case-insensitive) so "nfl" + enter normalizes to dictionary "NFL".
      const top = interestSuggestions[0];
      if (top && top.toLowerCase() === interestInput.trim().toLowerCase()) {
        addInterest(top);
      } else {
        addInterest(interestInput);
      }
    } else if (e.key === 'Backspace' && interestInput.length === 0 && interests.length > 0) {
      removeInterest(interests[interests.length - 1]);
    }
  }

  // B+1.11 — fire pickLivedIcons via the parent-supplied callback. The
  // parent owns the actual side-effect (network call + upsertUserProfile)
  // — we just trigger it and stage the new slugs locally so the user sees
  // the new strip immediately, before the parent re-fetches `initial`.
  async function handleRegenerateLivedIcons() {
    if (regenerating || busy || !onRegenerateLivedIcons) return;
    setRegenerating(true);
    try {
      const next = await onRegenerateLivedIcons();
      setLivedIcons(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[profile-form] regenerate lived icons failed', err);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSave() {
    if (busy) return;
    if (isAllEmpty) {
      setHint('add at least one thing — or tap skip');
      return;
    }
    setHint(null);
    await onSave({
      active_domain: pickableDomain(domainPick),
      // B+1.10 (display_name): trim ONLY for empty-collapse — capitalization
      // is preserved verbatim. Whitespace at the edges is the only thing
      // we strip. Empty string → null so the DB stores no value.
      display_name: displayName.trim() || null,
      goals_freeform: goalsFreeform.trim() || null,
      // B+1.11 (relationship): same trim-only treatment. Empty → null.
      relationship: resolvedRelationship.length > 0 ? resolvedRelationship : null,
      education_level: education,
      job: job.trim() || null,
      interests,
      heritage: heritage.trim() || null,
      roles,
      background_text: background.trim() || null,
      personalization_enabled: initial?.personalization_enabled ?? true,
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-8">
        {/* −1. Display name (B+1.10 — display_name push). Top of the form
            because it's the most personal field. Capitalization preserved
            verbatim — no force-lower / force-upper at write or render. */}
        <Field label="what should I call you?" htmlFor="profile-display-name">
          <input
            id="profile-display-name"
            type="text"
            value={displayName}
            aria-label="what should I call you? preferred display name"
            onChange={(e) => {
              if (e.target.value.length <= MAX_DISPLAY_NAME_CHARS) {
                setDisplayName(e.target.value);
              }
            }}
            placeholder="first name, nickname, whatever feels right"
            maxLength={MAX_DISPLAY_NAME_CHARS}
            autoComplete="given-name"
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 min-h-[44px]"
          />
          <p className="text-xs text-text-muted mt-2">
            shows up in greetings ("hi {'{'}your name{'}'},") and welcome toasts.
          </p>
        </Field>

        {/* −0.5. Relationship (B+1.11). Single-select chip with an "other"
            freeform escape hatch. For gift recipients this is pre-filled
            from the sender's pick (copied at accept time); they can edit
            here if it doesn't fit how they think of the relationship. */}
        <Field label="how do you relate to whoever set this up?">
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            shapes the register the translator uses. one tap.
          </p>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_OPTIONS.map((opt) => {
              const selected = relationshipPreset === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      // Toggle off — clear both.
                      setRelationshipPreset('');
                      if (opt === 'other') setRelationshipOther('');
                    } else {
                      setRelationshipPreset(opt);
                      if (opt !== 'other') setRelationshipOther('');
                    }
                  }}
                  aria-pressed={selected}
                  className={`min-h-[44px] px-3 rounded-md text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${
                    selected
                      ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                      : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {relationshipPreset === 'other' && (
            <input
              id="profile-relationship-other"
              type="text"
              value={relationshipOther}
              aria-label="other relationship details"
              onChange={(e) => {
                if (e.target.value.length <= MAX_RELATIONSHIP_CHARS) {
                  setRelationshipOther(e.target.value);
                }
              }}
              placeholder="say more — e.g. neighbor, in-law's parent"
              maxLength={MAX_RELATIONSHIP_CHARS}
              autoComplete="off"
              className="mt-3 w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 min-h-[44px]"
            />
          )}
        </Field>

        {/* B+1.11 — lived icons. Read-only display + a "regenerate" button.
            Editable manual override is OUT OF SCOPE for v1 (would require a
            chooser UI — defer). The Field only renders when the parent passes
            `onRegenerateLivedIcons`; without the callback there's nothing
            actionable to surface here, and the strip itself already lives in
            the home header. */}
        {onRegenerateLivedIcons && (
          <Field label="your lived icons">
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              the 1-3 phosphor icons that sit next to the wordmark. picked from your profile.
            </p>
            <div className="flex items-center justify-between min-h-[56px] bg-surface-card border border-border-default rounded-lg px-3 py-2 gap-3">
              <div className="flex-1 min-w-0">
                {livedIcons.length > 0 ? (
                  <LivedIconStrip slugs={livedIcons} size={32} tone="accent-hi" />
                ) : (
                  <p className="text-xs text-text-muted">
                    none yet — tap regenerate to pick some
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleRegenerateLivedIcons()}
                disabled={regenerating || busy}
                className="text-xs lowercase text-accent-jargon-hi underline underline-offset-2 min-h-[44px] px-3 active:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60 shrink-0"
              >
                {regenerating ? 'picking…' : 'regenerate'}
              </button>
            </div>
          </Field>
        )}

        {/* 0. Domain (B+1.10) — which domain you're learning. */}
        <Field label="starting domain">
          <div className="flex flex-col gap-2">
            {ONBOARDING_DOMAIN_OPTIONS.map((opt) => {
              const live = isLiveDomainOption(opt);
              const selected = domainPick === opt.id;
              const iconState: 'soon' | 'selected' | 'available' = !live
                ? 'soon'
                : selected
                  ? 'selected'
                  : 'available';
              const url = onboardingIconUrl(opt, iconState);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => live && setDomainPick(opt.id)}
                  disabled={!live}
                  aria-pressed={selected}
                  className={[
                    'w-full text-left rounded-lg p-3 min-h-[64px]',
                    'flex items-center gap-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon',
                    !live
                      ? 'bg-surface-card border-border-default opacity-60 cursor-not-allowed'
                      : selected
                        ? 'bg-accent-jargon/[0.12] border-accent-jargon'
                        : 'bg-surface-card border-border-default active:bg-surface-card-hi',
                  ].join(' ')}
                >
                  <img src={url} alt="" width={24} height={24} className="shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${live ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-text-muted leading-snug mt-0.5 truncate">
                      {opt.tagline}
                    </p>
                    {!live && opt.soonNote && (
                      <p className="text-2xs uppercase tracking-wider text-accent-jargon-hi font-mono mt-1">
                        soon · {opt.soonNote}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        {/* 0.5. Goals freeform (B+1.10) — replaces the chip multi-select. */}
        <Field label="what brings you to jargon?" htmlFor="profile-goals">
          <textarea
            id="profile-goals"
            value={goalsFreeform}
            aria-label="what brings you to jargon? goals"
            onChange={(e) => {
              if (e.target.value.length <= MAX_GOALS_FREEFORM_CHARS) {
                setGoalsFreeform(e.target.value);
              }
            }}
            placeholder="say it however it lives in your head. the real reason."
            rows={3}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 resize-none"
          />
          <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
            {goalsFreeform.length} / {MAX_GOALS_FREEFORM_CHARS}
          </p>
        </Field>

        {/* 1. Education level */}
        <Field label="education">
          <div className="flex flex-wrap gap-2">
            {EDUCATION_OPTIONS.map((opt) => {
              const selected = education === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEducation(selected ? null : opt.value)}
                  aria-pressed={selected}
                  className={`min-h-[44px] px-3 rounded-md text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${
                    selected
                      ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                      : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* 2. Job */}
        {/* B+1.4-C decision: this Settings → edit-profile surface deliberately
            does NOT trigger the generate-job-followup Edge Function. The
            wizard is the discovery surface where richness is captured fresh
            (one screen, in flow); Settings is for editing what you already
            know — surfacing an in-place follow-up here would morph the form
            mid-edit, which is more disruptive than valuable. If a user wants
            to add specificity post-onboarding, they edit the job text
            directly (e.g. append " · hospital" themselves). Re-evaluate if
            traces show users routinely arriving here with under-specified
            job strings. */}
        <Field label="what do you do?" htmlFor="profile-job">
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            specifics matter — what kind of job, where, how long?
          </p>
          <textarea
            id="profile-job"
            value={job}
            aria-label="what do you do? job description"
            onChange={(e) => {
              if (e.target.value.length <= 240) setJob(e.target.value);
            }}
            placeholder="e.g. regional operations manager at a logistics company · ER nurse at a Level 1 trauma center · third-grade teacher at a Title 1 school · self-employed plumber doing residential remodels"
            rows={5}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 resize-none"
            autoComplete="off"
          />
        </Field>

        {/* 3. Interests */}
        <Field label="what are you into?" htmlFor="profile-interest-search">
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            the more specific the better — search 500+ interests or type your own.
          </p>
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => removeInterest(value)}
                  aria-label={`remove ${value}`}
                  className="min-h-[44px] px-3 rounded-md text-sm bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
                >
                  <span>{value}</span>
                  <span aria-hidden="true" className="text-text-secondary">×</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              id="profile-interest-search"
              type="text"
              value={interestInput}
              aria-label="search or type your own interest"
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={handleInterestKeyDown}
              placeholder="search or type your own"
              className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 min-h-[44px]"
              maxLength={60}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
            {interestInput.trim().length > 0 && interestSuggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label="interest suggestions"
                // Inline max-height keeps the dropdown to ~6.5 visible rows
                // (44pt each + a hint of the next row peeking) at 390×844.
                className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-card border border-border-default rounded-lg overflow-y-auto max-h-[286px] shadow-lg"
              >
                {interestSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      // onMouseDown (not onClick) so the input doesn't blur
                      // before the tap registers; iOS taps still fire it.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addInterest(s);
                      }}
                      className="w-full text-left min-h-[44px] px-3 py-2 text-base text-text-primary active:bg-surface-card-hi border-b border-border-default last:border-b-0"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        {/* 4. Heritage (B+1.2) */}
        <Field label="where are you from?" htmlFor="profile-heritage">
          <input
            id="profile-heritage"
            type="text"
            value={heritage}
            aria-label="where are you from? heritage"
            onChange={(e) => setHeritage(e.target.value)}
            placeholder="e.g. Glasgow, Scotland · Denver, CO · Mexico → Texas"
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 min-h-[44px]"
            maxLength={MAX_HERITAGE_CHARS}
            autoComplete="off"
          />
          <p className="text-xs text-text-muted mt-2">
            country, region, city — wherever shaped you.
          </p>
        </Field>

        {/* 5. Roles (B+1.2) */}
        <Field label="any roles that define you?">
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((opt) => {
              const selected = roles.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleRole(opt)}
                  aria-pressed={selected}
                  className={`min-h-[44px] px-3 rounded-md text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${
                    selected
                      ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                      : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </Field>

        {/* 6. Background */}
        <Field label="anything else?" htmlFor="profile-background">
          <textarea
            id="profile-background"
            value={background}
            aria-label="anything else? background details"
            onChange={(e) => {
              if (e.target.value.length <= MAX_BACKGROUND_CHARS) {
                setBackground(e.target.value);
              }
            }}
            placeholder="where you grew up, hobbies, weird trivia — the more specific the better"
            rows={3}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 resize-none"
          />
          <p className="text-xs text-text-muted mt-2 font-mono tabular-nums text-right">
            {background.length} / {MAX_BACKGROUND_CHARS}
          </p>
        </Field>
      </div>

      <div className="mt-12 flex flex-col items-center gap-4 pb-8">
        {hint && <p role="status" aria-live="polite" className="text-xs text-accent-jargon-hi text-center">{hint}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60"
        >
          {busy ? 'saving…' : saveLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-4 active:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps) {
  if (htmlFor) {
    return (
      <section>
        <label
          htmlFor={htmlFor}
          className="text-xs uppercase tracking-wider text-text-muted mb-3 block"
        >
          {label}
        </label>
        {children}
      </section>
    );
  }
  return (
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <legend className="text-xs uppercase tracking-wider text-text-muted mb-3 block p-0">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}
