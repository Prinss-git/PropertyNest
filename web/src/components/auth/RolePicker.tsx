"use client";

export type SignupRole = "SEEKER" | "OWNER" | "AGENT";

const ROLES: { value: SignupRole; title: string; text: string }[] = [
  { value: "SEEKER", title: "Looking for a place", text: "Save listings, get alerts, and track your inquiries." },
  { value: "OWNER", title: "Property owner", text: "List your own property to sell, rent out, or lease (up to 3)." },
  { value: "AGENT", title: "Licensed agent / broker", text: "List for clients. Needs your PRC license number." },
];

export function RolePicker({ role, onRole, prc, onPrc }: { role: SignupRole; onRole: (r: SignupRole) => void; prc: string; onPrc: (v: string) => void }) {
  return (
    <>
      <fieldset className="role-picker">
        <legend>I am…</legend>
        {ROLES.map((r) => (
          <label key={r.value} className={role === r.value ? "on" : ""}>
            <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => onRole(r.value)} />
            <strong>{r.title}</strong>
            <span>{r.text}</span>
          </label>
        ))}
      </fieldset>
      {role === "AGENT" && (
        <div className="auth-field">
          <label htmlFor="prc">PRC license number</label>
          <input className="input" id="prc" value={prc} onChange={(e) => onPrc(e.target.value)} required placeholder="As printed on your PRC ID" />
          <span className="fine">We check it against the PRC registry before showing the Verified Agent badge.</span>
        </div>
      )}
    </>
  );
}
