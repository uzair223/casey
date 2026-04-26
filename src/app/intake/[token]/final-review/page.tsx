"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { signDoc } from "@/lib/doc-gen";
import { SignaturePad } from "@/components/intake/signature-pad";
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
  statementId: string;
  status: string;
  sections: Record<string, string>;
  signedDocument: UploadedDocument | null;
  supportingDocuments: UploadedDocument[];
  canSign: boolean;
  alreadyCompleted: boolean;
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
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);

  const finalReview = useAsync<FinalReviewData>(
    async () =>
      apiFetch<FinalReviewData>(`/api/intake/${token}/final-review`, {
        method: "GET",
        requireAuth: false,
      }),
    [token],
    {
      withUseEffect: true,
      initialLoading: true,
    },
  );

  const submitFinalReview = useAsync(
    async () => {
      if (!finalReview.data || !signatureImageDataUrl) {
        return false;
      }
      if (finalReview.data.status === "demo_published") {
        return true;
      }

      await apiFetch(`/api/intake/${token}/final-review`, {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({
          signatureImageDataUrl,
          signatureName: finalReview.data.witnessName,
        }),
      });
      await finalReview.handler();
      return true;
    },
    [token, signatureImageDataUrl, finalReview.data],
    {
      withUseEffect: false,
      onlyFirstLoad: false,
      initialLoading: false,
    },
  );

  // Load document blob whenever signed document changes
  useEffect(() => {
    let cancelled = false;

    async function loadDocumentBlob() {
      if (!finalReview.data?.signedDocument) {
        setDocumentBlob(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/intake/${token}/shared/final-review-file?kind=signed`,
        );

        if (cancelled) return;

        if (!response.ok) {
          console.error("Failed to load document", response.status);
          setDocumentBlob(null);
          return;
        }

        const data = await response.blob();

        setDocumentBlob(data);
      } catch (err) {
        console.error("Error loading document", err);
        setDocumentBlob(null);
      }
    }

    loadDocumentBlob();

    return () => {
      cancelled = true;
    };
  }, [token, finalReview.data?.signedDocument, finalReview.data?.tenantId]);

  // Confetti effect when submission is complete
  useEffect(() => {
    if (!submitFinalReview.data) return;

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
  }, [submitFinalReview.data]);

  const onCaptureSignature = async (canvas: HTMLCanvasElement) => {
    try {
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

      if (documentBlob && finalReview.data.signedDocument) {
        const signedBlob = await signDoc({
          file: documentBlob,
          signatureImage: blob,
          signatureDate: new Date().toLocaleDateString("en-GB"),
        });
        setDocumentBlob(signedBlob);
      }
    } catch (error) {
      toast.errorFromUnknown(
        error,
        "Failed to capture signature. Please try again.",
      );
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

  return (
    <div className="container py-4 sm:py-8">
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          {finalReview.data.alreadyCompleted || submitFinalReview.data ? (
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
              actions={[
                {
                  label: submitFinalReview.isLoading
                    ? "Submitting..."
                    : "Submit Final Signed Statement",
                  action: () => void submitFinalReview.handler(),
                  disabled:
                    !finalReview.data?.canSign ||
                    finalReview.data.alreadyCompleted ||
                    !signatureImageDataUrl ||
                    submitFinalReview.isLoading,
                },
                {
                  label: "Open interview page",
                  href: `/intake/${token}/interview`,
                  variant: "outline",
                },
              ]}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {finalReview.data.signedDocument ? (
            <DocxEditor
              source={documentBlob}
              documentName={finalReview.data.signedDocument.name}
              canEdit={false}
            >
              <DocxEditorPanel className="h-[50vh] max-h-[50vh] sm:h-[65vh] sm:max-h-[65vh]" />
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

          {finalReview.data.alreadyCompleted ||
          submitFinalReview.data ? null : finalReview.data.canSign ? (
            <div className="space-y-3 rounded-md border p-3 sm:p-4">
              <p className="text-sm font-medium">Witness signature</p>
              <SignaturePad
                witnessName={finalReview.data.witnessName}
                onSignatureCapture={(canvas) => {
                  void onCaptureSignature(canvas);
                }}
                isDisabled={submitFinalReview.isLoading}
              />
              {signatureImageDataUrl ? (
                <p className="text-xs text-green-700">
                  Signature captured for {finalReview.data.witnessName}. Ready
                  to submit.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              This statement is not currently ready for witness final signature.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
