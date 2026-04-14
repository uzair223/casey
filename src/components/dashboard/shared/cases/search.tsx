"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CaseSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  currentPage: number;
  totalPages: number;
  itemsShowing: number;
  totalItems: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function CaseSearch({
  searchTerm,
  onSearchChange,
  currentPage,
  totalPages,
  itemsShowing,
  totalItems,
  onPreviousPage,
  onNextPage,
}: CaseSearchProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Label htmlFor="caseSearch">Search cases</Label>
          <Input
            id="caseSearch"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Case name or witness"
            className="max-w-md"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {itemsShowing} of {totalItems} cases
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
