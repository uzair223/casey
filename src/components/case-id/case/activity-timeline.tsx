"use client";

import { useAsync } from "@/hooks/useAsync";
import { getUnifiedActivityTimeline } from "@/lib/supabase/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CaseActivityTimelineProps = React.ComponentProps<typeof Card> & {
  caseId: string;
  refreshTrigger?: number;
  title?: string;
};

export function CaseActivityTimeline({
  caseId,
  refreshTrigger = 0,
  title = "Case activity timeline",
  ...props
}: CaseActivityTimelineProps) {
  const { data: timeline, isLoading } = useAsync(
    async () =>
      getUnifiedActivityTimeline({
        caseId,
        limit: 20,
      }),
    [caseId, refreshTrigger],
  );

  if (isLoading || !timeline) {
    return <CardSkeleton title={title} {...props} />;
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {timeline.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="line-clamp-2 text-ellipsis">
                        {event.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.type}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.actorName || event.actorUserId || "System"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No timeline events yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
