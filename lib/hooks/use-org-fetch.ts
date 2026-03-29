"use client";

import { useCallback } from "react";
import { useOrganization } from "./use-organization";

/**
 * Returns a fetch wrapper that automatically adds X-Organization-Id header
 * from the current organization context.
 *
 * Usage:
 *   const orgFetch = useOrgFetch();
 *   const res = await orgFetch("/api/contacts");
 */
export function useOrgFetch() {
  const { currentOrg } = useOrganization();

  const orgFetch = useCallback(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);

      if (currentOrg?.id) {
        headers.set("X-Organization-Id", currentOrg.id);
      }

      return fetch(input, { ...init, headers });
    },
    [currentOrg?.id]
  );

  return orgFetch;
}
