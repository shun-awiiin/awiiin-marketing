"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { createElement } from "react";
import type { OrganizationWithRole } from "@/lib/types/organization";

const STORAGE_KEY = "current-org-id";

interface OrganizationContextValue {
  currentOrg: OrganizationWithRole | null;
  organizations: OrganizationWithRole[];
  isLoading: boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * Fetches user's organizations from the API
 */
async function fetchOrganizations(): Promise<OrganizationWithRole[]> {
  const res = await fetch("/api/organizations");
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

/**
 * Reads stored org ID from localStorage
 */
function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves org ID to localStorage
 */
function setStoredOrgId(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, orgId);
  } catch {
    // Storage unavailable
  }
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>(
    []
  );
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);

      const storedId = getStoredOrgId();
      const storedOrg = orgs.find((o) => o.id === storedId);

      if (storedOrg) {
        setCurrentOrgId(storedOrg.id);
      } else if (orgs.length > 0) {
        setCurrentOrgId(orgs[0].id);
        setStoredOrgId(orgs[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (!org) return;
      setCurrentOrgId(orgId);
      setStoredOrgId(orgId);
    },
    [organizations]
  );

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === currentOrgId) ?? null,
    [organizations, currentOrgId]
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      currentOrg,
      organizations,
      isLoading,
      switchOrg,
      refresh: loadOrganizations,
    }),
    [currentOrg, organizations, isLoading, switchOrg, loadOrganizations]
  );

  return createElement(OrganizationContext.Provider, { value }, children);
}

/**
 * Hook to access organization context.
 * Must be used within OrganizationProvider.
 */
export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
