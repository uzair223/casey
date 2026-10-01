import { describe, expect, it } from "vitest";

import { presentWitnessMessages } from "@/lib/witness-chat/presentation";
import { smsReadyAt } from "@/lib/witness-chat/quiet-hours";
import {
  CHAT_COALESCE_MS,
  armWitnessNotify,
  formatTypingLabel,
  onFirmMessage,
  onWitnessMessage,
  onWitnessPresence,
  onWitnessRead,
  type ThreadNotifyState,
} from "@/lib/witness-chat/state";

const baseState = (): ThreadNotifyState => ({
  witnessLastSeenAt: null,
  witnessLastMessageAt: null,
  unreadFirmSince: null,
  notifyAfter: null,
  lastOutreachAt: null,
  outreachAnchorAt: null,
  reminderStage: 0,
  nextReminderAt: null,
  firmLastSeenAt: null,
  firmUnreadSince: null,
  firmNotifyAfter: null,
  firmLastNotifiedAt: null,
});

describe("witness chat notifications", () => {
  it("arms one notice three minutes after the first unread firm message", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const messageAt = new Date(now).toISOString();
    const next = onFirmMessage(baseState(), now, messageAt);
    expect(next.unreadFirmSince).toBe(messageAt);
    expect(next.notifyAfter).toBe(
      new Date(now + CHAT_COALESCE_MS).toISOString(),
    );

    const second = onFirmMessage(
      next,
      now + 30_000,
      new Date(now + 30_000).toISOString(),
    );
    expect(second.notifyAfter).toBe(next.notifyAfter);
    expect(second.unreadFirmSince).toBe(messageAt);
  });

  it("does not arm a notice while the witness is in the chat", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const present = {
      ...baseState(),
      witnessLastSeenAt: new Date(now - 10_000).toISOString(),
    };
    const next = onFirmMessage(present, now, new Date(now).toISOString());
    expect(next.notifyAfter).toBeNull();
    expect(next.unreadFirmSince).not.toBeNull();
  });

  it("cancels a pending notice when the witness opens the chat", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const armed = onFirmMessage(baseState(), now, new Date(now).toISOString());
    const opened = onWitnessPresence(armed, new Date(now + 20_000).toISOString());
    expect(opened.notifyAfter).toBeNull();
    expect(opened.unreadFirmSince).toBe(armed.unreadFirmSince);
  });

  it("re-arms after the witness leaves without reading", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const armed = onFirmMessage(baseState(), now, new Date(now).toISOString());
    const opened = onWitnessPresence(armed, new Date(now).toISOString());
    const away = {
      ...opened,
      witnessLastSeenAt: new Date(now - 5 * 60_000).toISOString(),
    };
    const rearmed = armWitnessNotify(away, now + 5 * 60_000);
    expect(rearmed.notifyAfter).toBe(armed.notifyAfter);
  });

  it("does not notify again for the same unread burst", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const messageAt = new Date(now).toISOString();
    const sent = {
      ...onFirmMessage(baseState(), now, messageAt),
      notifyAfter: null,
      lastOutreachAt: new Date(now + CHAT_COALESCE_MS).toISOString(),
    };
    const again = onFirmMessage(
      sent,
      now + 10 * 60_000,
      new Date(now + 10 * 60_000).toISOString(),
    );
    expect(again.notifyAfter).toBeNull();
    expect(again.unreadFirmSince).toBe(messageAt);
  });

  it("clears reminders when the witness reads or replies", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    const waiting = {
      ...onFirmMessage(baseState(), now, new Date(now).toISOString()),
      outreachAnchorAt: new Date(now).toISOString(),
      nextReminderAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      reminderStage: 0,
    };
    const read = onWitnessRead(waiting, new Date(now).toISOString());
    expect(read.unreadFirmSince).toBeNull();
    expect(read.nextReminderAt).toBeNull();
    expect(read.outreachAnchorAt).toBeNull();

    const replied = onWitnessMessage(
      waiting,
      now,
      new Date(now).toISOString(),
    );
    expect(replied.unreadFirmSince).toBeNull();
    expect(replied.firmUnreadSince).toBe(new Date(now).toISOString());
    expect(replied.firmNotifyAfter).not.toBeNull();
  });

  it("holds SMS outside London quiet hours and sends inside them", () => {
    const evening = smsReadyAt(new Date("2026-09-30T19:30:00.000Z"));
    expect(evening.toISOString()).toBe("2026-10-01T07:00:00.000Z");

    const afternoon = smsReadyAt(new Date("2026-09-30T14:00:00.000Z"));
    expect(afternoon.toISOString()).toBe("2026-09-30T14:00:00.000Z");
  });

  it("shows a sender name only on the first message of a run and status on the last", () => {
    const messages = presentWitnessMessages({
      viewer: "firm",
      viewerUserId: "solicitor-1",
      witnessLastReadAt: "2026-09-30T12:05:00.000Z",
      firmLastReadAt: null,
      messages: [
        {
          id: "1",
          senderType: "firm",
          senderUserId: "solicitor-1",
          senderName: "Alex",
          body: "First",
          attachments: [],
          createdAt: "2026-09-30T12:00:00.000Z",
          clientId: null,
        },
        {
          id: "2",
          senderType: "firm",
          senderUserId: "solicitor-1",
          senderName: "Alex",
          body: "Second",
          attachments: [],
          createdAt: "2026-09-30T12:01:00.000Z",
          clientId: null,
        },
        {
          id: "3",
          senderType: "witness",
          senderUserId: null,
          senderName: "Casey",
          body: "Reply",
          attachments: [],
          createdAt: "2026-09-30T12:02:00.000Z",
          clientId: null,
        },
      ],
    });

    expect(messages.map((message) => message.senderName)).toEqual([
      "Alex",
      null,
      "Casey",
    ]);
    expect(messages.map((message) => message.delivery)).toEqual([
      null,
      "read",
      null,
    ]);
    expect(messages[0]?.role).toBe("user");
    expect(messages[2]?.role).toBe("assistant");
  });

  it("names one typer, two typers, and a larger group", () => {
    expect(formatTypingLabel(["Alex"])).toBe("Alex is typing");
    expect(formatTypingLabel(["Alex", "Jordan"])).toBe(
      "Alex and Jordan are typing",
    );
    expect(formatTypingLabel(["Alex", "Jordan", "Sam"])).toBe(
      "Alex and 2 others are typing",
    );
  });
});
