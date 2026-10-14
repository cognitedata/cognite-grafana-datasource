import type { Response } from '@playwright/test';

/** Matches a successful response from the CDF endpoint whose URL ends with `path`. */
export const isCdfResponse = (path: string) => {
  return (response: Response) => {
    const isTsData = response.request().url().endsWith(path);
    const is200 = response.status() === 200;
    return isTsData && is200;
  };
};
