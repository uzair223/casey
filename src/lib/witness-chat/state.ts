export const WITNESS_PRESENT_MS = 45_000;
export const WITNESS_RECENT_REPLY_MS = 2 * 60_000;
export const CHAT_COALESCE_MS = 3 * 60_000;
export const REMINDER_24H_MS = 24 * 60 * 60 * 1000;
export const REMINDER_72H_MS = 72 * 60 * 60 * 1000;
export const DEADLINE_DEDUPE_MS = 60 * 60 * 1000;
export const DEADLINE_SKIP_WINDOW_MS = 6 * 60 * 60 * 1000;

export type ThreadNotifyState = {
  witnessLastSeenAt: string | null;
  witnessLastMessageAt: string | null;
  unreadFirmSince: string | null;
  notifyAfter: string | null;
  lastOutreachAt: string | null;
  outreachAnchorAt: string | null;
  reminderStage: number;
  nextReminderAt: string | null;
  firmLastSeenAt: string | null;
  firmUnreadSince: string | null;
  firmNotifyAfter: string | null;
  firmLastNotifiedAt: string | null;
};

export function isRecent(
  timestamp: string | null,
  nowMs: number,
  windowMs: number,
) {
  if (!timestamp) return false;
  return nowMs - new Date(timestamp).getTime() < windowMs;
}

export function witnessIsEngaged(state: ThreadNotifyState, nowMs: number) {
  return (
    isRecent(state.witnessLastSeenAt, nowMs, WITNESS_PRESENT_MS) ||
    isRecent(state.witnessLastMessageAt, nowMs, WITNESS_RECENT_REPLY_MS)
  );
}

export function firmIsPresent(state: ThreadNotifyState, nowMs: number) {
  return isRecent(state.firmLastSeenAt, nowMs, WITNESS_PRESENT_MS);
}

export function burstAlreadySent(
  unreadSince: string | null,
  notifiedAt: string | null,
) {
  if (!unreadSince || !notifiedAt) return false;
  return new Date(notifiedAt).getTime() >= new Date(unreadSince).getTime();
}

function coalesceAt(unreadSince: string) {
  return new Date(
    new Date(unreadSince).getTime() + CHAT_COALESCE_MS,
  ).toISOString();
}

export function onFirmMessage(
  state: ThreadNotifyState,
  nowMs: number,
  messageAt: string,
): ThreadNotifyState {
  const unreadFirmSince = state.unreadFirmSince ?? messageAt;
  const next: ThreadNotifyState = {
    ...state,
    unreadFirmSince,
  };
  if (burstAlreadySent(unreadFirmSince, state.lastOutreachAt)) {
    return next;
  }
  if (witnessIsEngaged(next, nowMs)) {
    return { ...next, notifyAfter: null };
  }
  return {
    ...next,
    notifyAfter: state.notifyAfter ?? coalesceAt(unreadFirmSince),
  };
}

export function onWitnessPresence(
  state: ThreadNotifyState,
  nowIso: string,
): ThreadNotifyState {
  return {
    ...state,
    witnessLastSeenAt: nowIso,
    notifyAfter: null,
  };
}

export function clearWitnessChase(
  state: ThreadNotifyState,
  nowIso: string,
): ThreadNotifyState {
  return {
    ...state,
    witnessLastSeenAt: nowIso,
    witnessLastMessageAt: nowIso,
    unreadFirmSince: null,
    notifyAfter: null,
    outreachAnchorAt: null,
    reminderStage: 0,
    nextReminderAt: null,
  };
}

export function onWitnessRead(
  state: ThreadNotifyState,
  nowIso: string,
): ThreadNotifyState {
  return {
    ...clearWitnessChase(state, nowIso),
    witnessLastMessageAt: state.witnessLastMessageAt,
  };
}

export function onWitnessMessage(
  state: ThreadNotifyState,
  nowMs: number,
  nowIso: string,
): ThreadNotifyState {
  const cleared = clearWitnessChase(state, nowIso);
  const firmUnreadSince = state.firmUnreadSince ?? nowIso;
  const withUnread: ThreadNotifyState = {
    ...cleared,
    firmUnreadSince,
  };
  if (burstAlreadySent(firmUnreadSince, state.firmLastNotifiedAt)) {
    return withUnread;
  }
  if (firmIsPresent(state, nowMs)) {
    return { ...withUnread, firmNotifyAfter: null };
  }
  return {
    ...withUnread,
    firmNotifyAfter: state.firmNotifyAfter ?? coalesceAt(firmUnreadSince),
  };
}

export function onFirmPresence(
  state: ThreadNotifyState,
  nowIso: string,
): ThreadNotifyState {
  return {
    ...state,
    firmLastSeenAt: nowIso,
    firmNotifyAfter: null,
  };
}

export function onFirmCaughtUp(state: ThreadNotifyState): ThreadNotifyState {
  return {
    ...state,
    firmUnreadSince: null,
    firmNotifyAfter: null,
  };
}

export function armWitnessNotify(
  state: ThreadNotifyState,
  nowMs: number,
): ThreadNotifyState {
  if (!state.unreadFirmSince || state.notifyAfter) return state;
  if (burstAlreadySent(state.unreadFirmSince, state.lastOutreachAt)) {
    return state;
  }
  if (witnessIsEngaged(state, nowMs)) return state;
  return { ...state, notifyAfter: coalesceAt(state.unreadFirmSince) };
}

export function armFirmNotify(
  state: ThreadNotifyState,
  nowMs: number,
): ThreadNotifyState {
  if (!state.firmUnreadSince || state.firmNotifyAfter) return state;
  if (burstAlreadySent(state.firmUnreadSince, state.firmLastNotifiedAt)) {
    return state;
  }
  if (firmIsPresent(state, nowMs)) return state;
  return { ...state, firmNotifyAfter: coalesceAt(state.firmUnreadSince) };
}

export function excerpt(text: string, max = 240) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatTypingLabel(names: string[]) {
  const unique = names.filter(Boolean);
  if (unique.length === 0) return null;
  if (unique.length === 1) return `${unique[0]} is typing`;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]} are typing`;
  return `${unique[0]} and ${unique.length - 1} others are typing`;
}
