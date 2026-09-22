import { cn } from "@/lib/utils";

const C_PATH =
  "M379 162C342 112 286 91 221 96C132 103 72 162 72 254C72 344 133 402 225 409C295 414 350 389 384 334";
const TAIL_PATH = "M103 331L76 428L176 397L141 363L103 331Z";

export function BrandMarkGlyph() {
  return (
    <>
      <path
        d={C_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={TAIL_PATH} fill="currentColor" />
      <path
        d="M174 211H254"
        stroke="currentColor"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 258H309"
        stroke="currentColor"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M174 305H252"
        stroke="currentColor"
        strokeWidth="25"
        strokeLinecap="round"
      />
    </>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-10 w-10 text-foreground", className)}
      aria-hidden
    >
      <BrandMarkGlyph />
    </svg>
  );
}
