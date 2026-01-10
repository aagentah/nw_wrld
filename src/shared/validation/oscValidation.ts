/**
 * OSC Naming Convention Validation
 *
 * Industry standard OSC addressing:
 * - /track/... → Track selection only
 * - /ch/... or /channel/... → Channel triggers only
 */

export type OscAddressType = "track" | "channel" | null;

export interface ValidationResult {
  valid: boolean;
  type?: OscAddressType;
  address?: string;
  error?: string;
  suggestion?: string;
}

export function isValidOSCTrackAddress(address: unknown): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  return trimmed.startsWith("/track/") || trimmed === "/track";
}

export function isValidOSCChannelAddress(address: unknown): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  return trimmed.startsWith("/ch/") || trimmed.startsWith("/channel/");
}

export function isValidOSCAddress(address: unknown): boolean {
  return isValidOSCTrackAddress(address) || isValidOSCChannelAddress(address);
}

export function getOSCAddressType(address: unknown): OscAddressType {
  if (isValidOSCTrackAddress(address)) return "track";
  if (isValidOSCChannelAddress(address)) return "channel";
  return null;
}

export function validateOSCAddress(address: unknown): ValidationResult {
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

  if (!isValidOSCAddress(trimmed)) {
    return {
      valid: false,
      error: "OSC address must start with '/track/' or '/ch/' (or '/channel/')",
      suggestion:
        "Use '/track/name' for track selection or '/ch/name' for channel triggers",
    };
  }

  return {
    valid: true,
    type: getOSCAddressType(trimmed),
    address: trimmed,
  };
}
