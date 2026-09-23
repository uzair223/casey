const password = process.env.APP_ADMIN_PASSWORD?.trim();
const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM?.trim();

if (!password) {
  console.log("APP_ADMIN_PASSWORD unset; admin email skipped.");
  process.exit(0);
}

if (!apiKey || !from) {
  console.error("Resend is not configured, so the admin password was not emailed.");
  process.exit(1);
}

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: ["uzair@caseyhq.co.uk"],
    subject: "Casey app admin sign-in",
    text: [
      "Sign in at https://caseyhq.co.uk",
      "",
      "Email: uzair@caseyhq.co.uk",
      `Password: ${password}`,
      "",
      "This mailbox is the only copy. It is not stored in the repository.",
    ].join("\n"),
  }),
});

if (!response.ok) {
  console.error(`Admin password email failed with status ${response.status}.`);
  process.exit(1);
}

console.log("Emailed the app admin password to uzair@caseyhq.co.uk.");
