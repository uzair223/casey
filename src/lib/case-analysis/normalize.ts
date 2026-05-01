import type { CaseAnalysis, CaseAnalysisSourceRef } from "@/lib/schema";

function sourceKey(source: CaseAnalysisSourceRef) {
  return [
    source.statementId,
    source.sectionId ?? "",
    source.exhibitId ?? "",
    source.evidenceName ?? "",
    source.excerpt.trim().toLowerCase(),
  ].join("\u001f");
}

export function dedupeAnalysisSources(
  sources: CaseAnalysisSourceRef[],
): CaseAnalysisSourceRef[] {
  const seen = new Set<string>();
  const deduped: CaseAnalysisSourceRef[] = [];

  for (const source of sources) {
    const key = sourceKey(source);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function distinctStatementCount(sources: CaseAnalysisSourceRef[]) {
  return new Set(sources.map((source) => source.statementId)).size;
}

export function normalizeCaseAnalysis(analysis: CaseAnalysis): CaseAnalysis {
  return {
    ...analysis,
    chronology: analysis.chronology.map((item) => ({
      ...item,
      sources: dedupeAnalysisSources(item.sources),
    })),
    agreedFacts: analysis.agreedFacts
      .map((item) => ({
        ...item,
        sources: dedupeAnalysisSources(item.sources),
      }))
      .filter((item) => distinctStatementCount(item.sources) >= 2),
    disputedFacts: analysis.disputedFacts.map((item) => ({
      ...item,
      positions: item.positions.map((position) => ({
        ...position,
        sources: dedupeAnalysisSources(position.sources),
      })),
    })),
    evidenceMentioned: analysis.evidenceMentioned.map((item) => ({
      ...item,
      mentionedBy: dedupeAnalysisSources(item.mentionedBy),
    })),
  };
}
