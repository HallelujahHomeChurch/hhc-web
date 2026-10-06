import '@testing-library/jest-dom/vitest';
import {afterEach, vi} from 'vitest';

const mockFont = {
  className: 'mock-font-class',
  style: {fontFamily: 'mock-font'},
  variable: 'mock-font-variable'
};

vi.mock('next/font/google', () => ({
  Inter: () => mockFont,
  Ma_Shan_Zheng: () => mockFont,
  Noto_Sans_SC: () => mockFont,
  Noto_Sans_TC: () => mockFont
}));

vi.mock('next/font/local', () => ({
  default: () => mockFont
}));

HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.setPointerCapture ??= () => undefined;
HTMLElement.prototype.releasePointerCapture ??= () => undefined;
HTMLElement.prototype.scrollIntoView ??= () => undefined;

// Navigation snapshots persist across mounts, but must not leak between test cases.
afterEach(() => {
  for (const key of Object.keys(localStorage)) if (key.startsWith('hhc:navigation:')) localStorage.removeItem(key)
})
