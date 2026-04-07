import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'open', {
  writable: true,
  value: vi.fn(() => ({
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  })),
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  filter: '',
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(400 * 4).fill(128),
  })),
  putImageData: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
