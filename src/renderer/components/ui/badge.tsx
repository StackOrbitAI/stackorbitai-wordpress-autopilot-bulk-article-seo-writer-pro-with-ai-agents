import * as React from "react";
import { cn } from "../../utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Variants
        variant === 'default' && "border-transparent bg-primary text-primary-foreground shadow",
        variant === 'secondary' && "border-transparent bg-secondary text-secondary-foreground",
        variant === 'destructive' && "border-transparent bg-destructive text-destructive-foreground shadow",
        variant === 'outline' && "text-foreground border-input",
        variant === 'success' && "border-transparent bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
        variant === 'warning' && "border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/20",
        variant === 'info' && "border-transparent bg-sky-500/15 text-sky-400 border border-sky-500/20",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
