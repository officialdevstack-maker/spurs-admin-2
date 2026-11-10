"use client";

import * as React from "react";
import {
  type AdminUser,
  changePasswordRequest,
  getSessionUser,
  loginRequest,
  logoutRequest,
} from "@/lib/auth";

type AuthContextValue = {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getSessionUser()
      .then((storedUser) => {
        if (active) setUser(storedUser);
      })
      .catch((error: unknown) => {
        console.error("Could not restore panel session:", error);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        await loginRequest(email, password);
        const confirmedUser = await getSessionUser();
        if (!confirmedUser) {
          throw new Error(
            "Signed in, but the session cookie was not saved. If you are running over HTTP, the secure cookie flag may be blocking it.",
          );
        }
        setUser(confirmedUser);
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
      },
      changePassword: changePasswordRequest,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
