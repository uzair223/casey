import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { requireUser } from "@/lib/api-utils/auth";
import { badRequest } from "@/lib/api-utils/response";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/observability/logger";
import { getOpenRouterClientOptions } from "@/lib/utils";
import { DocxReviewer } from "@eigenpal/docx-editor-agents";
import { zodResponseFormat } from "openai/helpers/zod.mjs";

const client = new OpenAI(getOpenRouterClientOptions());

const RequestBodySchema = z.object({
  bufferBase64: z.string().min(1, "bufferBase64 is required"),
  reviewGoal: z
    .string()
    .optional()
    .default(
      "Review and improve the clarity, consistency, and professionalism of this document.",
    ),
});

const ReviewResponseSchema = z.object({
  generatedResponse: z
    .string()
    .describe(
      "A concise, user-facing review summary collated from the comments and proposals in this response.",
    ),
  comments: z
    .array(
      z.object({
        paragraphIndex: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Paragraph index to target, based on the [index] prefix in document content",
          ),
        text: z.string().describe("The comment text suggesting an improvement"),
        rangeStart: z
          .number()
          .describe("Character index where the comment applies (0-based)"),
        rangeEnd: z.number().describe("Character index where the comment ends"),
      }),
    )
    .describe("Comments suggesting improvements without changes"),
  proposals: z.array(
    z
      .object({
        paragraphIndex: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Paragraph index to target, based on the [index] prefix in document content",
          ),
        oldText: z.string().describe("The original text to replace"),
        newText: z.string().describe("The improved replacement text"),
        rangeStart: z
          .number()
          .describe("Character index of the text to replace (0-based)"),
        rangeEnd: z.number().describe("Character index where the text ends"),
      })
      .describe("Proposed text replacements"),
  ),
});

function buildParagraphStartOffsets(text: string): number[] {
  const lines = text.split(/\r?\n/);
  const offsets: number[] = [];
  let cursor = 0;

  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  return offsets.length > 0 ? offsets : [0];
}

function paragraphIndexFromOffset(
  offset: number,
  paragraphStarts: number[],
): number {
  if (paragraphStarts.length === 0) {
    return 0;
  }

  const safeOffset = Math.max(0, offset);
  let index = 0;

  for (let i = 0; i < paragraphStarts.length; i++) {
    if (paragraphStarts[i] <= safeOffset) {
      index = i;
      continue;
    }
    break;
  }

  return Math.min(index, paragraphStarts.length - 1);
}

function extractIndexedParagraphIds(text: string): number[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d+)\]/);
      if (!match) return null;
      return Number.parseInt(match[1], 10);
    })
    .filter((value): value is number => Number.isInteger(value));
}

function clampToKnownParagraph(
  candidate: number,
  knownParagraphIds: number[],
): number {
  if (knownParagraphIds.length === 0) {
    return Math.max(0, candidate);
  }

  if (knownParagraphIds.includes(candidate)) {
    return candidate;
  }

  const min = Math.min(...knownParagraphIds);
  const max = Math.max(...knownParagraphIds);
  return Math.min(Math.max(candidate, min), max);
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  if (!env.OPENROUTER_API_KEY) {
    await logServerEvent("error", "api.generate.docx_review.misconfigured", {
      requestId,
      reason: "missing_openrouter_api_key",
    });
    return NextResponse.json(
      {
        error: "OpenRouter API key not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const auth = await requireUser(request);
    const rawBody = await request.json().catch(() => null);
    const body = RequestBodySchema.safeParse(rawBody);

    if (!body.success) {
      return badRequest(
        body.error.issues.map((el) => `${el.path}: ${el.message}`).join("\n") ??
          "Invalid payload",
      );
    }

    const { bufferBase64, reviewGoal } = body.data;

    // Decode base64 buffer
    let buffer: Uint8Array;
    try {
      const binaryString = Buffer.from(bufferBase64, "base64").toString(
        "binary",
      );
      buffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
      }
    } catch {
      await logServerEvent("error", "api.generate.docx_review.invalid_buffer", {
        requestId,
        userId: auth.userId,
      });
      return badRequest("Invalid DOCX buffer provided");
    }

    let reviewer: InstanceType<typeof DocxReviewer>;
    let documentText: string;

    try {
      // Convert Uint8Array to ArrayBuffer for DocxReviewer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      reviewer = await DocxReviewer.fromBuffer(arrayBuffer, "AI Reviewer");
      documentText = reviewer.getContentAsText();
    } catch (error) {
      await logServerEvent("error", "api.generate.docx_review.parse_failed", {
        requestId,
        userId: auth.userId,
        error,
      });
      return NextResponse.json(
        { error: "Failed to parse DOCX buffer" },
        { status: 400 },
      );
    }

    const selectedModel = env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

    await logServerEvent("info", "api.generate.docx_review.request", {
      requestId,
      model: selectedModel,
      userId: auth.userId,
      documentLength: documentText.length,
    });

    let reviewResponse: z.output<typeof ReviewResponseSchema>;

    try {
      const completion = await client.chat.completions.create({
        model: selectedModel,
        temperature: 0.2,
        stream: false,
        response_format: zodResponseFormat(ReviewResponseSchema, "docx_review"),
        messages: [
          {
            role: "system",
            content:
              "You are a professional document reviewer. Review the provided DOCX document and suggest improvements. Return comments for suggestions without changes, and proposals for concrete text replacements. Focus on clarity, consistency, professionalism, and legal accuracy. Every comment and proposal MUST include paragraphIndex that matches the [index] prefix in the provided document content. Also return generatedResponse: a concise conversational summary collated from the comments and proposals you return. Do not invent items not present in comments/proposals.",
          },
          {
            role: "user",
            content: `Review this DOCX document according to the following goal: ${reviewGoal}\n\nDocument content:\n${documentText}`,
          },
        ],
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response content from LLM");
      }

      reviewResponse = ReviewResponseSchema.parse(JSON.parse(responseContent));
    } catch (error) {
      await logServerEvent(
        "error",
        "api.generate.docx_review.model_call_failed",
        {
          requestId,
          model: selectedModel,
          error,
        },
      );
      return NextResponse.json(
        { error: "Failed to review document" },
        { status: 500 },
      );
    }

    const paragraphStarts = buildParagraphStartOffsets(documentText);
    const knownParagraphIds = extractIndexedParagraphIds(documentText);

    const commentsToApply = reviewResponse.comments
      .map((comment) => ({
        paragraphIndex: clampToKnownParagraph(
          comment.paragraphIndex ??
            paragraphIndexFromOffset(comment.rangeStart, paragraphStarts),
          knownParagraphIds,
        ),
        text: comment.text,
      }))
      .filter((comment) => comment.text.trim().length > 0);

    const proposalsToApply = reviewResponse.proposals
      .map((proposal) => ({
        paragraphIndex: clampToKnownParagraph(
          proposal.paragraphIndex ??
            paragraphIndexFromOffset(proposal.rangeStart, paragraphStarts),
          knownParagraphIds,
        ),
        search: proposal.oldText,
        replaceWith: proposal.newText,
      }))
      .filter(
        (proposal) =>
          proposal.search.trim().length > 0 &&
          proposal.replaceWith.trim().length > 0,
      );

    let reviewedBuffer = buffer;

    try {
      reviewer.applyReview({
        comments: commentsToApply,
        proposals: proposalsToApply,
      });

      const reviewedArrayBuffer = await reviewer.toBuffer();
      reviewedBuffer = new Uint8Array(reviewedArrayBuffer);
    } catch (error) {
      await logServerEvent("error", "api.generate.docx_review.apply_failed", {
        requestId,
        userId: auth.userId,
        error,
      });
      return NextResponse.json(
        { error: "Failed to apply review changes to document" },
        { status: 500 },
      );
    }

    // Convert buffer back to base64 for response
    const reviewedBase64 = Buffer.from(reviewedBuffer).toString("base64");

    await logServerEvent("info", "api.generate.docx_review.success", {
      requestId,
      userId: auth.userId,
      commentsCount: reviewResponse.comments.length,
      proposalsCount: reviewResponse.proposals.length,
      commentsApplied: commentsToApply.length,
      proposalsApplied: proposalsToApply.length,
    });

    return NextResponse.json(
      {
        bufferBase64: reviewedBase64,
        summary: {
          commentsCount: reviewResponse.comments.length,
          proposalsCount: reviewResponse.proposals.length,
          generatedResponse: reviewResponse.generatedResponse,
          comments: reviewResponse.comments.slice(0, 5), // Return first 5 for UI display
          proposals: reviewResponse.proposals.slice(0, 5), // Return first 5 for UI display
        },
      },
      { status: 200 },
    );
  } catch (error) {
    await logServerEvent("error", "api.generate.docx_review.unexpected_error", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
