import { describe, expect, it } from "vitest";

import { formatAuditTimelineEvent } from "@/lib/audit/format-activity";
import { assigneesToNotify } from "@/lib/notifications/note-assignees";

describe("formatAuditTimelineEvent", () => {
  it("hides case_notes.insert because the note timeline already covers it", () => {
    expect(
      formatAuditTimelineEvent({
        action: "case_notes.insert",
        metadata: {
          message: "Created new case_notes record",
        },
      }),
    ).toBeNull();
  });

  it("hides snapshot-id-only statement updates", () => {
    expect(
      formatAuditTimelineEvent({
        action: "statements.update",
        metadata: {
          field_changes: [
            {
              field: "config_snapshot_id",
              old: null,
              new: "9c0d0b0a-1111-4111-8111-aaaaaaaaaaaa",
            },
          ],
          message:
            'Updated fields: config_snapshot_id: NULL → "9c0d0b0a-1111-4111-8111-aaaaaaaaaaaa"',
        },
      }),
    ).toBeNull();
  });

  it("maps a statement status change to a human title", () => {
    expect(
      formatAuditTimelineEvent({
        action: "statements.update",
        metadata: {
          field_changes: [
            { field: "status", old: "draft", new: "submitted" },
            {
              field: "config_snapshot_id",
              old: null,
              new: "9c0d0b0a-1111-4111-8111-aaaaaaaaaaaa",
            },
          ],
        },
      }),
    ).toEqual({
      title: "Witness submitted their statement",
      description: "",
    });
  });

  it("maps a case rename without dumping ids", () => {
    expect(
      formatAuditTimelineEvent({
        action: "cases.update",
        metadata: {
          field_changes: [
            { field: "title", old: "Old title", new: "Road traffic accident" },
          ],
        },
      }),
    ).toEqual({
      title: "Case renamed",
      description: "Road traffic accident",
    });
  });

  it("maps invite.email.sent to a solicitor-facing sentence", () => {
    expect(
      formatAuditTimelineEvent({
        action: "invite.email.sent",
        metadata: { email: "alex@firm.test" },
      }),
    ).toEqual({
      title: "Invite sent",
      description: "Invite sent to alex@firm.test",
    });
  });

  it("maps case opened and hides chat token noise", () => {
    expect(
      formatAuditTimelineEvent({
        action: "cases.insert",
        metadata: { new: { title: "Northgate claim" } },
      }),
    ).toEqual({
      title: "Case opened",
      description: "Northgate claim",
    });

    expect(
      formatAuditTimelineEvent({
        action: "magic_links.update",
        metadata: { message: "Updated magic_links record" },
      }),
    ).toBeNull();
  });

  it("hides product_feedback inserts from solicitor timelines", () => {
    expect(
      formatAuditTimelineEvent({
        action: "product_feedback.insert",
        metadata: { message: "Created new product_feedback record" },
      }),
    ).toBeNull();
  });
});

describe("assigneesToNotify", () => {
  it("skips the author and mentioned assignees", () => {
    expect(
      assigneesToNotify({
        assignedUserIds: ["author", "mentioned", "other"],
        mentionedUserIds: ["mentioned"],
        authorUserId: "author",
      }),
    ).toEqual(["other"]);
  });
});
