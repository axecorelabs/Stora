import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: 'Reset Password - Stora Store',
  description: 'Reset your password',
};

// This tells Next.js NOT to pre-render this page at build time
export const dynamic = 'force-dynamic';

function ResetPasswordFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-emerald-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
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
