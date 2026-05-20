import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./cn";

const FIELD =
  "h-10 px-3 text-[14px] rounded-md bg-transparent text-foreground border border-border placeholder:text-foreground-subtle focus-visible:border-foreground-muted";

export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />;
}

export function SelectInput({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "appearance-auto", className)} {...rest}>
      {children}
    </select>
  );
}
