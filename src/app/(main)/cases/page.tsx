"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { getStatements } from "@/lib/supabase/queries";
import {
  StatementCard,
  StatementSearch,
  CreateStatementForm,
} from "@/components/statements";
import { useAsync } from "@/hooks/useAsync";

const ITEMS_PER_PAGE = 10;

export default function StatementsPage() {
  const { isLoading: isUserLoading, user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const {
    data: statements,
    isLoading: isDataLoading,
    handler: fetchData,
  } = useAsync(
    async () => {
      if (!user || !user?.tenant_id) return;
      return await getStatements();
    },
    [user],
    { enabled: !!user?.tenant_id },
  );

  const filtered = useMemo(() => {
    if (!statements) return [];
    if (!searchTerm.trim()) return statements;

    const lowerSearch = searchTerm.toLowerCase();
    return statements.filter(
      (c) =>
        c.title.toLowerCase().includes(lowerSearch) ||
        c.reference.toLowerCase().includes(lowerSearch) ||
        c.claim_number?.toLowerCase().includes(lowerSearch) ||
        c.witness_name?.toLowerCase().includes(lowerSearch) ||
        c.witness_email?.toLowerCase().includes(lowerSearch),
    );
  }, [statements, searchTerm]);

  // Paginate filtered cases
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  if (isUserLoading || isDataLoading) {
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
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "New Case"}
        </Button>
      </div>

      {showCreateForm && (
        <CreateStatementForm
          status={null}
          onClose={() => setShowCreateForm(false)}
          fetchData={fetchData}
        />
      )}

      {/* Search and Pagination */}
      <StatementSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsShowing={paginatedCases.length}
        totalItems={filtered.length}
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
            {!searchTerm && !showCreateForm && (
              <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                Create your first case
              </Button>
            )}
          </div>
        ) : (
          paginatedCases.map((caseItem) => (
            <StatementCard
              key={caseItem.id}
              item={caseItem}
              fetchData={fetchData}
            />
          ))
        )}
      </div>
    </section>
  );
}
