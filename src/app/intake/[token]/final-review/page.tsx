"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { signDoc } from "@/lib/doc-gen";
import { DocusealEmbed } from "@/components/intake/docuseal-embed";
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
import type { UploadedDocument } from "@/types";
import { DocxEditor, DocxEditorPanel } from "@/components/ui/docx-editor";
import { PageTitle } from "@/components/page-title";
import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { toast } from "@/lib/toast";

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
  canSign: boolean;
  alreadyCompleted: boolean;
  signingMethod: "canvas" | "docuseal";
};

export default function FinalReviewPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);
  const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<
    string | null
  >(null);
  const [intentAttested, setIntentAttested] = useState(false);
  const [certifiedComplete, setCertifiedComplete] = useState(false);
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

  const startCertifiedSigning = useAsync(
    async () => {
      if (!finalReviewData || !intentAttested) {
        return null;
      }
      return apiFetch<{ embedSrc: string }>(
        `/api/intake/${token}/final-review/embedded`,
        {
          method: "POST",
          requireAuth: "optional",
          body: JSON.stringify({
            signatureName: finalReviewData.witnessName,
            intentAttested: true,
          }),
        },
      );
    },
    [token, finalReviewData, intentAttested],
    {
      withUseEffect: false,
      onlyFirstLoad: false,
      initialLoading: false,
    },
  );

  const submitFinalReview = useAsync(
    async () => {
      if (!finalReviewData || !signatureImageDataUrl || !intentAttested) {
        return false;
      }
      if (finalReviewData.status === "demo_published") {
        return true;
      }

      await apiFetch(`/api/intake/${token}/final-review`, {
        method: "POST",
        requireAuth: "optional",
        body: JSON.stringify({
          signatureImageDataUrl,
          signatureName: finalReviewData.witnessName,
          intentAttested: true,
        }),
      });
      await finalReview.handler();
      return true;
    },
    [token, signatureImageDataUrl, finalReviewData, intentAttested],
    {
      withUseEffect: false,
      onlyFirstLoad: false,
      initialLoading: false,
    },
  );

  // Load the review document on demand. Before completion this is generated
  // server-side from the latest statement snapshot rather than persisted.
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
        const response = await fetch(
          `/api/intake/${token}/shared/final-review-file?kind=signed`,
        );

        if (cancelled) return;

        if (!response.ok) {
          console.error("Failed to load document", response.status);
          setBaseDocumentBlob(null);
          setDocumentBlob(null);
          setDocumentUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return null;
          });
          return;
        }

        const data = await response.blob();

        setBaseDocumentBlob(data);
        setDocumentBlob(data);
        setDocumentUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(data);
        });
      } catch (err) {
        console.error("Error loading document", err);
        setBaseDocumentBlob(null);
        setDocumentBlob(null);
        setDocumentUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
      }
    }

    loadDocumentBlob();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    finalReviewData,
    certifiedComplete,
  ]);

  // Confetti effect when submission is complete
  useEffect(() => {
    if (!submitFinalReview.data && !certifiedComplete) return;

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
  }, [submitFinalReview.data, certifiedComplete]);

  const onCaptureSignature = async (canvas: HTMLCanvasElement) => {
    try {
      if (!intentAttested) {
        toast.error("Please confirm you intend to sign this statement.");
        return;
      }

      if (!finalReview.data) {
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      if (!blob) {
        throw new Error("Failed to capture signature");
      }

      setSignatureImageDataUrl(canvas.toDataURL("image/png"));

      if (baseDocumentBlob) {
        const signedBlob = await signDoc({
          file: baseDocumentBlob,
          signatureImage: blob,
          signatureDate: new Date().toLocaleDateString("en-GB"),
        });
        setDocumentBlob(signedBlob);
        await submitFinalReview.handler();
      }
    } catch (error) {
      toast.errorFromUnknown(
        error,
        "Failed to capture signature. Please try again.",
      );
    }
  };

  const onDocusealComplete = useCallback(() => {
    setCertifiedComplete(true);
    void finalReview.handler();
  }, [finalReview.handler]);

  const embedSrc = startCertifiedSigning.data?.embedSrc ?? null;

  useEffect(() => {
    if (finalReview.data?.alreadyCompleted) {
      setCertifiedComplete(true);
      return;
    }
    if (!embedSrc) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      await finalReview.handler();
    };

    const timer = window.setInterval(() => {
      if (cancelled || attempts >= 60) {
        window.clearInterval(timer);
        return;
      }
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [embedSrc, finalReview.data?.alreadyCompleted, finalReview.handler]);

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

  const signedOff =
    finalReview.data.alreadyCompleted ||
    Boolean(submitFinalReview.data) ||
    certifiedComplete;
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
          ) : (
            <PageTitle
              subtitle="Final signature required"
              title="Review and sign your statement"
              description={`${finalReview.data.witnessName}, please review the finalized statement and supporting evidence for ${finalReview.data.caseTitle}.`}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!signedOff && embedSrc ? (
            <DocusealEmbed
              src={embedSrc}
              email={finalReview.data.witnessEmail}
              onComplete={onDocusealComplete}
            />
          ) : !signedOff ? (
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={intentAttested}
                  onChange={(event) => setIntentAttested(event.target.checked)}
                />
                <span>
                  I intend to sign this statement as {finalReview.data.witnessName}
                  and confirm that the account is true to the best of my knowledge.
                </span>
              </label>
              {finalReview.data.signingMethod === "docuseal" ? (
                <Button
                  onClick={() => {
                    void startCertifiedSigning.handler().catch((error) => {
                      toast.errorFromUnknown(
                        error,
                        "Failed to start certified signing.",
                      );
                    });
                  }}
                  disabled={!intentAttested || startCertifiedSigning.isLoading}
                >
                  {startCertifiedSigning.isLoading
                    ? "Opening signature..."
                    : "Sign statement"}
                </Button>
              ) : (
                <SignaturePadProvider>
                  <SignaturePad />
                  <SignaturePadSubmitButton
                    className="mr-1"
                    onCaptureSignature={onCaptureSignature}
                    disabled={
                      !intentAttested || submitFinalReview.isLoading
                    }
                  >
                    {submitFinalReview.isLoading
                      ? "Submitting..."
                      : "Submit Final Signed Statement"}
                  </SignaturePadSubmitButton>
                </SignaturePadProvider>
              )}
            </div>
          ) : finalReview.data.canSign ? null : (
            <Card variant="warning">
              <CardHeader>
                <CardTitle className="text-sm">
                  This statement is not currently ready for witness final
                  signature.
                </CardTitle>
              </CardHeader>
            </Card>
          )}

          {documentBlob && documentIsPdf && documentUrl ? (
            <iframe
              title={finalReview.data.documentName}
              src={documentUrl}
              className="h-[50vh] w-full rounded-md border sm:h-[65vh]"
            />
          ) : documentBlob ? (
            <DocxEditor
              source={documentBlob}
              documentName={finalReview.data.documentName}
              canEdit={false}
            >
              <DocxEditorPanel
                mode="bare"
                className="h-[50vh] max-h-[50vh] sm:h-[65vh] sm:max-h-[65vh]"
              />
            </DocxEditor>
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
