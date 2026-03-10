import { create } from 'zustand';
import { UserRole } from '@rdswa/shared';

export interface AuthUser {
  _id: string;
  name: string;
  namebn?: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  isBloodDonor?: boolean;
  homeDistrict?: string;
  presentAddress?: { district: string; upazila: string; details: string };
  permanentAddress?: { district: string; upazila: string; details: string };
  studentId?: string;
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
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
