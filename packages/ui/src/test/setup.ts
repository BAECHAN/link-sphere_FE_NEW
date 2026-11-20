import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetFailedImages } from '@link-sphere/ui/lib/image/failedImageCache';

afterEach(() => {
  cleanup();
  resetFailedImages();
});
