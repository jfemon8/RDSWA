import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('reports the first value immediately, so the list is never briefly empty', () => {
    const { result } = renderHook(() => useDebouncedValue('emon', 300));
    expect(result.current).toBe('emon');
  });

  it('holds a new value back until the delay passes', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ab' });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('ab');
  });

  it('only settles on the last of a fast run of keystrokes', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: '' },
    });

    for (const v of ['e', 'em', 'emo', 'emon']) {
      rerender({ v });
      act(() => { vi.advanceTimersByTime(100); });
    }
    expect(result.current).toBe('');

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('emon');
  });
});
