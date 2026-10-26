"use client";
import { useRef, useState } from "react";
import { Icon } from "../Icon";

export type Photo = { id: string; url: string };
type Pending = { name: string; error?: string };

const MAX = 20;

/** Uploads photos one at a time (gentle on mobile data), lets the poster reorder and remove them. First photo is the cover. */
export function PhotoUploader({ photos, onChange }: { photos: Photo[]; onChange: (p: Photo[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const latest = useRef(photos);
  latest.current = photos;

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, MAX - photos.length);
    setPending(list.map((f) => ({ name: f.name })));
    for (const [i, file] of list.entries()) {
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        latest.current = [...latest.current, { id: data.id, url: data.url }];
        onChange(latest.current);
        setPending((p) => p.map((x, j) => (j === i ? { ...x, error: "done" } : x)));
      } catch (e) {
        setPending((p) => p.map((x, j) => (j === i ? { ...x, error: e instanceof Error ? e.message : "Upload failed." } : x)));
      }
    }
    setPending((p) => p.filter((x) => x.error && x.error !== "done"));
  }

  const move = (i: number, d: -1 | 1) => {
    const next = photos.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="uploader">
      <div className="photo-grid">
        {photos.map((p, i) => (
          <figure key={p.id} className="photo-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url.startsWith("/media/") ? p.url.replace(/\.webp$/, "-sm.webp") : p.url} alt={`Photo ${i + 1}`} />
            {i === 0 && <span className="cover-tag">Cover</span>}
            <div className="tile-actions">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
              <button type="button" aria-label="Move later" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>›</button>
              <button type="button" aria-label="Remove photo" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}><Icon name="x" size={14} /></button>
            </div>
          </figure>
        ))}
        {photos.length < MAX && (
          <button type="button" className="photo-add" onClick={() => input.current?.click()} disabled={pending.some((p) => !p.error)}>
            <Icon name="camera" size={26} />
            <span>{pending.some((p) => !p.error) ? "Uploading…" : "Add photos"}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      <p className="fine">{photos.length}/{MAX} photos · at least 3 · JPG, PNG or WebP up to 12 MB. Location data in photos is removed automatically.</p>
      {pending.filter((p) => p.error && p.error !== "done").map((p) => (
        <p key={p.name} className="form-error">{p.name}: {p.error}</p>
      ))}
    </div>
  );
}
