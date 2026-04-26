"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  CaseSearch,
  CreateCaseForm,
} from "@/components/dashboard/shared/cases";

const ITEMS_PER_PAGE = 10;

export function ParalegalCasesTab() {
  const { user } = useUser();
  const { cases } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);

  const assignedCases = useMemo(
    () =>
      cases.data
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
        ),
    [cases.data, user],
  );

  const filteredCases = useMemo(() => {
    if (!searchTerm.trim()) return assignedCases;

    const lowerSearch = searchTerm.toLowerCase();
    return assignedCases.filter(
      (caseItem) =>
        caseItem.title.toLowerCase().includes(lowerSearch) ||
        caseItem.statements.some(
          (statement) =>
            statement.witness_name.toLowerCase().includes(lowerSearch) ||
            statement.witness_email?.toLowerCase().includes(lowerSearch),
        ),
    );
  }, [assignedCases, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / ITEMS_PER_PAGE));
  const clampedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCases = useMemo(() => {
    const startIndex = (clampedCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [clampedCurrentPage, filteredCases]);

  if (cases.isLoading) {
    return <CardSkeleton title="Assigned Cases" />;
  }

  return (
    <Card>
      <CardHeader className="flex-row justify-between">
        <CardTitle>Assigned Cases</CardTitle>
        <Dialog open={isCreateCaseOpen} onOpenChange={setIsCreateCaseOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4" />
              New case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create case</DialogTitle>
              <DialogDescription>
                Create a new case. It will be assigned to you automatically.
              </DialogDescription>
            </DialogHeader>
            <CreateCaseForm
              onClose={() => setIsCreateCaseOpen(false)}
              onCreated={async () => {
                await cases.handler();
                setIsCreateCaseOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {paginatedCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {searchTerm
              ? "No assigned cases match your search."
              : "No cases are assigned to you."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Statements</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCases.map((caseItem) => (
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
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/cases/${caseItem.id}`}>View case</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <CaseSearch
          searchTerm={searchTerm}
          onSearchChange={(term) => {
            setSearchTerm(term);
            setCurrentPage(1);
          }}
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          itemsShowing={paginatedCases.length}
          totalItems={filteredCases.length}
          onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
        />
      </CardContent>
    </Card>
  );
}
