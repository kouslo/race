import type { ReactNode } from "react";
import { cn } from "./cn";

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "max-w-[640px]",
  md: "max-w-[860px]",
  lg: "max-w-[1100px]",
};

export function Container({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("mx-auto px-5 sm:px-6", SIZE[size], className)}>{children}</div>
  );
}
