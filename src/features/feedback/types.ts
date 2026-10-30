export const FEEDBACK_CATEGORIES = [
  { value: 'confusing', label: 'confusing' },
  { value: 'broken', label: 'broken' },
  { value: 'feature-ask', label: 'feature ask' },
  { value: 'question', label: 'question' },
  { value: 'idea', label: 'idea' },
  { value: 'other', label: 'other' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];
export type FeedbackKind = 'submission' | 'question';

export interface FeedbackContext {
  pathname: string;
  url?: string;
  viewport?: string;
  userAgent?: string;
  [key: string]: string | undefined;
}
export interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  category: FeedbackCategory;
  message: string;
  prompt_label: string | null;
  author_user_id: string;
  asked_user_id: string | null;
  answer: string | null;
  answered_at: string | null;
  owner_reply: string | null;
  owner_replied_at: string | null;
  resulted_in: string | null;
  resulted_in_at: string | null;
  acknowledged_at: string | null;
  screenshot_data: string | null;
  screen: string | null;
  context: FeedbackContext;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface PilotUser {
  user_id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'pilot';
}

export interface FeedbackDraft {
  category: FeedbackCategory;
  message: string;
  includeScreenshot: boolean;
  includeContext: boolean;
  screenshotData: string | null;
  screen: string;
  context: FeedbackContext;
}
