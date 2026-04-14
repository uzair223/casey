import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="absolute inset-0 h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={24} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
