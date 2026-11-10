import { api, type Meta } from "@/lib/api";

export type AccountType = "user" | "business" | "developer";

export type ApiUser = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  suspendedAt: string | null;
  accountType: AccountType;
  createdAt: string;
  updatedAt: string;
};

export type UserListResponse = {
  message: string;
  data: ApiUser[];
  meta?: Meta;
};

export type UserStats = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  windowDays: number;
};

export type ChartPoint = { date: string; activeUsers: number };

export type ActiveUsersChartData = { windowDays: number; points: ChartPoint[] };

export type UserDevice = {
  id: number;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  signedInAt: string | null;
  expiresAt: string | null;
  current: boolean;
};

export type UserActivity = {
  id: number;
  event: string;
  ipAddress: string | null;
  deviceName: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type UserDetail = {
  user: ApiUser;
  devices: UserDevice[];
  activity: UserActivity[];
};

export function listUsers(params: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: "suspended";
} = {}): Promise<UserListResponse> {
  return api<ApiUser[]>("/users", { query: params });
}

export async function getUserStats(days = 30): Promise<UserStats> {
  const res = await api<UserStats>("/stats/users", { query: { days } });
  return res.data;
}

export async function getActiveUsersChart(days = 30): Promise<ActiveUsersChartData> {
  const res = await api<ActiveUsersChartData>("/stats/active-users-chart", {
    query: { days },
  });
  return res.data;
}

export async function getUser(id: number | string): Promise<UserDetail> {
  const res = await api<UserDetail>(`/users/${id}`);
  return res.data;
}

const post = (id: number, action: string) =>
  api<ApiUser | undefined>(`/users/${id}/${action}`, { method: "POST" });

export const suspendUser = (id: number) => post(id, "suspend");
export const unsuspendUser = (id: number) => post(id, "unsuspend");
export const revokeUserSessions = (id: number) => post(id, "revoke-sessions");
export const verifyUserEmail = (id: number) => post(id, "verify-email");
