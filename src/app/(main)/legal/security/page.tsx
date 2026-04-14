import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: `Security | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: `Security information for ${process.env.NEXT_PUBLIC_APP_NAME}, including access controls and data protection for UK legal practices.`,
};

export default function SecurityPage() {
  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            Security
          </p>
          <CardTitle className="font-display text-3xl">
            Security Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            {process.env.NEXT_PUBLIC_APP_NAME} uses tenant-scoped access
            controls so only authorized users can view and manage case records.
            Witness links are time-bound and tied to a specific statement
            record.
          </p>
          <p>
            We design the platform to use secure defaults, role-based access,
            and server-side checks for sensitive actions. Logging and audit
            trails help us trace statement activity and administrative changes.
          </p>
          <p>
            No system is perfectly secure, but we work to keep the platform
            resilient and to minimize unauthorized exposure of personal data.
          </p>
          <p>
            Sensitive witness actions are protected by tokenized links, tenant
            validation, and server-side persistence rules. This helps prevent
            cross-tenant access and reduces the chance of accidental disclosure
            in multi-matter environments.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Security controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Role-based access for legal teams and admins</p>
            <p>Tenant-scoped queries and storage access</p>
            <p>Magic links for witness access with expiry controls</p>
            <p>Server-side validation for high-risk workflows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Keep software dependencies up to date</p>
            <p>Review access regularly within each legal practice</p>
            <p>Use strong credentials and least-privilege roles</p>
            <p>Monitor logs for unusual statement or account activity</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>High-level expectations for legal practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Legal practices should ensure their own policies cover information
            security, retention, staff training, and incident response.{" "}
            {process.env.NEXT_PUBLIC_APP_NAME} is a tool that supports those
            obligations, not a replacement for them.
          </p>
          <p>
            Practices should confirm their own legal bases, notices, and
            retention schedules before using the service in live matters.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
