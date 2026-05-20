"use client";

import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClick = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = `${title} — 대구 강좌`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("링크가 복사되었습니다");
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback("복사 실패");
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="공유"
        title="공유"
        className="bg-transparent border-0 p-0 text-[20px] leading-none cursor-pointer text-foreground-muted hover:text-foreground"
      >
        ↗
      </button>
      {feedback && (
        <span className="absolute top-[calc(100%+6px)] right-0 bg-foreground text-background text-[11px] px-2 py-1 rounded whitespace-nowrap">
          {feedback}
        </span>
      )}
    </div>
  );
}
