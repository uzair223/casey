import { getSupabaseClient } from "../client";
import type { ProductFeedback, ProductFeedbackEntry } from "@/types";

type FeedbackJoinRow = ProductFeedback & {
  tenants?: { name: string } | null;
  profiles?: { display_name: string | null; role: string | null } | null;
};

export async function getProductFeedback(): Promise<ProductFeedbackEntry[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("product_feedback")
    .select(
      "*, tenants(name), profiles!product_feedback_submitted_by_user_id_fkey(display_name, role)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FeedbackJoinRow[]).map((row) => {
    const { tenants, profiles, ...feedback } = row;
    return {
      ...feedback,
      tenant_name: tenants?.name ?? null,
      submitter_name: profiles?.display_name ?? null,
      submitter_role: profiles?.role ?? null,
    };
  });
}
