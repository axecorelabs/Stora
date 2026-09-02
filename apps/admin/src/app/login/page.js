"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn({ email, password });
    if (!result.success) {
      setError(result.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <h1 className="font-bold text-2xl text-brand-900">Stora Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Staff sign in</p>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-semibold hover:bg-brand-900 disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
