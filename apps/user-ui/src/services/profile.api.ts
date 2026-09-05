/** profile.api.ts — le profil que le membre tient lui-même (D67). */
import apiClient from "@/lib/api-client";

export type MyProfile = { firstName: string; lastName: string; publicSlug: string | null; avatarUrl: string | null; birthDate: string | null; profilePublic: boolean; showCity: boolean; carrier: { displayName: string; bio: string | null } | null };
export type UpdateMyProfile = { firstName?: string; lastName?: string; displayName?: string; bio?: string | null; birthDate?: string | null; profilePublic?: boolean; showCity?: boolean };

export const fetchMyProfile = async (): Promise<MyProfile> => (await apiClient.get<MyProfile>("/auth/me/profile", { requireAuth: true })).data;
export const updateMyProfile = async (body: UpdateMyProfile): Promise<MyProfile> => (await apiClient.patch<MyProfile>("/auth/me/profile", body, { requireAuth: true })).data;
export const setMyAvatar = async (fileId: string, url: string): Promise<MyProfile> => (await apiClient.post<MyProfile>("/auth/me/avatar", { fileId, url }, { requireAuth: true })).data;
export const deleteMyAvatar = async (): Promise<MyProfile> => (await apiClient.delete<MyProfile>("/auth/me/avatar", { requireAuth: true })).data;
export function fieldErrors(e: unknown): Record<string, string> {
  return (e as { response?: { data?: { details?: { errors?: Record<string, string> } } } })?.response?.data?.details?.errors ?? {};
}
