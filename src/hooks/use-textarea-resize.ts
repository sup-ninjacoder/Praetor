import { useEffect, useRef } from "react";

export function useTextareaResize(
  value: string | number | readonly string[] | undefined,
  rows: number = 1
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate true scrollHeight
    textarea.style.height = "auto";
    const newHeight = textarea.scrollHeight;
    textarea.style.height = `${newHeight}px`;
  }, [value, rows]);

  return textareaRef;
}
