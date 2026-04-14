"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/contexts/tenant-context";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";
import { useUser } from "@/contexts/user-context";

export function ParalegalCasesTab() {
  const { user } = useUser();
  const { cases } = useTenant();

  if (cases.isLoading) {
    return <CardSkeleton title="Assigned Cases" />;
  }

  const assignedCases = cases.data
    .filter((caseItem) => {
      return (
        caseItem.assigned_to === user!.id ||
        (caseItem.assigned_to_ids || []).includes(user!.id)
      );
    })
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned Cases</CardTitle>
      </CardHeader>
      <CardContent>
        {assignedCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cases are assigned to you.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Statements</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedCases.map((caseItem) => (
                <TableRow key={caseItem.id}>
                  <TableCell className="font-medium">
                    {caseItem.title}
                  </TableCell>
                  <TableCell className="capitalize">
                    {(caseItem.status || "draft").replace("_", " ")}
                  </TableCell>
                  <TableCell>{caseItem.statements.length}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(caseItem.updated_at).toLocaleString()}
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
