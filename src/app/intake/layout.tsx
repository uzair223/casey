import { SkipLink } from "@/components/skip-link";

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <main id="main-content">{children}</main>
    </>
  );
}
