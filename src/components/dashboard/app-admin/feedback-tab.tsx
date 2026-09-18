"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/useAsync";
import { getProductFeedback } from "@/lib/supabase/queries";
import { CardSkeleton } from "../shared/skeleton";
import type { ProductFeedbackSource } from "@/types";

type SourceFilter = "all" | ProductFeedbackSource;

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sourceLabel(source: ProductFeedbackSource) {
  return source === "witness_survey" ? "Witness" : "Firm";
}

function kindLabel(kind: string) {
  if (kind === "survey") return "Survey";
  if (kind === "bug") return "Bug";
  if (kind === "idea") return "Idea";
  return kind;
}

export function AppAdminFeedbackTab() {
  const feedback = useAsync(getProductFeedback, [], { enabled: true });
  const [source, setSource] = useState<SourceFilter>("all");

  const rows = useMemo(() => {
    const items = feedback.data ?? [];
    if (source === "all") return items;
    return items.filter((item) => item.source === source);
  }, [feedback.data, source]);

  if (!feedback.data || feedback.isLoading) {
    return <CardSkeleton title="Feedback" />;
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Feedback</CardTitle>
        <Tabs
          value={source}
          onValueChange={(value) => setSource(value as SourceFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="witness_survey">Witness</TabsTrigger>
            <TabsTrigger value="firm_feedback">Firm</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No feedback yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>From</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatWhen(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sourceLabel(item.source)}</Badge>
                  </TableCell>
                  <TableCell>{kindLabel(item.kind)}</TableCell>
                  <TableCell>{item.rating ?? "—"}</TableCell>
                  <TableCell className="max-w-sm whitespace-pre-wrap text-sm">
                    {item.message || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{item.submitter_name || item.tenant_name || "—"}</div>
                    {item.submitter_name && item.tenant_name ? (
                      <div className="text-xs text-muted-foreground">
                        {item.tenant_name}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
