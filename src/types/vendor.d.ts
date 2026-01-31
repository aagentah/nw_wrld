declare module "osc" {
  export interface OscArg {
    value: number | string | boolean | null;
  }

  export interface OscMessage {
    address: string;
    args?: OscArg[];
  }

  export interface OscError extends Error {
    code?: string;
  }

  export interface UDPPortOptions {
    localAddress: string;
    localPort: number;
    metadata: boolean;
  }

  export class UDPPort {
    constructor(options: UDPPortOptions);
    on(event: "ready", handler: () => void): void;
    on(event: "message", handler: (msg: OscMessage) => void): void;
    on(event: "error", handler: (err: OscError) => void): void;
    open(): void;
    close(): void;
  }
}
