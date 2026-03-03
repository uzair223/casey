"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { useWitnessStatement } from "@/contexts/WitnessStatementContext";
import { generateDoc } from "@/lib/docGenerator";
import { saveAs } from "file-saver";

export function StatementDocument() {
  const {
    statementData,
    statementSections,
    isEditingStatement,
    setIsEditingStatement,
    signatureData,
    isSubmitted,
    setStatementSections,
  } = useWitnessStatement();

  if (!statementData) return null;

  const signatureImage = signatureData?.canvas?.toDataURL("image/png");
  const signatureName = signatureData?.name || statementData.witness_name;

  const completionDate = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sections = PERSONAL_INJURY_CONFIG.sections
    .map((sectionConfig) => ({
      ...sectionConfig,
      content: statementSections[sectionConfig.field] || "",
    }))
    .filter((s) => s.content || isEditingStatement); // Keep empty ones visible while editing

  const handleDownload = async () => {
    const blob = await generateDoc({
      caseReference: statementData.reference,
      claimNumber: statementData.claim_number,
      caseTitle: statementData.title,
      witnessName: statementData.witness_name,
      witnessAddress: statementData.witness_address || undefined,
      witnessOccupation: statementData.witness_occupation || undefined,
      sections: statementSections,
      signatureImage,
      signatureName,
    });
    saveAs(blob, `${statementData.reference}_Witness_Statement.docx`);
  };

  return (
    <>
      <div className="flex gap-2 mb-4 print:hidden">
        {!isSubmitted && (
          <Button
            variant="outline"
            onClick={() => setIsEditingStatement(!isEditingStatement)}
          >
            {isEditingStatement ? "Finish Editing" : "Edit Statement"}
          </Button>
        )}
        <Button variant="default" onClick={handleDownload}>
          Download Word Document (.docx)
        </Button>
      </div>

      <div
        className="bg-white text-black p-[20mm] space-y-6 font-serif shadow-xl mx-auto"
        style={{
          width: "100%",
          maxWidth: "210mm", // A4 Width
          minHeight: "297mm", // A4 Height
          lineHeight: "1.5",
          color: "#000",
        }}
      >
        {/* Top Legal Header */}
        <div className="flex justify-between items-start text-sm font-semibold uppercase">
          <div>Our Ref: {statementData.reference}</div>
          <div>Claim No: {statementData.claim_number || "___________"}</div>
        </div>

        {/* Title */}
        <h1 className="text-center text-xl font-semibold underline underline-offset-4">
          WITNESS STATEMENT
        </h1>

        {/* Parties */}
        <div className="text-sm font-semibold">
          <p>BETWEEN: {statementData.title}</p>
        </div>

        {/* Witness Preamble */}
        <p className="text-sm">
          I, {statementData.witness_name}, of{" "}
          {statementData.witness_address || "[ADDRESS]"},{" "}
          {statementData.witness_occupation || "[OCCUPATION]"}, WILL SAY as
          follows:
        </p>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((section, index) => (
            <div key={section.field} className="group">
              <h2 className="text-sm font-semibold uppercase mb-2 tracking-tight">
                {section.title}
              </h2>

              {isEditingStatement ? (
                <textarea
                  value={section.content}
                  onChange={(e) =>
                    setStatementSections((prev) => ({
                      ...prev,
                      [section.field]: e.target.value,
                    }))
                  }
                  className="w-full h-32 p-3 bg-slate-50 border border-slate-300 rounded font-sans text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={section.placeholder}
                />
              ) : (
                <div className="flex items-start">
                  {/* Hanging Indent Logic */}
                  <span className="w-8 font-semibold shrink-0">
                    {index + 1}.
                  </span>
                  <p className="flex-1 whitespace-pre-wrap text-[11pt]">
                    {section.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Statement of Truth */}
        <div className="border-t pt-6 border-gray-200">
          <h2 className="font-semibold uppercase mb-2">Statement of Truth</h2>
          <p className="italic text-[10pt] leading-relaxed mb-6">
            I believe that the facts stated in this witness statement are true.
            I understand that proceedings for contempt of court may be brought
            against anyone who makes, or causes to be made, a false statement in
            a document verified by a statement of truth without an honest belief
            in its truth.
          </p>

          {/* Signature Block */}
          <div className="space-y-2">
            {signatureImage && (
              <div className="mb-2">
                <Image
                  src={signatureImage}
                  alt="Signature"
                  width={150}
                  height={50}
                  unoptimized
                  className="object-contain"
                />
              </div>
            )}
            <div className="border-t border-black w-64 pt-2">
              <p className="text-sm font-semibold">Signed: {signatureName}</p>
              <p className="text-sm">Dated: {completionDate}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
