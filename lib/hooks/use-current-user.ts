"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { UserRole } from "@/lib/types/database";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  isLoading: boolean;
}

export function useCurrentUser(): CurrentUser & { refresh: () => void } {
  const [user, setUser] = useState<CurrentUser>({
    id: "",
    email: "",
    role: "viewer",
    displayName: null,
    isLoading: true,
  });

  const supabase = createClient();

  const fetchUser = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setUser((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role, display_name")
      .eq("id", authUser.id)
      .single();

    setUser({
      id: authUser.id,
      email: authUser.email || "",
      role: (userData?.role as UserRole) || "viewer",
      displayName: userData?.display_name || null,
      isLoading: false,
    });
  };

  useEffect(() => {
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...user, refresh: fetchUser };
}

/**
 * Check if user has a specific role or higher
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
