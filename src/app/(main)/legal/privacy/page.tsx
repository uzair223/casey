import { env } from "@/lib/env";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: `Privacy Policy | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `Privacy policy for ${env.NEXT_PUBLIC_APP_NAME}, including how witness statement data is handled for UK legal practices.`,
};

export default function PrivacyPage() {
  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader>
          <PageTitle subtitle="Policies" title="Privacy Policy" />
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            {env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that
            need to collect, review, and store witness statement data securely.
            Personal data is processed only to provide the service, support
            legal case handling, and meet contractual, security, and compliance
            obligations.
          </p>
          <p>
            The law firm using {env.NEXT_PUBLIC_APP_NAME} remains the controller
            for the underlying matter. {env.NEXT_PUBLIC_APP_NAME} acts as a
            processor on the firm&apos;s instructions for the data hosted in the
            platform.
          </p>
          <p>
            Access to case data is restricted to authorized users within the
            relevant tenant. We use role-based access controls, magic links,
            logging, and other security measures to reduce unauthorized access
            and to support accountability.
          </p>
          <p>
            For witness intake, we show a privacy notice before the witness can
            proceed. That acknowledgement can be recorded against the witness
            statement record so the firm can demonstrate notice was presented.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What we collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Witness identity and contact details</p>
            <p>Case references and matter metadata</p>
            <p>Statement responses, attachments, and signature files</p>
            <p>Audit metadata such as timestamps and access activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How we use data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>To guide witness intake and formalize statements</p>
            <p>To help legal teams manage matters and evidence</p>
            <p>To secure, monitor, and improve the service</p>
            <p>To support compliance and record-keeping obligations</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention and sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Data should only be retained for as long as necessary for the legal
            matter, the firm&apos;s retention policy, or other applicable legal
            obligations. We do not sell witness data. We only share data with
            service providers and legal users where that is needed to operate
            the service.
          </p>
          <p>
            If you are a witness and want to understand how your personal data
            is handled, please contact the firm that invited you. If you are a
            legal practice evaluating {env.NEXT_PUBLIC_APP_NAME}, see the
            dedicated UK GDPR notice for platform-specific guidance.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
