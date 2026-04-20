"use client";

import Link from "next/link";
import React, { useState } from "react";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { uploadFile } from "@/lib/supabase/mutations";
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

type FinalReviewData = {
  tenantId: string;
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
  const [typedName, setTypedName] = useState<string | null>(null);
  const [signatureDocument, setSignatureDocument] =
    useState<UploadedDocument | null>(null);

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
      if (!finalReview.data || !signatureDocument || !typedName) {
        return false;
      }

      await apiFetch(`/api/intake/${token}/final-review`, {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({
          signatureDocument,
          signatureName: typedName,
        }),
      });

      await finalReview.handler();
      return true;
    },
    [token, signatureDocument, typedName, finalReview.data],
    {
      withUseEffect: false,
      onlyFirstLoad: false,
      initialLoading: false,
    },
  );

  const onCaptureSignature = async (
    canvas: HTMLCanvasElement,
    signatureName: string,
  ) => {
    if (!finalReview.data) {
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    if (!blob) {
      throw new Error("Failed to capture signature");
    }

    const fileName = `${finalReview.data.statementId}-final-signature.png`;
    const filePath = `statements/${finalReview.data.statementId}/final-review/${new Date().toISOString()}-${fileName}`;

    const uploaded = await uploadFile({
      bucketId: finalReview.data.tenantId,
      name: fileName,
      path: filePath,
      file: blob,
      contentType: "image/png",
      description: `Final witness signature by ${signatureName}`,
    });

    setTypedName(signatureName);
    setSignatureDocument(uploaded);
  };

  if (finalReview.isLoading) {
    return (
      <section className="container py-8">
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
      <section className="container py-8">
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
    <section className="container py-8 space-y-4">
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>Final Statement Review</CardTitle>
          <CardDescription>
            {finalReview.data.witnessName}, please review the finalized
            statement and supporting evidence for {finalReview.data.caseTitle}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border p-3 bg-muted/20">
            <p className="text-sm font-medium">Finalized statement file</p>
            <p className="text-sm text-muted-foreground">
              {finalReview.data.signedDocument?.name ||
                "No statement file attached"}
            </p>
          </div>

          <div className="rounded-md border p-3 bg-muted/20">
            <p className="text-sm font-medium">Supporting evidence</p>
            {finalReview.data.supportingDocuments.length ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {finalReview.data.supportingDocuments.map((doc, index) => (
                  <li key={`${doc.path}-${index}`}>{doc.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No supporting evidence files attached.
              </p>
            )}
          </div>

          {finalReview.data.alreadyCompleted ? (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              Thank you. Your final signed submission has already been received.
            </div>
          ) : finalReview.data.canSign ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Witness signature</p>
              <SignaturePad
                witnessName={finalReview.data.witnessName}
                onSignatureCapture={(canvas, name) => {
                  void onCaptureSignature(canvas, name);
                }}
                isDisabled={submitFinalReview.isLoading}
              />
              {signatureDocument ? (
                <p className="text-xs text-green-700">
                  Signature captured for {typedName}. Ready to submit.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              This statement is not currently ready for witness final signature.
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            onClick={() => void submitFinalReview.handler()}
            disabled={
              !finalReview.data.canSign ||
              finalReview.data.alreadyCompleted ||
              !signatureDocument ||
              submitFinalReview.isLoading
            }
          >
            {submitFinalReview.isLoading
              ? "Submitting..."
              : "Submit Final Signed Statement"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/intake/${token}/interview`}>Open interview page</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
