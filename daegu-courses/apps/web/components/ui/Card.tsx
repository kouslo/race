import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  children,
  className,
  as: As = "div",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  hover?: boolean;
}) {
  return (
    <As
      className={cn(
        "bg-surface border border-border rounded-xl",
        hover && "transition-colors hover:border-foreground-subtle",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)} as="section">
      {title && (
        <h2 className="text-[13px] font-medium text-foreground-muted mb-3">{title}</h2>
      )}
      {children}
    </Card>
  );
}
