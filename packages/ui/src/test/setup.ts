import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetFailedImages } from '@baechan/ui/lib/image/failedImageCache';

afterEach(() => {
  cleanup();
  resetFailedImages();
});
