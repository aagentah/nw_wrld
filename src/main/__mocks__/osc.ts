/**
 * Manual mock for osc package
 */

import { vi } from "vitest";
import { EventEmitter } from "events";

export const UDPPort = vi.fn().mockImplementation(() => {
  const mockPort = new EventEmitter();
  return {
    ...mockPort,
    open: vi.fn(),
    close: vi.fn(),
  };
});

export default { UDPPort };
