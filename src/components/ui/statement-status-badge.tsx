import { Sparkles } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  statementStatusLabel,
  statementStatusVariant,
  visibleStatementStatus,
} from "@/lib/status-styles";

export function StatementStatusBadge({
  status,
  witnessMetadata,
}: {
  status: string;
  witnessMetadata?: unknown;
}) {
  const visible = visibleStatementStatus({
    status,
    witness_metadata: witnessMetadata,
  });

  return (
    <Badge variant={statementStatusVariant[visible]} className="gap-1">
      {visible === "extracted" ? <Sparkles className="size-3" /> : null}
      {statementStatusLabel[visible]}
    </Badge>
  );
}
