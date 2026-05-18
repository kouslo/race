"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import {
  crawlSourceCreate,
  crawlSourceUpdate,
  institutionCreate,
} from "@daegu-courses/api-schemas";

export async function createInstitutionAction(formData: FormData): Promise<void> {
  const parsed = institutionCreate.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    district: formData.get("district"),
    homepageUrl: formData.get("homepageUrl"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  await api.admin.institutions.create(parsed.data);
  revalidatePath("/admin/institutions");
}

export async function deleteInstitutionAction(id: string): Promise<void> {
  await api.admin.institutions.remove(id);
  revalidatePath("/admin/institutions");
}

export async function createSourceAction(formData: FormData): Promise<void> {
  const parsed = crawlSourceCreate.safeParse({
    institutionId: formData.get("institutionId"),
    sourceUrl: formData.get("sourceUrl"),
    adapterKey: formData.get("adapterKey"),
    contentType: formData.get("contentType") ?? "course",
    crawlIntervalMinutes: formData.get("crawlIntervalMinutes") ?? 1440,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  await api.admin.sources.create(parsed.data);
  revalidatePath("/admin/sources");
}

export async function toggleSourceAction(id: string, isActive: boolean): Promise<void> {
  const parsed = crawlSourceUpdate.safeParse({ isActive });
  if (!parsed.success) return;
  await api.admin.sources.update(id, parsed.data);
  revalidatePath("/admin/sources");
}

export async function deleteSourceAction(id: string): Promise<void> {
  await api.admin.sources.remove(id);
  revalidatePath("/admin/sources");
}

export async function runSourceAction(id: string): Promise<void> {
  await api.admin.sources.runNow(id);
  revalidatePath("/admin/sources");
  revalidatePath("/admin/logs");
}
