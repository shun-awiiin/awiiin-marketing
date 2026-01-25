"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

interface ClientDateProps {
  date: string | Date;
  format?: "date" | "datetime" | "relative";
  fallback?: string;
  className?: string;
}

export function ClientDate({
  date,
  format = "date",
  fallback = "-",
  className,
}: ClientDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>{fallback}</span>;
  }

  const d = new Date(date);

  let formatted: string;
  switch (format) {
    case "datetime":
      formatted = d.toLocaleString("ja-JP");
      break;
    case "relative":
      formatted = formatDistanceToNow(d, { addSuffix: true, locale: ja });
      break;
    default:
      formatted = d.toLocaleDateString("ja-JP");
  }

  return <span className={className}>{formatted}</span>;
}
