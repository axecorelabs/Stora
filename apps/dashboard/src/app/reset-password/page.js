import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata = {
  title: "Reset Password - Stora",
  description: "Reset your Stora account password",
};

// Don't pre-render at build time — this page depends on a ?token= query param
export const dynamic = "force-dynamic";

function ResetPasswordFallback() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-[#0B3B2E]"></div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
