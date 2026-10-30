import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type {
  FeedbackDraft,
  FeedbackRow,
  PilotUser,
} from './types';
import {
  loadFeedbackQueue,
  saveFeedbackQueue,
} from './storage';

function currentContext(draft: FeedbackDraft) {
  return draft.includeContext ? draft.context : {};
}

export async function submitProductFeedback(userId: string, draft: FeedbackDraft) {
  const { data, error } = await supabase
    .from('product_feedback')
    .insert({
      kind: 'submission',
      category: draft.category,
      message: draft.message.trim(),
      author_user_id: userId,
      screenshot_data: draft.includeScreenshot ? draft.screenshotData : null,
      screen: draft.includeContext ? draft.screen : null,
      context: currentContext(draft),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as FeedbackRow;
}

export async function flushFeedbackQueue(userId: string) {
  const queue = loadFeedbackQueue(userId);
  if (queue.length === 0) return 0;
  const remaining: FeedbackDraft[] = [];
  let sent = 0;
  for (const draft of queue) {
    try {
      await submitProductFeedback(userId, draft);
      sent += 1;
    } catch {
      remaining.push(draft);
    }
  }
  saveFeedbackQueue(userId, remaining);
  return sent;
}

export async function listProductFeedback() {
  const { data, error } = await supabase
    .from('product_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []) as FeedbackRow[];
}

export async function isJargonOwner() {
  const { data, error } = await supabase.rpc('is_jargon_owner');
  if (error) throw error;
  return data === true;
}

export async function listJargonPilots() {
  const { data, error } = await supabase.rpc('list_jargon_pilots');
  if (error) throw error;
  return (data ?? []) as PilotUser[];
}

export async function answerProductFeedback(feedbackId: string, answer: string) {
  const { data, error } = await supabase.rpc('answer_product_feedback', {
    p_feedback_id: feedbackId,
    p_answer: answer,
  });
  if (error) throw error;
  return data as FeedbackRow;
}

export async function acknowledgeProductFeedback(feedbackId: string) {
  const { error } = await supabase.rpc('acknowledge_product_feedback', {
    p_feedback_id: feedbackId,
  });
  if (error) throw error;
}

export async function replyToProductFeedback(
  feedbackId: string,
  reply: string,
  resultedIn: string,
  close: boolean,
) {
  const { data, error } = await supabase.rpc('reply_to_product_feedback', {
    p_feedback_id: feedbackId,
    p_reply: reply,
    p_resulted_in: resultedIn || null,
    p_close: close,
  });
  if (error) throw error;
  return data as FeedbackRow;
}

export async function askJargonPilot(
  userId: string,
  message: string,
  label: string,
) {
  const { data, error } = await supabase.rpc('ask_jargon_pilot', {
    p_asked_user_id: userId,
    p_message: message,
    p_prompt_label: label || null,
  });
  if (error) throw error;
  return data as FeedbackRow;
}

export function subscribeToProductFeedback(onChange: () => void): RealtimeChannel {
  if (import.meta.env.VITE_FEEDBACK_REALTIME_ENABLED === 'false') {
    return {
      unsubscribe: async () => 'ok',
    } as unknown as RealtimeChannel;
  }
  return supabase
    .channel(`jargon-product-feedback-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_feedback' },
      onChange,
    )
    .subscribe();
}
