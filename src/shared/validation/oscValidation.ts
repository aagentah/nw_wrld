type OscAddressType = "track" | "channel";

export function isValidOSCTrackAddress(address: unknown): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  if (trimmed === "/track") return true;
  if (!trimmed.startsWith("/track/")) return false;
  return trimmed.length > "/track/".length;
}

export function isValidOSCChannelAddress(address: unknown): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  if (trimmed.startsWith("/ch/")) return trimmed.length > "/ch/".length;
  if (trimmed.startsWith("/channel/")) return trimmed.length > "/channel/".length;
  return false;
}

export function isValidOSCAddress(address: unknown): boolean {
  return isValidOSCTrackAddress(address) || isValidOSCChannelAddress(address);
}

export function getOSCAddressType(address: unknown): OscAddressType | null {
  if (isValidOSCTrackAddress(address)) return "track";
  if (isValidOSCChannelAddress(address)) return "channel";
  return null;
}

export function validateOSCAddress(
  address: unknown
):
  | { valid: false; error: string; suggestion?: string }
  | { valid: true; type: OscAddressType; address: string } {
  const trimmed = typeof address === "string" ? address.trim() : "";

  if (!trimmed) {
    return {
      valid: false,
      error: "OSC address cannot be empty",
    };
  }

  if (!trimmed.startsWith("/")) {
    return {
      valid: false,
      error: "OSC address must start with '/'",
    };
  }

  if (trimmed === "/track") {
    return { valid: true, type: "track", address: trimmed };
  }
  if (trimmed === "/track/") {
    return {
      valid: false,
      error: "OSC address '/track/' must include a name",
      suggestion: "Use '/track/name' for track selection (example: '/track/intro')",
    };
  }
  if (trimmed === "/ch/" || trimmed === "/channel/") {
    return {
      valid: false,
      error: "OSC address must include a name after the prefix",
      suggestion: "Use '/ch/name' or '/channel/name' for channel triggers (example: '/ch/bass')",
    };
  }

  if (!isValidOSCAddress(trimmed)) {
    return {
      valid: false,
      error: "OSC address must start with '/track/' or '/ch/' (or '/channel/')",
      suggestion: "Use '/track/name' for track selection or '/ch/name' for channel triggers",
    };
  }

  const type = getOSCAddressType(trimmed);
  return {
    valid: true,
    type: type === "track" || type === "channel" ? type : "track",
    address: trimmed,
  };
}
