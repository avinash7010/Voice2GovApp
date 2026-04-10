import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export interface AuthUser {
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  memberSince?: string;
  [key: string]: unknown;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser | null) => Promise<void>;
  logout: () => Promise<void>;
  loadUserFromToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  login: async (token: string, user: AuthUser | null) => {
    await SecureStore.setItemAsync("userToken", token);
    await SecureStore.setItemAsync("userInfo", JSON.stringify(user ?? {}));
    set({ token, user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("userToken");
    await SecureStore.deleteItemAsync("userInfo");
    set({ token: null, user: null });
  },

  loadUserFromToken: async () => {
    try {
      set({ isLoading: true });
      const token = await SecureStore.getItemAsync("userToken");
      const userStr = await SecureStore.getItemAsync("userInfo");
      if (token && userStr) {
        const parsed = JSON.parse(userStr) as AuthUser;
        const user = parsed && typeof parsed === "object" ? parsed : null;
        set({ token, user, isLoading: false });
      } else {
        set({ token: null, user: null, isLoading: false });
      }
    } catch {
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
