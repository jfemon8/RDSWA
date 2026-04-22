import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserRole } from '@rdswa/shared';

export interface AuthUser {
  _id: string;
  name: string;
  nameBn?: string;
  nickName?: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  isBloodDonor?: boolean;
  lastDonationDate?: string;
  homeDistrict?: string;
  presentAddress?: { division?: string; district?: string; upazila?: string; details?: string };
  permanentAddress?: { division?: string; district?: string; upazila?: string; details?: string };
  studentId?: string;
  registrationNumber?: string;
  batch?: number;
  session?: string;
  department?: string;
  faculty?: string;
  facebook?: string;
  linkedin?: string;
  website?: string;
  skills?: string[];
  profession?: string;
  earningSource?: string;
  jobHistory?: any[];
  businessInfo?: any[];
  isEmailVerified: boolean;
  membershipStatus: string;
  isModerator?: boolean;
  isAlumni?: boolean;
  isAdvisor?: boolean;
  isSeniorAdvisor?: boolean;
  profileVisibility?: {
    phone?: boolean;
    email?: boolean;
    dateOfBirth?: boolean;
    nid?: boolean;
    presentAddress?: boolean;
    permanentAddress?: boolean;
    bloodGroup?: boolean;
    studentId?: boolean;
    registrationNumber?: boolean;
    facebook?: boolean;
    linkedin?: boolean;
  };
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      // Start as NOT loading when rehydrating from storage — a persisted
      // user means we already know who the user is; useAuth will revalidate
      // in the background. Without persistence we default to `true` so the
      // initial /users/me call can run before the app renders.
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
      },
    }),
    {
      name: 'rdswa-auth',
      storage: createJSONStorage(() => localStorage),
      // Persist only the identity — NEVER persist `isLoading` (would freeze
      // the app in a loading state on the next cold start if the previous
      // session crashed mid-auth).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // After rehydration, if we already have a user, we're no longer in
      // the initial-loading state. This lets the app render immediately on
      // cold offline launches instead of blocking on /users/me.
      onRehydrateStorage: () => (state) => {
        if (state?.user) state.isLoading = false;
      },
    }
  )
);
