"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/login-screen";
import { PageTransition } from "@/components/page-transition";

function LoginWithParams() {
  const params = useSearchParams();
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <LoginScreen next={next} linkError={params.get("error") === "enlace"} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageTransition>
        <LoginWithParams />
      </PageTransition>
    </Suspense>
  );
}
