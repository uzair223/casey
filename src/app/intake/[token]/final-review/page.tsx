"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { STATEMENT_OF_TRUTH } from "@/lib/signing/statement-of-truth";
import {
  SignaturePad,
  SignaturePadProvider,
  SignaturePadSubmitButton,
} from "@/components/intake/signature-pad";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatementConfig, UploadedDocument } from "@/types";
import { PageTitle } from "@/components/page-title";
import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { toast } from "@/lib/toast";

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const StatementDocxPreview = dynamic(
  () =>
    import("@/components/intake/statement-docx-preview").then(
      (mod) => mod.StatementDocxPreview,
    ),
  { ssr: false },
);

type FinalReviewData = {
  tenantId: string;
  caseId: string;
  caseTitle: string;
  witnessName: string;
  witnessEmail: string;
  statementId: string;
  status: string;
  sections: Record<string, string>;
  signedDocument: UploadedDocument | null;
  documentName: string;
  supportingDocuments: UploadedDocument[];
  caseMetadata: Record<string, string | number | null | undefined>;
  witnessMetadata: Record<string, string | number | null | undefined>;
  config: StatementConfig;
  hasTemplate: boolean;
  canSign: boolean;
  alreadyCompleted: boolean;
};

export default function FinalReviewPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);
  const [intentAttested, setIntentAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [baseDocumentBlob, setBaseDocumentBlob] = useState<Blob | null>(null);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  const finalReview = useAsync<FinalReviewData>(
    async () =>
      apiFetch<FinalReviewData>(`/api/intake/${token}/final-review`, {
        method: "GET",
        requireAuth: "optional",
      }),
    [token],
    {
      withUseEffect: true,
      initialLoading: true,
    },
  );
  const finalReviewData = finalReview.data;

  function rememberDocument(blob: Blob) {
    setBaseDocumentBlob(blob);
    setDocumentBlob(blob);
    setDocumentUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
  }

  // The Word file is built in the browser. The review request only downloads a
  // stored file, so the page does not render a document on the worker.
  useEffect(() => {
    let cancelled = false;

    async function loadDocumentBlob() {
      if (!finalReviewData) {
        setBaseDocumentBlob(null);
        setDocumentBlob(null);
        setDocumentUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        return;
      }

      try {
        if (finalReviewData.signedDocument?.path) {
          const stored = await fetch(
            `/api/intake/${token}/shared/final-review-file?kind=signed`,
          );
          if (cancelled) return;
          if (stored.ok) {
            rememberDocument(await stored.blob());
            return;
          }
        }

        let template: Uint8Array | null = null;
        if (finalReviewData.hasTemplate) {
          const templateResponse = await fetch(
            `/api/intake/${token}/shared/final-review-file?kind=template`,
          );
          if (cancelled) return;
          if (templateResponse.ok) {
            template = new Uint8Array(await templateResponse.arrayBuffer());
          }
        }

        const { generateDoc } = await import("@/lib/doc-gen");
        const generated = await generateDoc(
          {
            caseMetadata: finalReviewData.caseMetadata,
            witnessName: finalReviewData.witnessName,
            witnessEmail: finalReviewData.witnessEmail,
            witnessMetadata: finalReviewData.witnessMetadata,
            sections: finalReviewData.sections,
            config: finalReviewData.config,
          },
          template,
        );
        if (cancelled) return;
        rememberDocument(generated);
      } catch (err) {
        console.error("Error loading document", err);
        if (cancelled) return;
        setBaseDocumentBlob(null);
        setDocumentBlob(null);
        setDocumentUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
      }
    }

    void loadDocumentBlob();

    return () => {
      cancelled = true;
    };
  }, [token, finalReviewData]);

  // Confetti effect when submission is complete
  useEffect(() => {
    if (!submitted) return;

    const defaults = {
      spread: 65,
      startVelocity: 45,
      gravity: 0.9,
      ticks: 220,
      scalar: 0.95,
      zIndex: 2000,
      colors: ["#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"],
    };

    confetti({
      ...defaults,
      particleCount: 120,
      origin: { x: 0.5, y: 0.2 },
    });

    const followUp = setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 70,
        origin: { x: 0.25, y: 0.25 },
      });
      confetti({
        ...defaults,
        particleCount: 70,
        origin: { x: 0.75, y: 0.25 },
      });
    }, 350);

    return () => clearTimeout(followUp);
  }, [submitted]);

  const onCaptureSignature = async (canvas: HTMLCanvasElement) => {
    try {
      if (!intentAttested) {
        toast.error("Please confirm you intend to sign this statement.");
        return;
      }

      if (!finalReview.data || !baseDocumentBlob) {
        toast.error("The statement is still being prepared.");
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      if (!blob) {
        throw new Error("Failed to capture signature");
      }

      setSubmitting(true);
      const { signDoc } = await import("@/lib/doc-gen");
      const signedBlob = await signDoc({
        file: baseDocumentBlob,
        signatureImage: blob,
        signatureDate: new Date().toLocaleDateString("en-GB"),
      });
      setDocumentBlob(signedBlob);
      setDocumentUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(signedBlob);
      });

      if (finalReview.data.status !== "demo_published") {
        await apiFetch(`/api/intake/${token}/final-review`, {
          method: "POST",
          requireAuth: "optional",
          body: JSON.stringify({
            intentAttested: true,
            signedDocumentBase64: await blobToBase64(signedBlob),
            signatureImageBase64: await blobToBase64(blob),
          }),
        });
        await finalReview.handler();
      }
      setSubmitted(true);
    } catch (error) {
      toast.errorFromUnknown(
        error,
        "Failed to capture signature. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (finalReview.isLoading) {
    return (
      <section className="container py-4 sm:py-8">
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Loading final statement review</CardTitle>
            <CardDescription>
              Please wait while we load your secure review page.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  if (finalReview.error || !finalReview.data) {
    return (
      <section className="container py-4 sm:py-8">
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Link Not Available</CardTitle>
            <CardDescription>
              This final review link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href={`/intake/${token}/interview`}>
                Open interview page
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  const signedOff = finalReview.data.alreadyCompleted || submitted;
  const documentIsPdf =
    Boolean(documentBlob?.type.includes("pdf")) ||
    finalReview.data.documentName.toLowerCase().endsWith(".pdf");

  return (
    <div className="container py-4 sm:py-8">
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          {signedOff ? (
            <PageTitle
              subtitle="Submission complete"
              title="Thank you for signing your statement"
              description="Your signed submission has been received and will be reviewed by the legal team."
            />
          ) : finalReview.data.canSign ? (
            <PageTitle
              subtitle="Final signature required"
              title="Review and sign your statement"
              description={`${finalReview.data.witnessName}, please review the finalized statement and supporting evidence for ${finalReview.data.caseTitle}.`}
            />
          ) : (
            <PageTitle
              subtitle="Final review"
              title="This account is not currently ready for a final signature."
              description="The firm prepares the written draft during review. You can sign once that draft is ready."
            />
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!signedOff && finalReview.data.canSign ? (
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={intentAttested}
                  onChange={(event) => setIntentAttested(event.target.checked)}
                />
                <span>
                  {STATEMENT_OF_TRUTH} I sign as {finalReview.data.witnessName}.
                </span>
              </label>
              <SignaturePadProvider>
                <SignaturePad />
                <SignaturePadSubmitButton
                  className="mr-1"
                  onCaptureSignature={onCaptureSignature}
                  disabled={!intentAttested || submitting}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit Final Signed Statement"}
                </SignaturePadSubmitButton>
              </SignaturePadProvider>
            </div>
          ) : null}

          {documentBlob && documentIsPdf && documentUrl ? (
            <iframe
              title={finalReview.data.documentName}
              src={documentUrl}
              className="h-[50vh] w-full rounded-md border sm:h-[65vh]"
            />
          ) : documentBlob ? (
            <StatementDocxPreview
              blob={documentBlob}
              name={finalReview.data.documentName}
            />
          ) : (
            <div className="rounded-md border p-3 bg-muted/20">
              <p className="text-sm text-muted-foreground">
                No statement file attached
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Supporting evidence</p>
            {finalReview.data.supportingDocuments.length ? (
              <div className="flex flex-wrap items-center gap-2">
                {finalReview.data.supportingDocuments.map((document, index) => (
                  <AttachmentPreviewCard document={document} key={index} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No supporting evidence files attached.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
