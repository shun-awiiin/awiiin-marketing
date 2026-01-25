"use client";

import { useState, useEffect } from "react";

interface ClientNumberProps {
  value: number;
  fallback?: string;
  className?: string;
}

export function ClientNumber({
  value,
  fallback = "-",
  className,
}: ClientNumberProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{value.toLocaleString()}</span>;
}
