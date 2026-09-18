import { getServiceClient } from "../server";
import { userError } from "@/lib/api-utils/errors";
import type { Database } from "@/types";

type ProductFeedbackInsert =
  Database["public"]["Tables"]["product_feedback"]["Insert"];

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function SERVERONLY_insertProductFeedback(
  row: ProductFeedbackInsert,
) {
  const supabase = getServiceClient("SERVERONLY_insertProductFeedback");
  const { error } = await supabase.from("product_feedback").insert(row);

  if (isUniqueViolation(error)) {
    throw userError("You've already shared feedback for this statement.", 409, {
      code: "conflict",
    });
  }

  if (error) {
    throw error;
  }
}

export async function SERVERONLY_hasWitnessSurvey(statementId: string) {
  const supabase = getServiceClient("SERVERONLY_hasWitnessSurvey");
  const { data, error } = await supabase
    .from("product_feedback")
    .select("id")
    .eq("statement_id", statementId)
    .eq("source", "witness_survey")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}
