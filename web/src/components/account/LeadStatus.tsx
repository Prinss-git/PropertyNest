"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "../toast";

const OPTIONS = [
  ["NEW", "New"],
  ["CONTACTED", "Contacted"],
  ["VIEWING_SCHEDULED", "Viewing scheduled"],
  ["CLOSED", "Closed"],
  ["SPAM", "Spam"],
] as const;

export function LeadStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  return (
    <select
      className="select lead-status"
      aria-label="Lead status"
      value={value}
      onChange={async (e) => {
        const next = e.target.value;
        setValue(next);
        const res = await fetch(`/api/my/inquiries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
        if (!res.ok) {
          setValue(status);
          toast("Couldn't update the lead. Try again.");
          return;
        }
        router.refresh();
      }}
    >
      {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
