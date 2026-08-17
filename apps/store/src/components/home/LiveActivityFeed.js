"use client";
import { useEffect, useState } from "react";

const REFRESH_MS = 60000;

function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// The page's proof: real, recent order activity, not a claim. Fetched once
// on mount, then refreshed on a slow interval -- frequent enough to feel
// alive, not so frequent it's polling for change that isn't there yet on a
// young platform. Every field here is already allowlisted server-side (see
// apps/store/src/lib/supabaseActivity.js) -- product name and city/state
// only, nothing that identifies the customer.
//
// Deliberately no card chrome (border/background/own header) -- it renders
// as a plain divided list directly on the section's own background; the
// "Live on Stora" label and pulse live one level up, on the section itself.
export default function LiveActivityFeed() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/activity?limit=6");
        const data = await res.json();
        if (!cancelled && data.success) {
          setActivity(data.activity || []);
        }
      } catch (error) {
        console.error("Error loading activity feed:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!loading && activity.length === 0) return null;

  return (
    <ul className="divide-y divide-white/10 text-left">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="py-3.5 flex items-center justify-between animate-pulse">
              <div className="h-3 bg-white/10 rounded w-1/2" />
              <div className="h-3 bg-white/10 rounded w-10" />
            </li>
          ))
        : activity.map((entry, i) => (
            <li key={i} className="py-3.5 flex items-center justify-between gap-4 text-sm">
              <p className="text-white/80 truncate">
                <span className="font-medium text-white">{entry.productName}</span>
                <span className="text-white/40"> sold · {entry.city}</span>
              </p>
              <span className="font-mono text-[11px] text-white/35 flex-shrink-0 tabular-nums">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </li>
          ))}
    </ul>
  );
}
