import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../../hooks/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a success toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('Operação bem-sucedida!');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Operação bem-sucedida!');
  });

  it('adds an error toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.error('Erro ao salvar.');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Erro ao salvar.');
  });

  it('adds a warning toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.warning('Atenção!');
    });
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('adds an info toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.info('Informação importante.');
    });
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('assigns a unique id to each toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('First');
      result.current.toast.success('Second');
    });
    const ids = result.current.toasts.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(2);
  });

  it('removes a toast by id using removeToast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('Will be removed');
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.removeToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-removes toast after 5000ms', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('Auto-dismiss');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps toast before the 5000ms threshold', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.error('Still visible');
    });
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.toasts).toHaveLength(1);
  });

  it('can have multiple toasts simultaneously', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('First');
      result.current.toast.error('Second');
      result.current.toast.warning('Third');
    });
    expect(result.current.toasts).toHaveLength(3);
  });

  it('removeToast does nothing when id does not exist', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast.success('Existing');
    });
    act(() => {
      result.current.removeToast('nonexistent-id');
    });
    expect(result.current.toasts).toHaveLength(1);
  });
});
