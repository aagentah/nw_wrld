/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import type { AssertionError } from "chai";
import type * as VitestExpect from "vitest/expect";

declare global {
  const describe: {
    (name: string, fn: () => void): void;
    skip: typeof describe;
    only: typeof describe;
  };
  const it: {
    (name: string, fn: () => void | Promise<void>): void;
    skip: typeof it;
    only: typeof it;
    each: typeof it;
  };
  const test: typeof it;
  const expect: VitestExpect.ExpectStatic & {
    extend(matchers: Record<string, (...args: any[]) => void>): void;
  };
  const vi: typeof import("vitest").vi;
  const beforeAll: (fn: () => void | Promise<void>) => void;
  const afterAll: (fn: () => void | Promise<void>) => void;
  const beforeEach: (fn: () => void | Promise<void>) => void;
  const afterEach: (fn: () => void | Promise<void>) => void;
}

export {};
