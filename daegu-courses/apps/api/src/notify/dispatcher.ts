import { and, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/client";
import { courses } from "../db/schema/courses";
import { favorites, notificationSubscriptions } from "../db/schema/users";
import { institutions } from "../db/schema/institutions";
import { notificationDeliveries, pushTokens } from "../db/schema/push";
import { isExpoPushToken, sendExpoPush, type ExpoMessage } from "./expo";

type Kind = "apply_open" | "apply_closing" | "new_in_category";

type PendingDelivery = {
  userId: string;
  kind: Kind;
  targetType: "course" | "event";
  targetId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

const APPLY_OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;
const APPLY_CLOSING_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEW_COURSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DispatchStats = {
  scanned: number;
  newlyClaimed: number;
  pushAttempted: number;
  pushDelivered: number;
  tokensDeactivated: number;
};

export async function dispatchNotifications(now: Date = new Date()): Promise<DispatchStats> {
  const pending: PendingDelivery[] = [
    ...(await scanFavoriteApplyOpen(now)),
    ...(await scanFavoriteApplyClosing(now)),
    ...(await scanNewInCategory(now)),
  ];

  if (pending.length === 0) {
    return { scanned: 0, newlyClaimed: 0, pushAttempted: 0, pushDelivered: 0, tokensDeactivated: 0 };
  }

  // Atomically claim notifications via the unique index. Only rows that
  // weren't already delivered survive; concurrent runs are race-safe.
  const claimed = await db
    .insert(notificationDeliveries)
    .values(
      pending.map((p) => ({
        userId: p.userId,
        kind: p.kind,
        targetType: p.targetType,
        targetId: p.targetId,
        channel: "expo" as const,
      })),
    )
    .onConflictDoNothing({
      target: [
        notificationDeliveries.userId,
        notificationDeliveries.kind,
        notificationDeliveries.targetType,
        notificationDeliveries.targetId,
      ],
    })
    .returning({
      id: notificationDeliveries.id,
      userId: notificationDeliveries.userId,
      kind: notificationDeliveries.kind,
      targetType: notificationDeliveries.targetType,
      targetId: notificationDeliveries.targetId,
    });

  if (claimed.length === 0) {
    return {
      scanned: pending.length,
      newlyClaimed: 0,
      pushAttempted: 0,
      pushDelivered: 0,
      tokensDeactivated: 0,
    };
  }

  // Re-attach the message body to each claimed delivery.
  const byKey = new Map<string, PendingDelivery>();
  for (const p of pending) {
    byKey.set(`${p.userId}\x00${p.kind}\x00${p.targetType}\x00${p.targetId}`, p);
  }
  const enriched = claimed
    .map((r) => {
      const key = `${r.userId}\x00${r.kind}\x00${r.targetType}\x00${r.targetId}`;
      const p = byKey.get(key);
      return p ? { deliveryId: r.id, ...p } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const userIds = [...new Set(enriched.map((e) => e.userId))];
  const tokens = await db
    .select()
    .from(pushTokens)
    .where(and(inArray(pushTokens.userId, userIds), eq(pushTokens.isActive, true)));

  const tokensByUser = new Map<string, typeof tokens>();
  for (const t of tokens) {
    if (!isExpoPushToken(t.token)) continue;
    const arr = tokensByUser.get(t.userId) ?? [];
    arr.push(t);
    tokensByUser.set(t.userId, arr);
  }

  const messages: ExpoMessage[] = [];
  const messageDeliveryId: string[] = [];
  for (const e of enriched) {
    const userTokens = tokensByUser.get(e.userId) ?? [];
    for (const t of userTokens) {
      messages.push({
        to: t.token,
        title: e.title,
        body: e.body,
        data: { kind: e.kind, deliveryId: e.deliveryId, ...e.data },
        sound: "default",
        priority: "high",
      });
      messageDeliveryId.push(e.deliveryId);
    }
  }

  if (messages.length === 0) {
    return {
      scanned: pending.length,
      newlyClaimed: claimed.length,
      pushAttempted: 0,
      pushDelivered: 0,
      tokensDeactivated: 0,
    };
  }

  const { tickets, invalidTokens } = await sendExpoPush(messages);

  if (invalidTokens.length > 0) {
    await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(inArray(pushTokens.token, invalidTokens));
  }

  let delivered = 0;
  const ticketIdByDelivery = new Map<string, string>();
  tickets.forEach((ticket, idx) => {
    if (ticket.status === "ok") {
      delivered += 1;
      const did = messageDeliveryId[idx];
      if (did && !ticketIdByDelivery.has(did)) ticketIdByDelivery.set(did, ticket.id);
    }
  });

  for (const [did, ticketId] of ticketIdByDelivery) {
    await db
      .update(notificationDeliveries)
      .set({ pushTicketId: ticketId })
      .where(eq(notificationDeliveries.id, did));
  }

  return {
    scanned: pending.length,
    newlyClaimed: claimed.length,
    pushAttempted: messages.length,
    pushDelivered: delivered,
    tokensDeactivated: invalidTokens.length,
  };
}

async function scanFavoriteApplyOpen(now: Date): Promise<PendingDelivery[]> {
  const since = new Date(now.getTime() - APPLY_OPEN_WINDOW_MS);
  const rows = await db
    .select({
      userId: favorites.userId,
      courseId: courses.id,
      title: courses.title,
      applyUrl: courses.applyUrl,
      institutionName: institutions.name,
    })
    .from(favorites)
    .innerJoin(courses, eq(favorites.targetId, courses.id))
    .innerJoin(institutions, eq(courses.institutionId, institutions.id))
    .where(
      and(
        eq(favorites.targetType, "course"),
        gt(courses.applyStartAt, since),
        lte(courses.applyStartAt, now),
      ),
    );
  return rows.map((r) => ({
    userId: r.userId,
    kind: "apply_open",
    targetType: "course",
    targetId: r.courseId,
    title: "📢 접수가 시작됐어요",
    body: `${r.institutionName} · ${r.title}`,
    data: { applyUrl: r.applyUrl, courseId: r.courseId },
  }));
}

async function scanFavoriteApplyClosing(now: Date): Promise<PendingDelivery[]> {
  const horizon = new Date(now.getTime() + APPLY_CLOSING_WINDOW_MS);
  const rows = await db
    .select({
      userId: favorites.userId,
      courseId: courses.id,
      title: courses.title,
      applyEndAt: courses.applyEndAt,
      applyUrl: courses.applyUrl,
      institutionName: institutions.name,
    })
    .from(favorites)
    .innerJoin(courses, eq(favorites.targetId, courses.id))
    .innerJoin(institutions, eq(courses.institutionId, institutions.id))
    .where(
      and(
        eq(favorites.targetType, "course"),
        gt(courses.applyEndAt, now),
        lte(courses.applyEndAt, horizon),
      ),
    );
  return rows.map((r) => ({
    userId: r.userId,
    kind: "apply_closing",
    targetType: "course",
    targetId: r.courseId,
    title: "⏰ 접수마감 임박",
    body: `${r.institutionName} · ${r.title}`,
    data: { applyUrl: r.applyUrl, applyEndAt: r.applyEndAt, courseId: r.courseId },
  }));
}

async function scanNewInCategory(now: Date): Promise<PendingDelivery[]> {
  const since = new Date(now.getTime() - NEW_COURSE_WINDOW_MS);
  const rows = await db
    .select({
      userId: notificationSubscriptions.userId,
      category: notificationSubscriptions.category,
      courseId: courses.id,
      title: courses.title,
      applyUrl: courses.applyUrl,
      institutionName: institutions.name,
    })
    .from(notificationSubscriptions)
    .innerJoin(courses, eq(courses.category, notificationSubscriptions.category))
    .innerJoin(institutions, eq(courses.institutionId, institutions.id))
    .where(
      and(
        eq(notificationSubscriptions.type, "new_in_category"),
        gte(courses.firstSeenAt, since),
      ),
    );
  return rows.map((r) => ({
    userId: r.userId,
    kind: "new_in_category",
    targetType: "course",
    targetId: r.courseId,
    title: `✨ 새 강좌 (${r.category ?? "관심 카테고리"})`,
    body: `${r.institutionName} · ${r.title}`,
    data: { applyUrl: r.applyUrl, courseId: r.courseId },
  }));
}
