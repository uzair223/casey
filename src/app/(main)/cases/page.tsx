"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import {
  CaseWithWitness,
  getCases,
  createCase,
  updateCase,
  deleteCase,
  regenerateMagicLink,
  type CaseCreatePayload,
  type CaseUpdatePayload,
} from "@/lib/supabase/queries/cases";
import { CaseCard, CaseSearch, NewCaseForm } from "@/components/cases";
import type { ProfileWithEmail } from "@/lib/supabase/queries/team";
import type { StatementStatus } from "@/lib/types";
import { apiFetch } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

export default function CasesPage() {
  const { isLoading, user } = useUser();
  const [cases, setCases] = useState<CaseWithWitness[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  // New case form state
  const [newCaseForm, setNewCaseForm] = useState({
    title: "",
    reference: "",
    claimNumber: "",
    witnessName: "",
    witnessAddress: "",
    witnessOccupation: "",
    witnessEmail: "",
    incidentDate: "",
    assignedTo: "",
  });

  // Edit case form state
  const [editCaseForm, setEditCaseForm] = useState({
    title: "",
    reference: "",
    claimNumber: "",
    witnessName: "",
    witnessAddress: "",
    witnessOccupation: "",
    witnessEmail: "",
    incidentDate: "",
    status: "draft" as StatementStatus,
    assignedTo: "",
  });

  const fetchData = async () => {
    if (!user || !user?.tenant_id) return;

    try {
      const [casesData, membersData] = await Promise.all([
        getCases(user.tenant_id, user.id, user.role),
        apiFetch<{ members: ProfileWithEmail[] }>("/api/team/members"),
      ]);

      setCases(casesData);
      setTeamMembers(membersData.members);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      fetchData();
    }
  }, [isLoading, user]);

  // Filter cases based on search term
  const filteredCases = useMemo(() => {
    if (!searchTerm.trim()) return cases;

    const lowerSearch = searchTerm.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(lowerSearch) ||
        c.reference.toLowerCase().includes(lowerSearch) ||
        c.claim_number?.toLowerCase().includes(lowerSearch) ||
        c.witness_name?.toLowerCase().includes(lowerSearch) ||
        c.witness_email?.toLowerCase().includes(lowerSearch),
    );
  }, [cases, searchTerm]);

  // Paginate filtered cases
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCases, currentPage]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCases.length / ITEMS_PER_PAGE),
  );

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !user?.tenant_id) return;

    try {
      const payload: CaseCreatePayload = {
        title: newCaseForm.title,
        reference: newCaseForm.reference,
        claimNumber: newCaseForm.claimNumber || null,
        witnessName: newCaseForm.witnessName,
        witnessAddress: newCaseForm.witnessAddress || null,
        witnessOccupation: newCaseForm.witnessOccupation || null,
        witnessEmail: newCaseForm.witnessEmail,
        incidentDate: newCaseForm.incidentDate || null,
        assignedTo: newCaseForm.assignedTo || null,
      };

      await createCase(payload, user.id, user.tenant_id, user.role);

      setNewCaseForm({
        title: "",
        reference: "",
        claimNumber: "",
        witnessName: "",
        witnessAddress: "",
        witnessOccupation: "",
        witnessEmail: "",
        incidentDate: "",
        assignedTo: "",
      });
      setShowNewCaseForm(false);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create case");
    }
  };

  const handleStartEdit = (caseItem: CaseWithWitness) => {
    setEditingCaseId(caseItem.id);
    setEditCaseForm({
      title: caseItem.title,
      reference: caseItem.reference,
      claimNumber: caseItem.claim_number || "",
      witnessName: caseItem.witness_name || "",
      witnessAddress: caseItem.witness_address || "",
      witnessOccupation: caseItem.witness_occupation || "",
      witnessEmail: caseItem.witness_email || "",
      incidentDate: caseItem.incident_date || "",
      status: caseItem.statement_status || "draft",
      assignedTo: caseItem.assigned_to || "",
    });
  };

  const handleSaveEdit = async (caseId: string) => {
    if (!user || !user?.tenant_id) return;

    try {
      const payload: CaseUpdatePayload = {
        title: editCaseForm.title,
        reference: editCaseForm.reference,
        claimNumber: editCaseForm.claimNumber || null,
        witnessName: editCaseForm.witnessName,
        witnessAddress: editCaseForm.witnessAddress || null,
        witnessOccupation: editCaseForm.witnessOccupation || null,
        witnessEmail: editCaseForm.witnessEmail,
        incidentDate: editCaseForm.incidentDate || null,
        status: editCaseForm.status,
        assignedTo: editCaseForm.assignedTo || null,
      };

      await updateCase(
        caseId,
        payload,
        user.id,
        user.tenant_id,
        user.role,
        teamMembers,
      );

      setEditingCaseId(null);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update case");
      throw error;
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!user || !user?.tenant_id) return;
    if (!confirm("Are you sure you want to delete this case?")) return;

    try {
      await deleteCase(caseId, user.id, user.tenant_id, user.role);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete case");
      throw error;
    }
  };

  const handleSendStatementLink = async (caseId: string) => {
    try {
      await apiFetch(`/api/cases/${caseId}/send-link`, {
        method: "POST",
      });
      alert("Statement link sent successfully!");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to send statement link",
      );
      throw error;
    }
  };

  const handleRegenerateLink = async (caseItem: CaseWithWitness) => {
    if (!user?.tenant_id) return;
    if (
      !confirm(
        "This will invalidate the old link. Are you sure you want to regenerate?",
      )
    )
      return;

    try {
      const newToken = await regenerateMagicLink(caseItem.id, user.tenant_id);
      alert("Magic link regenerated successfully!");
      fetchData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to regenerate magic link",
      );
      throw error;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading cases...</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            {user?.role?.replace("_", " ")}
          </p>
          <h1 className="text-3xl font-semibold text-primary">Cases</h1>
          <p className="mt-2 text-muted-foreground">
            Manage witness statements and case information.
          </p>
        </div>
        <Button onClick={() => setShowNewCaseForm(!showNewCaseForm)}>
          {showNewCaseForm ? "Cancel" : "New Case"}
        </Button>
      </div>

      {/* New Case Form */}
      {showNewCaseForm && (
        <NewCaseForm
          isOpen={showNewCaseForm}
          status={null}
          role={user?.role || null}
          form={newCaseForm}
          teamMembers={teamMembers}
          onFormChange={(updates) =>
            setNewCaseForm((prev) => ({ ...prev, ...updates }))
          }
          onSubmit={handleCreateCase}
          onClose={() => setShowNewCaseForm(false)}
        />
      )}

      {/* Search and Pagination */}
      <CaseSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsShowing={paginatedCases.length}
        totalItems={filteredCases.length}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() =>
          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
        }
      />

      {/* Cases List */}
      <div className="space-y-4">
        {paginatedCases.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {searchTerm ? "No cases match your search." : "No cases found."}
            </p>
            {!searchTerm && !showNewCaseForm && (
              <Button className="mt-4" onClick={() => setShowNewCaseForm(true)}>
                Create your first case
              </Button>
            )}
          </div>
        ) : (
          paginatedCases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              item={caseItem}
              isEditing={editingCaseId === caseItem.id}
              role={user?.role || null}
              currentuser_id={user?.id || null}
              teamMembers={teamMembers}
              editForm={editCaseForm}
              onEditFormChange={(updates) =>
                setEditCaseForm((prev) => ({ ...prev, ...updates }))
              }
              onStartEdit={() => handleStartEdit(caseItem)}
              onCancelEdit={() => setEditingCaseId(null)}
              onSave={() => handleSaveEdit(caseItem.id)}
              onDelete={() => handleDeleteCase(caseItem.id)}
              onSendStatementLink={() => handleSendStatementLink(caseItem.id)}
              onRegenerateLink={() => handleRegenerateLink(caseItem)}
              progress={caseItem.progress}
              flaggedDeviation={caseItem.flaggedDeviation}
              deviationReason={caseItem.deviationReason}
            />
          ))
        )}
      </div>
    </section>
  );
}
