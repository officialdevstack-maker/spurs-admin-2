"use client";

import * as React from "react";
import {
  type AdminUser,
  changePasswordRequest,
  getStoredUser,
  loginRequest,
  logoutRequest,
} from "@/lib/auth";

type AuthContextValue = {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        setUser(await loginRequest(email, password));
      },
      logout: () => {
        logoutRequest();
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
