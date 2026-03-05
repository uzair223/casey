import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { WaitlistSignupSchema } from "@/lib/schema";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = WaitlistSignupSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Name, company name, and email are required.",
        },
        { status: 400 },
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

    return NextResponse.json({
      success: true,
      message: "Thanks, you are on the waitlist.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to join waitlist";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
