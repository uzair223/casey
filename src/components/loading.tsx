import { Loader2 } from "@/components/icons";

export default function Loading() {
  return (
    <div className="absolute inset-0 h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
