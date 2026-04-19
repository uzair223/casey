"use client";

import { DocumentsCardBase } from "@/components/case-id/shared/documents-card-base";

import { getStatementInternalDocuments } from "@/lib/supabase/queries";
import {
  createStatementInternalDocument,
  deleteStatementInternalDocument,
  replaceStatementInternalDocument,
  renameStatementInternalDocument,
  uploadFile,
} from "@/lib/supabase/mutations";

type StatementInternalDocumentsCardProps = {
  tenantId: string;
  caseId: string;
  statementId: string;
};

export function StatementInternalDocumentsCard({
  tenantId,
  caseId,
  statementId,
}: StatementInternalDocumentsCardProps) {
  return (
    <DocumentsCardBase
      tenantId={tenantId}
      title="Internal statement evidence"
      loadDocuments={() => getStatementInternalDocuments(statementId)}
      refreshDeps={[statementId]}
      buildUploadPath={(fileName) =>
        `cases/${caseId}/statements/${statementId}/internal/${Date.now()}-${fileName}`
      }
      createDocumentRecord={({ uploadedByUserId, document }) =>
        createStatementInternalDocument({
          tenantId,
          statementId,
          uploadedByUserId,
          document,
        })
      }
      renameDocumentRecord={({ entry, name }) =>
        renameStatementInternalDocument({
          documentId: entry.id,
          document: entry.document,
          name,
        })
      }
      deleteDocumentRecord={({ entry, fallbackBucketId }) =>
        deleteStatementInternalDocument({
          documentId: entry.id,
          document: entry.document,
          fallbackBucketId,
        })
      }
      replaceDocumentRecord={async ({ entry, file }) => {
        const uploaded = await uploadFile({
          bucketId: tenantId,
          name: file.name,
          path: entry.document.path,
          file,
          contentType: file.type || entry.document.type,
          upsert: true,
        });

        await replaceStatementInternalDocument({
          documentId: entry.id,
          document: uploaded,
        });
      }}
      variant="card"
    />
  );
}
