"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseSuggestion } from "@daegu-courses/api-client";

const STATUS_LABEL: Record<string, string> = {
  open: "접수중",
  upcoming: "예정",
  closed: "마감",
  full: "정원마감",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#0a7d0a",
  upcoming: "#666",
  closed: "#999",
  full: "#c33",
};

export function SearchInput({
  apiBaseUrl,
  defaultValue = "",
  name = "q",
}: {
  apiBaseUrl: string;
  defaultValue?: string;
  name?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CourseSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setItems([]);
      setActiveIdx(-1);
      return;
    }
    const t = setTimeout(async () => {
      ctrlRef.current?.abort();
      const ctl = new AbortController();
      ctrlRef.current = ctl;
      try {
        const url = `${apiBaseUrl}/api/v1/courses/suggest?q=${encodeURIComponent(trimmed)}&limit=8`;
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { items: CourseSuggestion[] };
        setItems(data.items);
        setActiveIdx(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // network errors are fine; suggestions are advisory
        }
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value, apiBaseUrl]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectItem(s: CourseSuggestion) {
    setOpen(false);
    setValue(s.title);
    router.push(`/courses/${s.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) selectItem(item);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 200 }}>
      <input
        ref={inputRef}
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="강좌명 검색"
        autoComplete="off"
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "transparent",
          color: "inherit",
        }}
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 10,
            background: "var(--card, #fff)",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: 4,
            margin: 0,
            listStyle: "none",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(s);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: i === activeIdx ? "#f3f3f3" : "transparent",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                  {s.institution.name} · {s.institution.district}
                  {s.fee === 0 ? " · 무료" : ` · ${s.fee.toLocaleString()}원`}
                </div>
              </div>
              <span
                style={{
                  background: STATUS_COLOR[s.status] ?? "#999",
                  color: "#fff",
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
