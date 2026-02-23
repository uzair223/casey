"use client";

import { Button } from "@/components/ui/button";
import { useStatement } from "@/contexts/StatementContext";
import { TrashIcon } from "lucide-react";

export function SupportingDocumentsView() {
  const { statementData, evidenceFiles, addEvidenceFiles, removeEvidenceFile } =
    useStatement();

  if (!statementData) return null;

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addEvidenceFiles(e.target.files);
  };

  const handleRemoveLocal = (index: number) => {
    removeEvidenceFile(index);
  };

  return (
    <div className="px-8 space-y-4">
      <div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Evidence
          </p>
          <h2 className="text-2xl font-semibold text-primary mt-2">
            Supporting Documents
          </h2>
          <p className="text-muted-foreground mt-2">
            Upload any supporting documents related to your case (receipts,
            medical reports, photos, dashcam footage, etc.).
          </p>
        </div>
      </div>

      {/* Upload Documents Section */}
      <input
        id="file-upload"
        type="file"
        multiple
        onChange={handleFileInput}
        className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-accent file:text-accent-foreground
                hover:file:bg-accent/90
                cursor-pointer"
      />

      {/* Local Files to Upload */}
      {evidenceFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Files to upload ({evidenceFiles.length}):
          </p>
          <div className="space-y-1">
            {Array.from(evidenceFiles).map((file, idx) => (
              <Button
                key={idx}
                variant="outline-destructive"
                className="group w-full items-center justify-between"
                onClick={() => handleRemoveLocal(idx)}
              >
                <span className="truncate">{file.name}</span>
                <TrashIcon className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
