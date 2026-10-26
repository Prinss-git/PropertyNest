"use client";
import { Icon } from "./Icon";
import { toggleFavorite, useFavorites } from "./favorites";
import { toast } from "./toast";

export function FavButton({ refCode, variant = "card" }: { refCode: string; variant?: "card" | "button" }) {
  const on = useFavorites().includes(refCode);
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = toggleFavorite(refCode);
    toast(now ? "Saved to your favorites" : "Removed from favorites");
  };
  if (variant === "button") {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={click} aria-pressed={on}>
        <Icon name="heart" size={16} /> {on ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button type="button" className={`fav-btn ${on ? "on" : ""}`} onClick={click} aria-label={on ? "Remove from saved" : "Save listing"} aria-pressed={on}>
      <Icon name="heart" />
    </button>
  );
}
