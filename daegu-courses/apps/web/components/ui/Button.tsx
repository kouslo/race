import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "kakao";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const SIZE: Record<ButtonSize, string> = {
  sm: "text-[12px] px-2.5 py-1.5",
  md: "text-[13px] px-3.5 py-2",
  lg: "text-[15px] px-4 py-3",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-foreground hover:bg-foreground-muted",
  secondary:
    "border border-border bg-transparent text-foreground hover:bg-surface-muted",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
  danger:
    "border border-border bg-transparent text-danger hover:bg-surface-muted",
  kakao: "bg-kakao text-kakao-foreground hover:brightness-95",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={cn(BASE, SIZE[size], VARIANT[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
}) {
  const cls = cn(BASE, SIZE[size], VARIANT[variant], "no-underline", className);
  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
  );
}
