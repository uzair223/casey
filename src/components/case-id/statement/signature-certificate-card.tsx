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

function fontFaceRules() {
  const rules: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) rules.push(rule.cssText);
      }
    } catch {
      // A cross-origin sheet cannot be read. The document pages still print.
    }
  }
  return rules.join("\n");
}

function printStatementDocument(source: HTMLElement) {
  const pages = source
    .closest('[role="tabpanel"]')
    ?.querySelector(".paged-editor__pages");
  if (!(pages instanceof HTMLElement)) return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-statement-print", "true");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return;
  }

  const clone = frameDocument.importNode(pages, true);
  clone.style.cssText = "display:block;margin:0;padding:0;";
  const printedPages = clone.querySelectorAll<HTMLElement>(".layout-page");
  printedPages.forEach((page, index) => {
    page.style.boxShadow = "none";
    page.style.margin = "0";
    page.style.breakAfter = index === printedPages.length - 1 ? "auto" : "page";
  });

  frameDocument.open();
  frameDocument.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Statement</title>
    <style>
      ${fontFaceRules()}
      * { margin: 0; padding: 0; }
      body { background: white; }
      .layout-page { break-after: page; }
      .layout-page:last-child { break-after: auto; }
      @page { margin: 0; size: auto; }
    </style>
  </head>
  <body></body>
</html>`);
  frameDocument.close();
  frameDocument.body.appendChild(clone);
  frameWindow.addEventListener("afterprint", () => iframe.remove(), {
    once: true,
  });
  frameWindow.focus();
  frameWindow.print();
}

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
  signatureImageSha256: string | null;
  attestationText: string | null;
  dropboxSignatureRequestId: string | null;
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

  const printDocument = (event: React.MouseEvent<HTMLButtonElement>) => {
    printStatementDocument(event.currentTarget);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Signature certificate</CardTitle>
        <Button variant="outline" size="sm" onClick={printDocument}>
          Print
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          {record.appName} recorded a simple electronic signature for{" "}
          {record.statementTitle}. This is the signatory&apos;s signature on
          the statement, kept with the time, the signatory, and the hashes
          below. It is not a qualified electronic signature.
        </p>
        <p>
          Signer: {record.signerName} ({record.witnessEmail})
        </p>
        <p>Signed at: {new Date(record.signedAt).toLocaleString("en-GB")}</p>
        <p>
          Method:{" "}
          {record.method === "dropbox_sign"
            ? "Dropbox Sign"
            : "Signature on the statement"}
        </p>
        <p>Statement of truth accepted: {record.intentAttested ? "Yes" : "No"}</p>
        {record.attestationText ? <p>{record.attestationText}</p> : null}
        {record.ipAddress ? <p>IP address: {record.ipAddress}</p> : null}
        {record.userAgent ? (
          <p className="break-all">Browser: {record.userAgent}</p>
        ) : null}
        {record.unsignedDocumentSha256 ? (
          <p className="break-all">
            Statement text SHA-256: {record.unsignedDocumentSha256}
          </p>
        ) : null}
        {record.signatureImageSha256 ? (
          <p className="break-all">
            Signature image SHA-256: {record.signatureImageSha256}
          </p>
        ) : null}
        {record.signedDocumentSha256 ? (
          <p className="break-all">
            Signed file SHA-256: {record.signedDocumentSha256}
          </p>
        ) : null}
        {record.dropboxSignatureRequestId ? (
          <p>Legacy Dropbox Sign request: {record.dropboxSignatureRequestId}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
