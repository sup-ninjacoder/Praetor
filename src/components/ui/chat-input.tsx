"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ChatInputProps extends React.HTMLAttributes<HTMLDivElement> {}

const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full flex-col rounded-2xl border border-white/10 bg-zinc-900/60 p-2 shadow-2xl backdrop-blur-xl transition-all duration-200 focus-within:border-white/25 focus-within:ring-1 focus-within:ring-white/20",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChatInput.displayName = "ChatInput";

interface ChatInputTextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
}

const ChatInputTextArea = React.forwardRef<
  HTMLTextAreaElement,
  ChatInputTextAreaProps
>(({ className, value, rows = 1, onKeyDown, ...props }, ref) => {
  const internalRef = useTextareaResize(value, rows);

  const handleRef = (node: HTMLTextAreaElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <textarea
      ref={handleRef}
      value={value}
      rows={rows}
      onKeyDown={onKeyDown}
      className={cn(
        "max-h-52 min-h-[48px] w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
ChatInputTextArea.displayName = "ChatInputTextArea";

interface ChatInputSubmitProps extends ButtonProps {
  loading?: boolean;
}

const ChatInputSubmit = React.forwardRef<
  HTMLButtonElement,
  ChatInputSubmitProps
>(({ className, disabled, loading, size = "icon", children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      type="submit"
      size={size}
      disabled={disabled || loading}
      className={cn(
        "h-8 w-8 rounded-full bg-white text-zinc-950 transition-all hover:bg-zinc-200 disabled:opacity-30",
        className
      )}
      {...props}
    >
      {children || <ArrowUp className="h-4 w-4" />}
    </Button>
  );
});
ChatInputSubmit.displayName = "ChatInputSubmit";

export { ChatInput, ChatInputTextArea, ChatInputSubmit };
