"use client";

import type { ReactNode } from "react";
import { OrganizationProvider } from "@/lib/hooks/use-organization";

interface OrgProviderWrapperProps {
  children: ReactNode;
}

export function OrgProviderWrapper({ children }: OrgProviderWrapperProps) {
  return <OrganizationProvider>{children}</OrganizationProvider>;
}
