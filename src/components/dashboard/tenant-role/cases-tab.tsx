"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  CaseSearch,
  CreateCaseForm,
} from "@/components/dashboard/shared/cases";
import { deleteCase } from "@/lib/supabase/mutations";

const ITEMS_PER_PAGE = 10;

export function TenantRoleCasesTab() {
  const { cases } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return cases.data;

    const lowerSearch = searchTerm.toLowerCase();
    return cases.data.filter(
      (caseItem) =>
        caseItem.title.toLowerCase().includes(lowerSearch) ||
        caseItem.statements.some(
          (statement) =>
            statement.witness_name.toLowerCase().includes(lowerSearch) ||
            statement.witness_email?.toLowerCase().includes(lowerSearch),
        ),
    );
  }, [cases.data, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const clampedCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCases = useMemo(() => {
    const startIndex = (clampedCurrentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, clampedCurrentPage]);

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm("Are you sure you want to delete this case?")) {
      return;
    }

    await deleteCase(caseId);
    await cases.handler();
  };

  if (cases.isLoading) {
    return <CardSkeleton title="Cases" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row justify-between">
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
                  Create a new case and assign the right team members.
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
          <div className="min-h-48 border-b">
            {paginatedCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "No cases match your search." : "No cases found."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Statements</TableHead>
                    <TableHead>Assigned</TableHead>
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
                      <TableCell>
                        {caseItem.assigned_to_ids?.length
                          ? `${caseItem.assigned_to_ids.length} member(s)`
                          : caseItem.assigned_to
                            ? "1 member"
                            : "Unassigned"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(caseItem.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/cases/${caseItem.id}`}>
                              View case
                            </Link>
                          </Button>
                          <AsyncButton
                            variant="outline-destructive"
                            size="sm"
                            onClick={() => handleDeleteCase(caseItem.id)}
                            pendingText="Deleting..."
                          >
                            Delete case
                          </AsyncButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <CaseSearch
            searchTerm={searchTerm}
            onSearchChange={(term) => {
              setSearchTerm(term);
              setCurrentPage(1);
            }}
            currentPage={clampedCurrentPage}
            totalPages={totalPages}
            itemsShowing={paginatedCases.length}
            totalItems={filtered.length}
            onPreviousPage={() =>
              setCurrentPage((prev) => Math.max(1, prev - 1))
            }
            onNextPage={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
