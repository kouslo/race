"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Target = "course" | "event";

/**
 * Idempotent toggle: if the user has favorited this target, remove it;
 * otherwise add it. Reads the current set to decide.
 */
export async function toggleFavoriteAction(
  targetType: Target,
  targetId: string,
  nextPath: string,
) {
  const token = await getAccessToken();
  if (!token) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const current = await api.favorites.list();
  const list = targetType === "course" ? current.courses : current.events;
  const existing = list.find((f) => f.target.id === targetId);

  if (existing) {
    await api.favorites.remove(existing.id);
  } else {
    await api.favorites.add({ targetType, targetId });
  }
  revalidatePath(nextPath);
  revalidatePath("/me");
}
