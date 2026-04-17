import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import {
  SERVERONLY_getStatementWithConfigFromToken,
  getConversationHistory,
} from "@/lib/supabase/queries";
import {
  SERVERONLY_saveConversationMessage,
  uploadFile,
} from "@/lib/supabase/mutations";

function getLatestFollowUpRequest(
  messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
    meta: unknown;
  }>,
) {
  return [...messages].reverse().find((message) => {
    const meta =
      message.meta && typeof message.meta === "object"
        ? (message.meta as Record<string, unknown>)
        : null;
    return message.role === "assistant" && meta?.followUpRequest === true;
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    const history = await getConversationHistory(statement.id);
    const followUp = getLatestFollowUpRequest(history);

    if (!followUp) {
      return NextResponse.json({
        caseTitle: statement.title,
        witnessName: statement.witness_name,
        followUpRequest: null,
        responses: [],
      });
    }

    const followUpTimestamp = new Date(followUp.created_at).getTime();
    const responses = history.filter((message) => {
      if (message.role !== "user") {
        return false;
      }

      if (!message.content?.trim()) {
        return false;
      }

      const ts = new Date(message.created_at).getTime();
      return ts > followUpTimestamp;
    });

    return NextResponse.json({
      caseTitle: statement.title,
      witnessName: statement.witness_name,
      followUpRequest: {
        id: followUp.id,
        message: followUp.content,
        createdAt: followUp.created_at,
      },
      responses: responses.map((response) => ({
        id: response.id,
        message: response.content,
        createdAt: response.created_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load follow-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    let response = "";
    const uploadedDocuments: Array<{
      name: string;
      path: string;
      bucketId: string;
      type: string;
    }> = [];

    // Parse either FormData or JSON
    const contentType = request.headers.get("content-type");
    if (
      contentType?.includes("application/x-www-form-urlencoded") ||
      contentType?.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      response = (formData.get("response") as string)?.trim() || "";

      // Process uploaded files
      const fileEntries = Array.from(formData.entries()).filter(([key]) =>
        key.startsWith("file_"),
      );

      if (fileEntries.length > 0) {
        const basePath = `statements/${statement.case_id}/${statement.id}/follow-up`;

        for (const [, fileData] of fileEntries) {
          if (fileData instanceof File) {
            const uploadedDoc = await uploadFile({
              bucketId: statement.tenant_id,
              name: fileData.name,
              path: `${basePath}/${new Date().toISOString()} ${fileData.name}`,
              file: fileData,
              contentType: fileData.type || "application/octet-stream",
            });

            uploadedDocuments.push({
              name: uploadedDoc.name,
              path: uploadedDoc.path,
              bucketId: statement.tenant_id,
              type: uploadedDoc.type,
            });
          }
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      response = typeof body?.response === "string" ? body.response.trim() : "";
    }

    if (!response && uploadedDocuments.length === 0) {
      return NextResponse.json(
        { error: "Response or file upload is required" },
        { status: 400 },
      );
    }

    if (response.length > 5000) {
      return NextResponse.json(
        { error: "Response must be 5000 characters or less" },
        { status: 400 },
      );
    }

    const messageContent =
      response || "[Files submitted without text response]";

    await SERVERONLY_saveConversationMessage(
      statement.id,
      "user",
      messageContent,
      {
        followUpResponse: true,
        submittedAt: new Date().toISOString(),
        uploadedDocuments:
          uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save follow-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
