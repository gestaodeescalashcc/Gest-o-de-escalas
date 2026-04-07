import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

import { AuthProvider, useAuth } from '../../contexts/AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('initializes with user null and loading eventually false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('sets user and session when getSession returns a session', async () => {
    const fakeSession = {
      user: { id: 'user-abc', email: 'test@example.com' },
      access_token: 'token-xyz',
    };
    mocks.getSession.mockResolvedValueOnce({ data: { session: fakeSession } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual(fakeSession.user);
    expect(result.current.session).toEqual(fakeSession);
  });

  it('signIn calls signInWithPassword with correct args', async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('admin@test.com', 'password123');
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@test.com',
      password: 'password123',
    });
  });

  it('signIn returns error from Supabase', async () => {
    const fakeError = { message: 'Invalid credentials' };
    mocks.signInWithPassword.mockResolvedValueOnce({ error: fakeError });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returnValue: { error: unknown } | undefined;
    await act(async () => {
      returnValue = await result.current.signIn('wrong@test.com', 'wrongpass');
    });

    expect(returnValue?.error).toEqual(fakeError);
  });

  it('signIn returns null error on success', async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returnValue: { error: unknown } | undefined;
    await act(async () => {
      returnValue = await result.current.signIn('admin@test.com', 'correct');
    });

    expect(returnValue?.error).toBeNull();
  });

  it('signUp calls supabase.auth.signUp with correct args', async () => {
    mocks.signUp.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp('new@test.com', 'newpass123');
    });

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'newpass123',
    });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    mocks.signOut.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('onAuthStateChange listener is registered on mount', async () => {
    renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalled());
  });

  it('unsubscribes from auth state changes on unmount', async () => {
    const unsubscribe = vi.fn();
    mocks.onAuthStateChange.mockReturnValueOnce({
      data: { subscription: { unsubscribe } },
    });

    const { unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalled());

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
