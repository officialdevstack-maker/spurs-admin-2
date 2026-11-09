import { api, type Meta } from "@/lib/api";

export type ApiUser = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  suspendedAt: string | null;
  accountType: string;
  createdAt: string;
  updatedAt: string;
};

export type UserListResponse = {
  message: string;
  data: ApiUser[];
  meta?: Meta;
};

export function listUsers(params: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: "suspended";
} = {}): Promise<UserListResponse> {
  return api<ApiUser[]>("/users", { query: params });
}
