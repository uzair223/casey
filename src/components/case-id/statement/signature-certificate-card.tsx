"use client";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SignatureCertificate = {
  appName: string;
  statementId: string;
  statementTitle: string;
  witnessName: string;
  witnessEmail: string;
  signerName: string;
  intentAttested: boolean;
  method: string;
  signedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  unsignedDocumentSha256: string | null;
  signedDocumentSha256: string | null;
  dropboxSignatureRequestId: string | null;
  docusealSubmissionId: string | null;
};

export function SignatureCertificateCard({
  statementId,
}: {
  statementId: string;
}) {
  const certificate = useAsync<{ certificate: SignatureCertificate | null }>(
    async () =>
      apiFetch<{ certificate: SignatureCertificate | null }>(
        `/api/tenant/statement/${statementId}/signature`,
      ),
    [statementId],
    { withUseEffect: true, initialLoading: true },
  );

  const record = certificate.data?.certificate;
  if (!record) {
    return null;
  }

  const printCertificate = () => {
    window.print();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Signature certificate</CardTitle>
        <Button variant="outline" size="sm" onClick={printCertificate}>
          Print
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          {record.appName} recorded a simple electronic signature for{" "}
          {record.statementTitle}.
        </p>
        <p>
          Signer: {record.signerName} ({record.witnessEmail})
        </p>
        <p>Signed at: {new Date(record.signedAt).toLocaleString("en-GB")}</p>
        <p>
          Method:{" "}
          {record.method === "docuseal"
            ? "DocuSeal"
            : record.method === "dropbox_sign"
              ? "Dropbox Sign"
              : "In-app signature pad"}
        </p>
        <p>Intent attested: {record.intentAttested ? "Yes" : "No"}</p>
        {record.ipAddress ? <p>IP address: {record.ipAddress}</p> : null}
        {record.unsignedDocumentSha256 ? (
          <p className="break-all">
            Unsigned document SHA-256: {record.unsignedDocumentSha256}
          </p>
        ) : null}
        {record.signedDocumentSha256 ? (
          <p className="break-all">
            Signed document SHA-256: {record.signedDocumentSha256}
          </p>
        ) : null}
        {record.docusealSubmissionId ? (
          <p>DocuSeal submission: {record.docusealSubmissionId}</p>
        ) : null}
        {record.dropboxSignatureRequestId ? (
          <p>Legacy Dropbox Sign request: {record.dropboxSignatureRequestId}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
