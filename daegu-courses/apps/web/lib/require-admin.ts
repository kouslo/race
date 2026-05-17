import { redirect } from "next/navigation";
import { api } from "./api";
import { getAccessToken } from "./auth";

/**
 * Server-side guard for /admin/*. Returns the user (with isAdmin) or
 * redirects to /login. Calls /api/v1/admin/stats lightly to verify the
 * server actually treats this user as admin.
 */
export async function requireAdmin() {
  const token = await getAccessToken();
  if (!token) redirect("/login?next=/admin");
  try {
    const user = await api.auth.me();
    // me() doesn't return isAdmin yet; rely on the admin endpoint as gate.
    await api.admin.stats();
    return user;
  } catch (err) {
    if (err instanceof Error && /403|forbidden/i.test(err.message)) {
      redirect("/?error=forbidden");
    }
    redirect("/login?next=/admin");
  }
}
