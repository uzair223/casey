"use client";

import { useEffect } from "react";
import { AlertTriangle, BrainCircuit, Sparkles } from "lucide-react";

import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils/fetch";
import {
  getLatestCaseAnalysis,
  getLatestCaseAnalysisGenerationJob,
} from "@/lib/supabase/queries";
import type { CaseAnalysis, CaseAnalysisSourceRef } from "@/lib/schema";
import type { CaseStatementJoin } from "@/types";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast";

type CaseAnalysisCardProps = React.ComponentProps<typeof Card> & {
  caseId: string;
  statements: CaseStatementJoin["statements"];
};

function isAnalysisStale(
  snapshot: Awaited<ReturnType<typeof getLatestCaseAnalysis>>,
  statements: CaseStatementJoin["statements"],
) {
  if (!snapshot) {
    return false;
  }

  const analysedVersions = new Map(
    snapshot.source_statement_versions.map((version) => [
      version.statementId,
      version.updatedAt,
    ]),
  );
  const statementsWithPotentialContent = statements.filter(
    (statement) => statement.status !== "draft",
  );

  if (analysedVersions.size !== statementsWithPotentialContent.length) {
    return true;
  }

  return statementsWithPotentialContent.some(
    (statement) => analysedVersions.get(statement.id) !== statement.updated_at,
  );
}

function SourceList({ sources }: { sources: CaseAnalysisSourceRef[] }) {
  const uniqueStatementSources = Array.from(
    new Map(
      sources.map((source) => [source.statementId, source] as const),
    ).values(),
  );
  const uniqueEvidenceSources = Array.from(
    new Map(
      sources
        .filter((source) => source.exhibitId || source.evidenceName)
        .map((source) => [
          `${source.exhibitId ?? ""}:${source.evidenceName ?? ""}`,
          source,
        ]),
    ).values(),
  );

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {uniqueStatementSources.slice(0, 4).map((source) => (
        <Badge key={source.statementId} variant="secondary">
          {source.witnessName}
        </Badge>
      ))}
      {uniqueStatementSources.length > 4 ? (
        <Badge variant="outline">
          +{uniqueStatementSources.length - 4} more
        </Badge>
      ) : null}
      {uniqueEvidenceSources.slice(0, 3).map((source) => (
        <Badge
          key={`${source.exhibitId ?? ""}:${source.evidenceName ?? ""}`}
          variant="outline"
          title={source.evidenceName ?? undefined}
        >
          {source.exhibitId
            ? `Exhibit ${source.exhibitId}`
            : source.evidenceName}
        </Badge>
      ))}
      {uniqueEvidenceSources.length > 3 ? (
        <Badge variant="outline">
          +{uniqueEvidenceSources.length - 3} docs
        </Badge>
      ) : null}
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

function SummaryTab({ analysis }: { analysis: CaseAnalysis }) {
  const stats = [
    { label: "Shared facts", value: analysis.agreedFacts.length },
    { label: "Conflicts", value: analysis.disputedFacts.length },
    { label: "Open gaps", value: analysis.missingInformation.length },
    { label: "Evidence", value: analysis.evidenceMentioned.length },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        {analysis.executiveSummary}
      </p>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-md border px-3 py-2">
            <p className="text-lg font-semibold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChronologyTab({ analysis }: { analysis: CaseAnalysis }) {
  if (!analysis.chronology.length) {
    return <EmptySection label="No chronology items were identified." />;
  }

  return (
    <div className="space-y-3">
      {analysis.chronology.map((item, index) => (
        <div key={`${item.event}-${index}`} className="rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium">{item.event}</p>
            {item.dateOrTime ? (
              <Badge variant="outline">{item.dateOrTime}</Badge>
            ) : null}
          </div>
          <SourceList sources={item.sources} />
          {item.conflicts.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {item.conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FactsTab({ analysis }: { analysis: CaseAnalysis }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Agreed facts</h3>
        {analysis.agreedFacts.length ? (
          analysis.agreedFacts.map((item, index) => (
            <div
              key={`${item.fact}-${index}`}
              className="rounded-md border p-3"
            >
              <p className="text-sm">{item.fact}</p>
              <SourceList sources={item.sources} />
            </div>
          ))
        ) : (
          <EmptySection label="No shared facts were identified." />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          Disputed or inconsistent facts
        </h3>
        {analysis.disputedFacts.length ? (
          analysis.disputedFacts.map((item, index) => (
            <div
              key={`${item.issue}-${index}`}
              className="rounded-md border p-3"
            >
              <p className="text-sm font-medium">{item.issue}</p>
              <div className="mt-2 space-y-2">
                {item.positions.map((position, positionIndex) => (
                  <div
                    key={`${position.summary}-${positionIndex}`}
                    className="rounded-md bg-muted/40 p-2"
                  >
                    <p className="text-sm text-muted-foreground">
                      {position.summary}
                    </p>
                    <SourceList sources={position.sources} />
                  </div>
                ))}
              </div>
              {item.suggestedFollowUps.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {item.suggestedFollowUps.map((followUp) => (
                    <li key={followUp}>{followUp}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        ) : (
          <EmptySection label="No conflicts were identified." />
        )}
      </div>
    </div>
  );
}

function GapsTab({ analysis }: { analysis: CaseAnalysis }) {
  if (!analysis.missingInformation.length) {
    return <EmptySection label="No missing information was identified." />;
  }

  return (
    <div className="space-y-3">
      {analysis.missingInformation.map((item, index) => (
        <div key={`${item.gap}-${index}`} className="rounded-md border p-3">
          <p className="text-sm font-medium">{item.gap}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.whyItMatters}
          </p>
          {item.suggestedFollowUps.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {item.suggestedFollowUps.map((followUp) => (
                <li key={followUp}>{followUp}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EvidenceTab({ analysis }: { analysis: CaseAnalysis }) {
  if (!analysis.evidenceMentioned.length && !analysis.caseThemes.length) {
    return <EmptySection label="No evidence or themes were identified." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Evidence mentioned</h3>
        {analysis.evidenceMentioned.length ? (
          analysis.evidenceMentioned.map((item, index) => (
            <div
              key={`${item.evidence}-${index}`}
              className="rounded-md border p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm">{item.evidence}</p>
                <Badge variant="outline">
                  {item.uploadedOrAvailable === null
                    ? "Availability unclear"
                    : item.uploadedOrAvailable
                      ? "Available"
                      : "Not uploaded"}
                </Badge>
              </div>
              <SourceList sources={item.mentionedBy} />
            </div>
          ))
        ) : (
          <EmptySection label="No evidence references were identified." />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Case themes</h3>
        {analysis.caseThemes.length ? (
          analysis.caseThemes.map((item, index) => (
            <div
              key={`${item.theme}-${index}`}
              className="rounded-md border p-3"
            >
              <p className="text-sm font-medium">{item.theme}</p>
              {item.supportingFacts.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {item.supportingFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : null}
              {item.weaknesses.length ? (
                <div className="mt-3 rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Weaknesses
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {item.weaknesses.map((weakness) => (
                      <li key={weakness}>{weakness}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptySection label="No case themes were identified." />
        )}
      </div>
    </div>
  );
}

export function CaseAnalysisCard({
  caseId,
  statements,
  ...props
}: CaseAnalysisCardProps) {
  const {
    data: snapshot,
    isLoading,
    handler: refreshAnalysis,
  } = useAsync(async () => getLatestCaseAnalysis(caseId), [caseId], {
    withUseEffect: true,
  });
  const { data: latestJob, handler: refreshLatestJob } = useAsync(
    async () => getLatestCaseAnalysisGenerationJob(caseId),
    [caseId],
    {
      withUseEffect: true,
    },
  );

  const isGenerating =
    latestJob?.status === "queued" || latestJob?.status === "running";

  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const interval = window.setInterval(async () => {
      const job = await refreshLatestJob();
      if (job?.status === "succeeded") {
        await refreshAnalysis();
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isGenerating, refreshAnalysis, refreshLatestJob]);

  const onGenerate = async () => {
    await apiFetch(`/api/tenant/case/${caseId}/analysis`, {
      method: "POST",
    });
    toast.success("Case facts generation queued");
    await refreshLatestJob();
  };

  if (isLoading) {
    return <CardSkeleton title="Facts & gaps" {...props} />;
  }

  const stale = isAnalysisStale(snapshot ?? null, statements);

  return (
    <Card {...props}>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4" />
            Facts & gaps
          </CardTitle>
          {snapshot ? (
            <p className="text-xs text-muted-foreground">
              Generated {new Date(snapshot.created_at).toLocaleString()} from{" "}
              {snapshot.source_statement_ids.length} statement
              {snapshot.source_statement_ids.length === 1 ? "" : "s"}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Generate a case-level view across witness statements.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {stale ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Stale
            </Badge>
          ) : null}
          {isGenerating ? (
            <Badge variant="secondary">
              {latestJob?.status === "queued" ? "Queued" : "Generating"}
            </Badge>
          ) : latestJob?.status === "failed" ? (
            <Badge variant="destructive">Generation failed</Badge>
          ) : null}
          <AsyncButton
            size="sm"
            variant={snapshot ? "outline" : "default"}
            onClick={onGenerate}
            disabled={isGenerating}
            pendingText={snapshot ? "Queueing..." : "Queueing..."}
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Queued" : snapshot ? "Regenerate" : "Generate"}
          </AsyncButton>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {snapshot ? (
          <div className="space-y-4">
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="chronology">Chronology</TabsTrigger>
                <TabsTrigger value="facts">Facts</TabsTrigger>
                <TabsTrigger value="gaps">Gaps</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
              </TabsList>
              <TabsContent value="summary">
                <SummaryTab analysis={snapshot.analysis} />
              </TabsContent>
              <TabsContent value="chronology">
                <ChronologyTab analysis={snapshot.analysis} />
              </TabsContent>
              <TabsContent value="facts">
                <FactsTab analysis={snapshot.analysis} />
              </TabsContent>
              <TabsContent value="gaps">
                <GapsTab analysis={snapshot.analysis} />
              </TabsContent>
              <TabsContent value="evidence">
                <EvidenceTab analysis={snapshot.analysis} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              Casey will compile all available witness statement sections into a
              sourced chronology, shared facts, inconsistencies, evidence
              mentions, and follow-up gaps.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
