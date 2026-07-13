import '@testing-library/jest-dom/vitest';
import {vi} from 'vitest';

const mockFont = {
  className: 'mock-font-class',
  style: {fontFamily: 'mock-font'},
  variable: 'mock-font-variable'
};

vi.mock('next/font/google', () => ({
  Inter: () => mockFont,
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
