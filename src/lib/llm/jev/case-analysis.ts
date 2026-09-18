import { noul, score, type Questions } from "./questions";

import type { CaseAnalysis } from "@/lib/schema";

import { evaluateWithJev } from "./client";
import {
  CASE_COMPLETENESS_LEVELS,
  JEV_ANALYSIS_ITEM_CAP,
  JEV_EXCERPT_MAX_CHARS,
  JEV_NOUL_AGREE_MIN,
  JEV_NOUL_CONFLICT_MIN,
  JEV_NOUL_CONTRADICTION_MIN,
  JEV_NOUL_MATERIAL_GAP_MIN,
  JEV_SCORE_CONFIDENCE_MIN,
  PHASE_COMPLETENESS_MAX_SCORE,
  type CaseCompletenessLevel,
} from "./thresholds";

function truncateText(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}...[truncated]`;
}

function asNoul(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const noulValue = (value as { noul?: unknown }).noul;
  return typeof noulValue === "number" && Number.isFinite(noulValue)
    ? noulValue
    : null;
}

function asScore(value: unknown): { score: number; confidence: number } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { score?: unknown; confidence?: unknown };
  if (typeof record.score !== "number" || !Number.isFinite(record.score)) {
    return null;
  }
  return {
    score: record.score,
    confidence:
      typeof record.confidence === "number" && Number.isFinite(record.confidence)
        ? record.confidence
        : 0,
  };
}

function compactnessSources(
  sources: Array<{
    witnessName: string;
    excerpt: string;
    exhibitId?: string | null;
    evidenceName?: string | null;
  }>,
) {
  return sources.slice(0, 4).map((source) => ({
    witnessName: source.witnessName,
    exhibitId: source.exhibitId ?? null,
    evidenceName: source.evidenceName ?? null,
    excerpt: truncateText(source.excerpt, JEV_EXCERPT_MAX_CHARS),
  }));
}

export function completenessLevelFromScore(
  scoreValue: number,
): CaseCompletenessLevel {
  const rounded = Math.min(
    CASE_COMPLETENESS_LEVELS.length - 1,
    Math.max(0, Math.round(scoreValue)),
  );
  return CASE_COMPLETENESS_LEVELS[rounded] ?? "thin";
}

export function buildCaseAnalysisState(params: {
  caseTitle: string;
  caseMetadata: unknown;
  statementIds: string[];
  analysis: CaseAnalysis;
}) {
  return {
    caseTitle: params.caseTitle,
    statementCount: params.statementIds.length,
    statementIds: params.statementIds,
    caseMetadata: params.caseMetadata ?? {},
    agreedFacts: params.analysis.agreedFacts
      .slice(0, JEV_ANALYSIS_ITEM_CAP)
      .map((item) => ({
        fact: truncateText(item.fact, JEV_EXCERPT_MAX_CHARS),
        sources: compactnessSources(item.sources),
      })),
    disputedFacts: params.analysis.disputedFacts
      .slice(0, JEV_ANALYSIS_ITEM_CAP)
      .map((item) => ({
        issue: truncateText(item.issue, JEV_EXCERPT_MAX_CHARS),
        positions: item.positions.slice(0, 4).map((position) => ({
          summary: truncateText(position.summary, JEV_EXCERPT_MAX_CHARS),
          sources: compactnessSources(position.sources),
        })),
      })),
    missingInformation: params.analysis.missingInformation
      .slice(0, JEV_ANALYSIS_ITEM_CAP)
      .map((item) => ({
        gap: truncateText(item.gap, JEV_EXCERPT_MAX_CHARS),
        whyItMatters: truncateText(item.whyItMatters, JEV_EXCERPT_MAX_CHARS),
      })),
    chronologyConflicts: params.analysis.chronology.flatMap((item, index) =>
      item.conflicts.slice(0, 3).map((conflict, conflictIndex) => ({
        chronologyIndex: index,
        conflictIndex,
        event: truncateText(item.event, JEV_EXCERPT_MAX_CHARS),
        conflict: truncateText(conflict, JEV_EXCERPT_MAX_CHARS),
      })),
    ).slice(0, JEV_ANALYSIS_ITEM_CAP),
  };
}

export function buildCaseAnalysisQuestions(analysis: CaseAnalysis) {
  const questions: Questions = {
    overallCompleteness: score(
      "How complete is this case file for preparing a solicitor review of the witness evidence?",
      [
        "Thin: major factual areas are missing and the file cannot yet support a reliable review.",
        "Partial: some core facts exist, but important chronology, corroboration, or gaps remain.",
        "Mostly: the main account is present with only limited outstanding points.",
        "Trial-ready: the statements and mentioned evidence cover the issues needed for a first formal review.",
      ],
    ),
  };

  analysis.agreedFacts.slice(0, JEV_ANALYSIS_ITEM_CAP).forEach((item, index) => {
    questions[`agreed_${index}`] = noul(
      "Do the cited sources actually agree on this fact, rather than merely overlapping in topic?",
      {
        true: `The sources support the same fact: ${truncateText(item.fact, 240)}`,
        false: "The sources do not clearly agree, or the overlap is only topical.",
      },
    );
  });

  analysis.disputedFacts
    .slice(0, JEV_ANALYSIS_ITEM_CAP)
    .forEach((item, index) => {
      questions[`disputed_${index}`] = noul(
        "Is this a genuine contradiction between accounts, rather than a difference of emphasis?",
        {
          true: `The positions cannot both be true: ${truncateText(item.issue, 240)}`,
          false: "The accounts can be read as compatible or only weakly inconsistent.",
        },
      );
    });

  analysis.missingInformation
    .slice(0, JEV_ANALYSIS_ITEM_CAP)
    .forEach((item, index) => {
      questions[`gap_${index}`] = noul(
        "Is this missing information material to understanding or proving the case?",
        {
          true: `The gap would affect a solicitor's review: ${truncateText(item.gap, 240)}`,
          false: "The gap is a nit or would not change the working case picture.",
        },
      );
    });

  let conflictQuestions = 0;
  analysis.chronology.forEach((item, chronologyIndex) => {
    item.conflicts.forEach((conflict, conflictIndex) => {
      if (conflictQuestions >= JEV_ANALYSIS_ITEM_CAP) {
        return;
      }
      questions[`conflict_${chronologyIndex}_${conflictIndex}`] = noul(
        "Is this chronology conflict a real inconsistency in the accounts?",
        {
          true: truncateText(conflict, 240),
          false: "The supposed conflict is apparent only, or not supported by the sources.",
        },
      );
      conflictQuestions += 1;
    });
  });

  return questions;
}

export function applyCaseAnalysisDecisions(
  analysis: CaseAnalysis,
  answers: Record<string, unknown>,
): CaseAnalysis {
  const next: CaseAnalysis = structuredClone(analysis);
  const completenessAnswer = asScore(answers.overallCompleteness);

  if (
    completenessAnswer &&
    completenessAnswer.confidence >= JEV_SCORE_CONFIDENCE_MIN
  ) {
    const clamped = Math.min(
      PHASE_COMPLETENESS_MAX_SCORE,
      Math.max(0, completenessAnswer.score),
    );
    next.completeness = {
      level: completenessLevelFromScore(clamped),
      score: clamped,
      confidence: completenessAnswer.confidence,
    };
  }

  next.agreedFacts = next.agreedFacts.flatMap((item, index) => {
    const probability = asNoul(answers[`agreed_${index}`]);
    if (probability == null) {
      return [item];
    }
    if (probability < JEV_NOUL_AGREE_MIN) {
      return [];
    }
    return [
      {
        ...item,
        sourcesAgree: true,
        confidence: probability,
      },
    ];
  });

  next.disputedFacts = next.disputedFacts.flatMap((item, index) => {
    const probability = asNoul(answers[`disputed_${index}`]);
    if (probability == null) {
      return [item];
    }
    if (probability < JEV_NOUL_CONTRADICTION_MIN) {
      return [];
    }
    return [
      {
        ...item,
        genuine: true,
        confidence: probability,
      },
    ];
  });

  next.missingInformation = next.missingInformation.flatMap((item, index) => {
    const probability = asNoul(answers[`gap_${index}`]);
    if (probability == null) {
      return [item];
    }
    if (probability < JEV_NOUL_MATERIAL_GAP_MIN) {
      return [];
    }
    return [
      {
        ...item,
        material: true,
        confidence: probability,
      },
    ];
  });

  next.chronology = next.chronology.map((item, chronologyIndex) => ({
    ...item,
    conflicts: item.conflicts.filter((_conflict, conflictIndex) => {
      const probability = asNoul(
        answers[`conflict_${chronologyIndex}_${conflictIndex}`],
      );
      if (probability == null) {
        return true;
      }
      return probability >= JEV_NOUL_CONFLICT_MIN;
    }),
  }));

  return next;
}

export async function evaluateCaseAnalysisDraftWithJev(params: {
  caseTitle: string;
  caseMetadata: unknown;
  statementIds: string[];
  analysis: CaseAnalysis;
}): Promise<CaseAnalysis> {
  const questions = buildCaseAnalysisQuestions(params.analysis);
  const result = await evaluateWithJev({
    purpose: "case-analysis",
    state: buildCaseAnalysisState(params),
    questions,
  });

  if (!result) {
    return params.analysis;
  }

  return applyCaseAnalysisDecisions(params.analysis, result.answers);
}
