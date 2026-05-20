import type { ReactNode } from "react";
import { cn } from "./cn";

type Variant =
  | "open"
  | "upcoming"
  | "closed"
  | "full"
  | "cancelled"
  | "neutral"
  | "subtle";

const STATUS_BG: Record<Variant, string> = {
  open: "bg-status-open text-white",
  upcoming: "bg-status-upcoming text-white",
  closed: "bg-status-closed text-white",
  full: "bg-status-full text-white",
  cancelled: "bg-status-cancelled text-white",
  neutral: "bg-foreground text-background",
  subtle: "bg-surface-muted text-foreground",
};

export function Pill({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        STATUS_BG[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  open: "접수중",
  upcoming: "예정",
  closed: "마감",
  full: "정원마감",
  cancelled: "취소",
};

export function StatusPill({ status }: { status: string }) {
  const v = (status as Variant) in STATUS_BG ? (status as Variant) : "closed";
  return <Pill variant={v}>{STATUS_LABEL[status] ?? status}</Pill>;
}
