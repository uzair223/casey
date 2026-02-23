import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Footer,
  LevelFormat,
} from "docx";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";

interface StatementData {
  caseReference: string; // Firm's internal reference
  claimNumber?: string | null;
  caseTitle: string;
  witnessName: string;
  witnessAddress?: string;
  witnessOccupation?: string;
  sections: Record<string, string>;
  signatureImage?: string; // base64 PNG
  signatureName?: string;
}

/**
 * Generates a UK Court-compliant .docx Witness Statement
 */
export const generateDoc = async (data: StatementData): Promise<Blob> => {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "legal-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }, // Professional hanging indent
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun("Page "),
                  new TextRun({ children: ["PAGE_NUMBER"] }),
                  new TextRun(" of "),
                  new TextRun({ children: ["NUM_PAGES"] }),
                ],
              }),
            ],
          }),
        },
        children: [
          // 1. Legal Header (Internal Ref and Claim No)
          new Paragraph({
            children: [
              new TextRun({
                text: `Our Ref: ${data.caseReference}`,
                bold: true,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Claim No.: ${data.claimNumber || "____________"}`,
                bold: true,
                size: 20,
              }),
            ],
          }),

          // 2. Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({ text: "WITNESS STATEMENT", bold: true, size: 28 }),
            ],
          }),

          // 3. Parties
          new Paragraph({
            children: [
              new TextRun({ text: `BETWEEN: ${data.caseTitle}`, bold: true }),
            ],
          }),

          // 4. Witness Preamble
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: `I, ${data.witnessName}, of ${data.witnessAddress || "[ADDRESS]"}, ${data.witnessOccupation || "[OCCUPATION]"}, WILL SAY as follows:`,
              }),
            ],
          }),

          // 5. Dynamic Sections from Config
          ...PERSONAL_INJURY_CONFIG.sections.flatMap((section) => {
            const content = data.sections[section.field];
            if (!content || content.trim() === "") return [];

            return [
              new Paragraph({
                spacing: { before: 200 },
                children: [
                  new TextRun({
                    text: section.title.toUpperCase(),
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                numbering: {
                  reference: "legal-numbering",
                  level: 0,
                },
                spacing: { after: 200 },
                children: [new TextRun(content)],
              }),
            ];
          }),

          // 6. Statement of Truth (Mandatory CPR wording)
          new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: "STATEMENT OF TRUTH", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "I believe that the facts stated in this witness statement are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.",
                italics: true,
              }),
            ],
          }),

          // 7. Signature Block
          ...(data.signatureImage
            ? [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: data.signatureImage.replace(
                        /^data:image\/(png|jpg);base64,/,
                        "",
                      ),
                      transformation: { width: 150, height: 50 },
                      type: "png",
                    }),
                  ],
                }),
              ]
            : [new Paragraph({ spacing: { before: 400 } })]),

          new Paragraph({
            children: [
              new TextRun({
                text: `Signed: ${data.signatureName || data.witnessName}`,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(`Dated: ${new Date().toLocaleDateString("en-GB")}`),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};
