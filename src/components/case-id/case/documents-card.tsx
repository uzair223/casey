"use client";

import { Card } from "@/components/ui/card";
import { DocumentsCardBase } from "../shared/documents-card-base";

import { getCaseInternalDocuments } from "@/lib/supabase/queries";
import {
  createCaseInternalDocument,
  deleteCaseInternalDocument,
  renameCaseInternalDocument,
  uploadFile,
} from "@/lib/supabase/mutations";

type CaseInternalDocumentsCardProps = React.ComponentProps<typeof Card> & {
  tenantId: string;
  caseId: string;
};

export function CaseInternalDocumentsCard({
  tenantId,
  caseId,
  ...props
}: CaseInternalDocumentsCardProps) {
  return (
    <DocumentsCardBase
      tenantId={tenantId}
      title="Internal case evidence"
      loadDocuments={() => getCaseInternalDocuments(caseId)}
      refreshDeps={[caseId]}
      buildUploadPath={(fileName) =>
        `cases/${caseId}/internal/${Date.now()}-${fileName}`
      }
      createDocumentRecord={({ uploadedByUserId, document }) =>
        createCaseInternalDocument({
          tenantId,
          caseId,
          uploadedByUserId,
          document,
        })
      }
      renameDocumentRecord={({ entry, name }) =>
        renameCaseInternalDocument({
          documentId: entry.id,
          document: entry.document,
          name,
        })
      }
      deleteDocumentRecord={({ entry, fallbackBucketId }) =>
        deleteCaseInternalDocument({
          documentId: entry.id,
          document: entry.document,
          fallbackBucketId,
        })
      }
      variant="inline"
      cardProps={props}
    />
  );
}
