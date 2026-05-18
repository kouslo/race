"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";

const CATEGORY_VALUES = [
  "art",
  "music",
  "sports",
  "language",
  "cooking",
  "tech",
  "humanities",
  "kids",
  "senior",
  "etc",
] as const;
type Category = (typeof CATEGORY_VALUES)[number];

/**
 * Toggle a "new course in category" subscription. If the user already
 * has a row for this category, remove it; otherwise create it.
 */
export async function toggleCategorySubscriptionAction(category: string) {
  if (!(CATEGORY_VALUES as readonly string[]).includes(category)) {
    throw new Error(`unknown category: ${category}`);
  }
  const subs = await api.notifications.listSubscriptions();
  const existing = subs.items.find(
    (s) => s.type === "new_in_category" && s.category === category,
  );
  if (existing) {
    await api.notifications.unsubscribe(existing.id);
  } else {
    await api.notifications.subscribe({
      type: "new_in_category",
      category: category as Category,
    });
  }
  revalidatePath("/me/notifications");
}
