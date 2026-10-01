import type {
  WitnessChatMessage,
  WitnessChatViewer,
} from "@/lib/witness-chat/types";

export function senderKey(message: Pick<
  WitnessChatMessage,
  "senderType" | "senderUserId" | "senderName"
>) {
  if (message.senderType === "witness") return "witness";
  return `firm:${message.senderUserId ?? message.senderName}`;
}

export function isOwnMessage(
  message: Pick<WitnessChatMessage, "senderType" | "senderUserId">,
  viewer: WitnessChatViewer,
  viewerUserId: string | null,
) {
  if (viewer === "witness") return message.senderType === "witness";
  return (
    message.senderType === "firm" && message.senderUserId === viewerUserId
  );
}

export function deliveryForMessage(
  message: Pick<WitnessChatMessage, "senderType" | "senderUserId" | "createdAt" | "pending">,
  viewer: WitnessChatViewer,
  viewerUserId: string | null,
  witnessLastReadAt: string | null,
  firmLastReadAt: string | null,
): "sent" | "read" | null {
  if (message.pending || !isOwnMessage(message, viewer, viewerUserId)) {
    return null;
  }
  const cursor = viewer === "witness" ? firmLastReadAt : witnessLastReadAt;
  if (
    cursor &&
    new Date(cursor).getTime() >= new Date(message.createdAt).getTime()
  ) {
    return "read";
  }
  return "sent";
}

export type PresentedWitnessMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  senderName: string | null;
  delivery: "sent" | "read" | null;
  plain: true;
  meta: { attachedFiles: WitnessChatMessage["attachments"] };
};

export function presentWitnessMessages(input: {
  messages: WitnessChatMessage[];
  viewer: WitnessChatViewer;
  viewerUserId: string | null;
  witnessLastReadAt: string | null;
  firmLastReadAt: string | null;
}): PresentedWitnessMessage[] {
  return input.messages.map((message, index) => {
    const key = senderKey(message);
    const previous = input.messages[index - 1];
    const next = input.messages[index + 1];
    const showName = !previous || senderKey(previous) !== key;
    const lastOfRun = !next || senderKey(next) !== key;
    const own = isOwnMessage(message, input.viewer, input.viewerUserId);
    return {
      id: message.id,
      role: own ? "user" : "assistant",
      content: message.body,
      senderName: showName ? message.senderName : null,
      delivery: lastOfRun
        ? deliveryForMessage(
            message,
            input.viewer,
            input.viewerUserId,
            input.witnessLastReadAt,
            input.firmLastReadAt,
          )
        : null,
      plain: true,
      meta: { attachedFiles: message.attachments },
    };
  });
}
