export function SkipLink({
  href = "#main-content",
}: {
  href?: string;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}
