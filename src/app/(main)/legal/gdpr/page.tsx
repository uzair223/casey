import { env } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: `GDPR Notice | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `High-level GDPR and UK data protection notice for ${env.NEXT_PUBLIC_APP_NAME}, built for legal practices handling witness statements.`,
};

export default function GdprPage() {
  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
            GDPR
          </p>
          <CardTitle className="font-display text-3xl">
            UK GDPR Notice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            {env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that
            process personal data in the context of dispute handling, witness
            statements, and legal case management. The platform supports a
            controller/processor model where the law firm remains responsible
            for the legal basis, instructions, retention decisions, and
            responses to data subject rights.
          </p>
          <p>
            At a high level, the service supports key UK GDPR obligations by
            helping firms control access to data, keep records of activity,
            limit use to legitimate legal purposes, and reduce the chance of
            unauthorized disclosure. Our aim is to provide software that fits
            within a firm’s own governance, rather than replacing it.
          </p>
          <p>
            For witness intake, the witness is shown a privacy notice before
            starting. Their acknowledgement can be stored against the witness
            statement record as evidence that the notice was presented and
            accepted before intake continued.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>UK GDPR principles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Lawfulness, fairness, and transparency</p>
            <p>Purpose limitation and data minimization</p>
            <p>Accuracy and storage limitation</p>
            <p>Integrity, confidentiality, and accountability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How {env.NEXT_PUBLIC_APP_NAME} helps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Tenant-scoped access for legal teams</p>
            <p>Magic-link controls for witness access</p>
            <p>Audit-friendly statement and submission records</p>
            <p>Configurable witness intake flows for different matters</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data subject rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Depending on the legal basis and the law firm&apos;s obligations,
            data subjects may have rights to access, rectify, erase, restrict,
            object to processing, or request portability. Requests should be
            handled by the firm that controls the relevant matter.
          </p>
          <p>
            {env.NEXT_PUBLIC_APP_NAME} is a tool used by legal professionals to
            support those processes. It is not a substitute for the firm&apos;s
            own privacy notices, record-keeping, or legal advice about
            compliance.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
