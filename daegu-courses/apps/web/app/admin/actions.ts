"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import {
  crawlSourceCreate,
  crawlSourceUpdate,
  institutionCreate,
} from "@daegu-courses/api-schemas";

export async function createInstitutionAction(formData: FormData) {
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
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  try {
    await api.admin.institutions.create(parsed.data);
    revalidatePath("/admin/institutions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteInstitutionAction(id: string) {
  await api.admin.institutions.remove(id);
  revalidatePath("/admin/institutions");
}

export async function createSourceAction(formData: FormData) {
  const parsed = crawlSourceCreate.safeParse({
    institutionId: formData.get("institutionId"),
    sourceUrl: formData.get("sourceUrl"),
    adapterKey: formData.get("adapterKey"),
    contentType: formData.get("contentType") ?? "course",
    crawlIntervalMinutes: formData.get("crawlIntervalMinutes") ?? 1440,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  try {
    await api.admin.sources.create(parsed.data);
    revalidatePath("/admin/sources");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleSourceAction(id: string, isActive: boolean) {
  const parsed = crawlSourceUpdate.safeParse({ isActive });
  if (!parsed.success) return;
  await api.admin.sources.update(id, parsed.data);
  revalidatePath("/admin/sources");
}

export async function deleteSourceAction(id: string) {
  await api.admin.sources.remove(id);
  revalidatePath("/admin/sources");
}

export async function runSourceAction(id: string) {
  try {
    const res = await api.admin.sources.runNow(id);
    revalidatePath("/admin/sources");
    revalidatePath("/admin/logs");
    return { ok: true, stats: res.stats };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
