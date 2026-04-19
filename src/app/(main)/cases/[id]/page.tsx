"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useUserProtected } from "@/contexts/user-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sidebar, SidebarWrapper } from "@/components/ui/sidebar";
import { ChevronLeftIcon, PenIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { getCaseTemplateById } from "@/lib/supabase/queries/case-template";

import {
  CaseActivityTimeline,
  CaseInternalDocumentsCard,
  CaseNotesCard,
  CreateStatementForm,
  EditCaseForm,
  StatementDetailPanel,
} from "@/components/case-id";

import { AsyncButton } from "@/components/ui/async-button";
import { getCaseById } from "@/lib/supabase/queries";
import { deleteCase } from "@/lib/supabase/mutations";
import {
  statementStatusLabel,
  statementStatusVariant,
} from "@/lib/status-styles";
import Link from "next/link";
import Loading from "@/components/loading";
import { useTenant } from "@/contexts/tenant-context";

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const { user } = useUserProtected(["paralegal", "solicitor", "tenant_admin"]);
  const { team, cases } = useTenant();

  const {
    data,
    isLoading: isDataLoading,
    handler: refreshCase,
  } = useAsync(async () => {
    if (!caseId) return null;
    return await getCaseById(caseId);
  }, [caseId]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [newWitnessStatus, setNewWitnessStatus] = useState<string | null>(null);
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);

  const [isEditingCase, setIsEditingCase] = useState(false);
  const [isAddWitnessOpen, setIsAddWitnessOpen] = useState(false);

  const { data: caseTemplate } = useAsync(
    async () => {
      if (!data?.case_template_id) return null;
      return await getCaseTemplateById(data.case_template_id);
    },
    [data?.case_template_id],
    { enabled: !!data?.case_template_id },
  );

  const assigneeIds = Array.from(
    new Set([
      ...(data?.assigned_to_ids || []),
      ...(data?.assigned_to ? [data.assigned_to] : []),
    ]),
  );
  const assignedSummary =
    assigneeIds.length === 0
      ? "Unassigned"
      : assigneeIds.length <= 2
        ? assigneeIds.map((id) => team.data?.nameMap?.[id] || id).join(", ")
        : `${assigneeIds
            .slice(0, 2)
            .map((id) => team.data?.nameMap?.[id] || id)
            .join(", ")} +${assigneeIds.length - 2} more`;

  const activeStatementId = searchParams.get("statement");
  const activeStatement =
    data?.statements.find((statement) => statement.id === activeStatementId) ??
    data?.statements[0] ??
    null;

  useEffect(() => {
    if (!data?.statements.length) return;
    if (
      activeStatementId &&
      data.statements.some((statement) => statement.id === activeStatementId)
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("statement", data?.statements[0].id);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeStatementId, pathname, router, searchParams, data?.statements]);

  const handleSelectStatement = (statementId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("statement", statementId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCaseSaved = async () => {
    setSaveStatus("Case updated");
    setIsEditingCase(false);
    setTimelineRefreshTrigger((prev) => prev + 1);
    await refreshCase();
  };

  const handleWitnessCreated = async () => {
    setNewWitnessStatus("Witness statement created and link sent");
    setTimelineRefreshTrigger((prev) => prev + 1);
    await refreshCase();
  };

  const handleDeleteCase = async () => {
    if (!data) return;
    if (
      !confirm(
        "Are you sure you want to delete this case? This will remove all witness statements and cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await deleteCase(data.id);
      router.push("/dashboard?tab=cases");
      await cases.handler();
    } finally {
    }
  };

  if (!user?.tenant_id || !data || isDataLoading) {
    return <Loading />;
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{data.case_template_name}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" asChild>
              <Link href="/dashboard?tab=cases">
                <ChevronLeftIcon />
                <span className="sr-only">Back to cases</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSaveStatus(null);
                setIsEditingCase((prev) => !prev);
              }}
            >
              {<PenIcon className="h-4 w-4" />}
              <span className="max-md:sr-only">
                {isEditingCase ? "Cancel" : "Edit case"}
              </span>
            </Button>

            <AsyncButton
              variant="outline-destructive"
              size="sm"
              onClick={handleDeleteCase}
              pendingText="Deleting case..."
            >
              <Trash2Icon className="h-4 w-4" />
              <span className="max-md:sr-only">Delete case</span>
            </AsyncButton>

            <Dialog open={isAddWitnessOpen} onOpenChange={setIsAddWitnessOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setNewWitnessStatus(null)}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add witness
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add witness statement</DialogTitle>
                  <DialogDescription>
                    Fill out the details for the new witness statement.
                  </DialogDescription>
                </DialogHeader>
                <CreateStatementForm
                  caseData={data}
                  onClose={() => setIsAddWitnessOpen(false)}
                  onCreated={handleWitnessCreated}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {isEditingCase ? (
            <EditCaseForm
              caseData={data}
              caseTemplateConfig={caseTemplate?.published_config || null}
              onClose={() => setIsEditingCase(false)}
              onSaved={handleCaseSaved}
            />
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Case name
                  </p>
                  <p className="text-sm">{data.title || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Assigned team members
                  </p>
                  <p className="text-sm">{assignedSummary}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <Badge variant="outline" className="capitalize">
                    {data.status?.replace("_", " ") || "draft"}
                  </Badge>
                </div>
                {saveStatus ? (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    {saveStatus}
                  </p>
                ) : null}
                {newWitnessStatus ? (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    {newWitnessStatus}
                  </p>
                ) : null}
              </div>
              {/* Case metadata fields */}
              {caseTemplate?.published_config?.dynamicFields?.length ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">Case metadata</h3>
                  <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
                    {caseTemplate.published_config.dynamicFields.map(
                      (field) => (
                        <div key={field.id}>
                          <p className="text-sm font-medium text-muted-foreground">
                            {field.label}
                          </p>
                          <p className="text-sm">
                            {data.case_metadata?.[field.id] == null
                              ? "-"
                              : String(data.case_metadata[field.id])}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <SidebarWrapper>
        <Sidebar
          title="Witnesses"
          count={data.statements.length}
          actions={[
            {
              label: (
                <>
                  <PlusIcon className="h-4 w-4" />
                  Add witness
                </>
              ),
              onClick: () => setIsAddWitnessOpen(true),
            },
          ]}
          items={data.statements}
          activeItemId={activeStatement?.id ?? null}
          getItemId={(statement) => statement.id}
          onSelectItem={(statement) => handleSelectStatement(statement.id)}
          emptyMessage="No witness statements have been added yet."
          renderItem={(statement) => {
            const config = (
              statement as { statement_config?: { name?: string } | null }
            ).statement_config || { name: "Statement" };

            return (
              <div className="flex w-full flex-col items-start gap-1">
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {statement.witness_name || "Unnamed witness"}
                  </span>
                  <Badge variant={statementStatusVariant[statement.status]}>
                    {statementStatusLabel[statement.status]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {statement.witness_email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {config.name}
                </span>
              </div>
            );
          }}
        />

        {activeStatement ? (
          <StatementDetailPanel
            key={activeStatement.id}
            statementId={activeStatement.id}
            refreshCase={refreshCase}
          />
        ) : (
          <Card className="min-h-96">
            <CardHeader>
              <CardTitle className="text-base">Statement details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Select a witness from the sidebar to view and edit their
                statement.
              </p>
            </CardContent>
          </Card>
        )}
      </SidebarWrapper>

      <CaseInternalDocumentsCard
        size="md"
        caseId={data.id}
        tenantId={data.tenant_id}
      />

      <CaseNotesCard
        size="md"
        caseId={data.id}
        canPinNotes={["tenant_admin", "solicitor"].includes(user.role)}
      />

      <CaseActivityTimeline
        size="md"
        caseId={data.id}
        refreshTrigger={timelineRefreshTrigger}
      />
    </section>
  );
}
