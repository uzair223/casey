"use client";

import { DocxEditor, DocxEditorPanel } from "@/components/ui/docx-editor";

export function StatementDocxPreview({
  blob,
  name,
}: {
  blob: Blob;
  name: string;
}) {
  return (
    <DocxEditor source={blob} documentName={name} canEdit={false}>
      <DocxEditorPanel
        mode="bare"
        className="h-[50vh] max-h-[50vh] sm:h-[65vh] sm:max-h-[65vh]"
      />
    </DocxEditor>
  );
}
