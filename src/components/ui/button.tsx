import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

    const variantStyles = {
      default:
        "bg-white text-zinc-950 shadow hover:bg-zinc-200",
      destructive:
        "bg-red-500 text-white shadow-sm hover:bg-red-600",
      outline:
        "border border-white/10 bg-transparent shadow-sm hover:bg-white/10 hover:text-white text-zinc-300",
      secondary:
        "bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700",
      ghost:
        "hover:bg-white/10 hover:text-white text-zinc-400",
      link: "text-white underline-offset-4 hover:underline",
    };

    const sizeStyles = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
