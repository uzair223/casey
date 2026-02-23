"use client";

import { Suspense } from "react";
import AuthContent from "./auth-content";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          Loading...
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
