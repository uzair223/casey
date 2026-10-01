"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@/components/icons";
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
import { toast } from "@/lib/toast";
import { LeadAllowanceMeter } from "@/components/billing/lead-allowance-meter";
import {
  leadSourceText,
  useAcquisitionBoard,
} from "@/components/leads/acquisition-settings";

const ITEMS_PER_PAGE = 10;

export function TenantRoleCasesTab() {
  const { cases } = useTenant();
  const board = useAcquisitionBoard();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);

  const filtered = useMemo(() => {
    const started = (board.data?.started ?? []).map((enquiry) => ({
      kind: "started" as const,
      id: enquiry.id,
      title: "Started enquiry",
      source: enquiry.label,
      updated: enquiry.createdAt,
    }));
    const leads = cases.data.map((caseItem) => ({
      kind: "case" as const,
      id: caseItem.id,
      title: caseItem.title,
      source: leadSourceText(board.data, caseItem.statements),
      updated: caseItem.updated_at,
      caseItem,
    }));
    const rows = [...started, ...leads];
    if (!searchTerm.trim()) return rows;
    const lowerSearch = searchTerm.toLowerCase();
    return rows.filter((row) => {
      if (row.title.toLowerCase().includes(lowerSearch)) return true;
      if (row.source.toLowerCase().includes(lowerSearch)) return true;
      if (row.kind !== "case") return false;
      return row.caseItem.statements.some(
        (statement) =>
          statement.witness_name.toLowerCase().includes(lowerSearch) ||
          statement.witness_email?.toLowerCase().includes(lowerSearch),
      );
    });
  }, [board.data, cases.data, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const clampedCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCases = useMemo(() => {
    const startIndex = (clampedCurrentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, clampedCurrentPage]);

  const handleDeleteCase = async (caseId: string) => {
    const confirmed = await toast.confirm("Delete this lead?", {
      description: "This action cannot be undone.",
      confirmLabel: "Delete lead",
    });
    if (!confirmed) {
      return;
    }

    await deleteCase(caseId);
    await cases.handler();
    toast.success("Lead deleted");
  };

  if (cases.isLoading) {
    return <CardSkeleton title="Leads" />;
  }

  return (
    <div className="space-y-4">
      <LeadAllowanceMeter asCard />
      <Card>
        <CardHeader className="flex-row justify-between">
          <Dialog open={isCreateCaseOpen} onOpenChange={setIsCreateCaseOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="h-4 w-4" />
                New lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create lead</DialogTitle>
                <DialogDescription>
                  Add someone the firm already knows, or open a file before a website enquiry arrives.
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
                {searchTerm ? "No leads match your search." : "No leads yet."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Came from</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Statements</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCases.map((row) => (
                    <TableRow key={`${row.kind}-${row.id}`}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="capitalize">
                        {row.kind === "started"
                          ? "Started"
                          : (
                              row.caseItem.statements.find(
                                (statement) => statement.participant_kind === "primary",
                              )?.lead_stage ||
                              row.caseItem.status ||
                              "draft"
                            ).replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        {row.kind === "started" ? "—" : row.caseItem.statements.length}
                      </TableCell>
                      <TableCell>
                        {row.kind === "started"
                          ? "—"
                          : row.caseItem.assigned_to_ids?.length
                            ? `${row.caseItem.assigned_to_ids.length} member(s)`
                            : row.caseItem.assigned_to
                              ? "1 member"
                              : "Unassigned"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.updated).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.kind === "case" ? (
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/cases/${row.caseItem.id}`}>View lead</Link>
                            </Button>
                            <AsyncButton
                              variant="outline-destructive"
                              size="sm"
                              onClick={() => handleDeleteCase(row.caseItem.id)}
                              pendingText="Deleting..."
                            >
                              Delete lead
                            </AsyncButton>
                          </div>
                        ) : null}
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
