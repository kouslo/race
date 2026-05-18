import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { publicApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CourseListItem, Institution } from "@daegu-courses/api-client";

const DAY_LABEL: Record<string, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};
const CATEGORY_LABEL: Record<string, string> = {
  art: "예술", music: "음악", sports: "운동", language: "외국어",
  cooking: "요리", tech: "기술", humanities: "인문", kids: "어린이",
  senior: "시니어", etc: "기타",
};
const STATUS_LABEL: Record<string, string> = {
  open: "접수중", upcoming: "접수예정", closed: "마감", full: "정원마감", cancelled: "취소",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#0a7d0a", upcoming: "#666", closed: "#999", full: "#c33", cancelled: "#999",
};

type CourseFull = CourseListItem & {
  description?: string | null;
  instructor?: string | null;
  targetAudience?: string | null;
  feeNote?: string | null;
  location?: string | null;
};

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, api } = useAuth();
  const [data, setData] = useState<{ course: CourseFull; institution: Institution } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [favId, setFavId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    publicApi.courses
      .byId(id)
      .then((r) => setData(r as never))
      .catch((e) => setError(String(e)));
  }, [id]);

  const loadFav = useCallback(async () => {
    if (state.status !== "authenticated" || !id) return;
    try {
      const favs = await api.favorites.list();
      const found = favs.courses.find((f) => f.target.id === id);
      setIsFav(!!found);
      setFavId(found?.id ?? null);
    } catch {
      // ignore
    }
  }, [state.status, api, id]);

  useEffect(() => {
    loadFav();
  }, [loadFav]);

  async function toggleFav() {
    if (state.status !== "authenticated") {
      router.push("/login");
      return;
    }
    if (!id) return;
    if (isFav && favId) {
      setIsFav(false);
      await api.favorites.remove(favId);
      setFavId(null);
    } else {
      setIsFav(true);
      const r = await api.favorites.add({ targetType: "course", targetId: id });
      if (r && "id" in r && r.id) setFavId(r.id);
      else loadFav();
    }
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator /></View>;

  const { course, institution } = data;
  const schedule = (course.schedule as { dayOfWeek: string; startTime: string; endTime: string }[] | null) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fafafa" }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
        <Pill bg={STATUS_COLOR[course.status] ?? "#999"} fg="#fff">
          {STATUS_LABEL[course.status] ?? course.status}
        </Pill>
        <Pill bg="#eee" fg="#333">
          {CATEGORY_LABEL[course.category] ?? course.category}
        </Pill>
      </View>

      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Text style={styles.title}>{course.title}</Text>
        <Pressable
          onPress={toggleFav}
          hitSlop={8}
          accessibilityLabel={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        >
          <Text style={{ fontSize: 24, color: isFav ? "#f5a623" : "#bbb" }}>
            {isFav ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        {institution.name} · {institution.district}
      </Text>

      <Pressable
        onPress={() => Linking.openURL(course.applyUrl)}
        style={[styles.cta, { backgroundColor: STATUS_COLOR[course.status] ?? "#111" }]}
      >
        <Text style={styles.ctaText}>
          {course.status === "open" ? "신청 페이지로 이동 →" : "원본 페이지로 이동 →"}
        </Text>
      </Pressable>

      <Section title="개요">
        <Row label="강사" value={course.instructor || "—"} />
        <Row label="대상" value={course.targetAudience || "—"} />
        <Row
          label="수강료"
          value={course.fee === 0 ? "무료" : `${course.fee.toLocaleString()}원${course.feeNote ? ` (${course.feeNote})` : ""}`}
        />
        <Row label="장소" value={course.location || institution.address || institution.name} />
        <Row
          label="정원"
          value={course.capacity != null ? `${course.enrolled ?? 0} / ${course.capacity}` : "—"}
        />
      </Section>

      <Section title="일정">
        <Row
          label="강좌 기간"
          value={course.startDate ? `${course.startDate} ~ ${course.endDate ?? ""}` : "—"}
        />
        <Row
          label="요일·시간"
          value={
            schedule.length === 0
              ? "—"
              : schedule
                  .map((s) => `${DAY_LABEL[s.dayOfWeek] ?? s.dayOfWeek} ${s.startTime}~${s.endTime}`)
                  .join(", ")
          }
        />
        <Row
          label="접수 기간"
          value={
            course.applyStartAt && course.applyEndAt
              ? `${new Date(course.applyStartAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })} ~ ${new Date(course.applyEndAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}`
              : "—"
          }
        />
      </Section>

      {course.description && (
        <Section title="안내">
          <Text style={{ color: "#333", lineHeight: 22 }}>{course.description}</Text>
        </Section>
      )}

      <Text style={styles.disclaimer}>
        이 정보는 기관 페이지에서 자동 수집되었습니다. 최신 정보는 원본을 확인하세요.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.dlRow}>
      <Text style={styles.dlLabel}>{label}</Text>
      <Text style={styles.dlValue}>{value}</Text>
    </View>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
      <Text style={{ color: fg, fontSize: 11 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c33" },
  title: { flex: 1, fontSize: 22, fontWeight: "700", lineHeight: 30 },
  subtitle: { color: "#666", fontSize: 13, marginTop: 8, marginBottom: 16 },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginBottom: 16 },
  ctaText: { color: "#fff", fontWeight: "700" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, color: "#666", marginBottom: 10 },
  dlRow: { flexDirection: "row", gap: 12, marginBottom: 6 },
  dlLabel: { width: 80, color: "#888", fontSize: 13 },
  dlValue: { flex: 1, color: "#222", fontSize: 13 },
  disclaimer: { color: "#aaa", fontSize: 10, textAlign: "center", marginTop: 16 },
});
