import type { UploadedDocument } from "@/types";

export type WitnessChatViewer = "firm" | "witness";

export type WitnessChatFileRequest = {
  id: string;
  messageId: string;
  label: string;
  dueAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type WitnessChatMessage = {
  id: string;
  senderType: "witness" | "firm";
  senderUserId: string | null;
  senderName: string;
  body: string;
  attachments: UploadedDocument[];
  createdAt: string;
  clientId: string | null;
  pending?: boolean;
};

export type WitnessChatSnapshot = {
  threadId: string;
  realtimeChannel: string;
  caseId: string;
  caseTitle: string;
  statementId: string;
  witnessName: string;
  messages: WitnessChatMessage[];
  fileRequests: WitnessChatFileRequest[];
  witnessLastReadAt: string | null;
  firmLastReadAt: string | null;
  viewer: WitnessChatViewer;
  viewerUserId: string | null;
};

export type WitnessChatPost = {
  body: string;
  clientId: string | null;
  attachments: UploadedDocument[];
  fileRequest: { label: string; dueAt: string | null } | null;
  fileRequestId: string | null;
};
