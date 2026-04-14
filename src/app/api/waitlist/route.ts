import { getServiceClient } from "@/lib/supabase/server";
import { WaitlistSignupSchema } from "@/lib/schema";
import { badRequest, ok, serverError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = WaitlistSignupSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ||
          "Name, company name, and email are required.",
      );
    }

    const { name, companyName, email } = parsed.data;

    const supabase = getServiceClient();

    const { error } = await supabase.from("waitlist_signups").upsert(
      {
        full_name: name,
        company_name: companyName,
        email,
      },
      { onConflict: "email" },
    );

    if (error) {
      throw error;
    }

    return ok({
      success: true,
      message: "Thanks, you are on the waitlist.",
    });
  } catch (error) {
    return serverError(error);
  }
}
