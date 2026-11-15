import { create } from 'zustand';

// How many feedback replies or questions are waiting for the learner. The
// floating feedback button (phones) and the desktop app bar both show it, so
// the count lives here instead of inside one of them.
interface FeedbackUnreadState {
  unread: number;
  setUnread: (unread: number) => void;
}

export const useFeedbackUnread = create<FeedbackUnreadState>((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
}));

/** The accessible name both feedback buttons use. */
export function feedbackButtonLabel(unread: number, idle: string): string {
  return unread > 0 ? `field notes, ${unread} waiting` : idle;
}
