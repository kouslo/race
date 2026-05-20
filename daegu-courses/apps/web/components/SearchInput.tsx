"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/ui/Pill";
import { cn } from "@/components/ui/cn";
import type { CourseSuggestion } from "@daegu-courses/api-client";

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
          // suggestions are advisory; swallow network errors
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
    <div ref={wrapRef} className="relative">
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
        className="h-10 w-full px-3 text-[14px] rounded-md bg-transparent text-foreground border border-border placeholder:text-foreground-subtle focus-visible:border-foreground-muted"
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 bg-surface border border-border rounded-lg shadow-lg p-1 m-0 list-none max-h-[420px] overflow-y-auto"
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
              className={cn(
                "px-2.5 py-2 rounded-md cursor-pointer grid grid-cols-[1fr_auto] gap-2 items-center",
                i === activeIdx ? "bg-surface-muted" : "bg-transparent",
              )}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate">{s.title}</div>
                <div className="text-[11px] text-foreground-subtle mt-0.5">
                  {s.institution.name} · {s.institution.district}
                  {s.fee === 0 ? " · 무료" : ` · ${s.fee.toLocaleString()}원`}
                </div>
              </div>
              <StatusPill status={s.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
