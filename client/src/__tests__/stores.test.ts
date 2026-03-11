import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('should start with no user and loading state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('should set user and update authentication state', () => {
    const mockUser = {
      _id: '123',
      name: 'Test User',
      email: 'test@example.com',
      role: UserRole.MEMBER,
      isEmailVerified: true,
      membershipStatus: 'approved',
    };

    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();

    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('should clear user on setUser(null)', () => {
    useAuthStore.getState().setUser({
      _id: '123',
      name: 'Test',
      email: 'test@example.com',
      role: UserRole.USER,
      isEmailVerified: true,
      membershipStatus: 'none',
    });

    useAuthStore.getState().setUser(null);
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should clear user and token on logout', () => {
    useAuthStore.getState().setUser({
      _id: '123',
      name: 'Test',
      email: 'test@example.com',
      role: UserRole.USER,
      isEmailVerified: true,
      membershipStatus: 'none',
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('should set loading state', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);

    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});
