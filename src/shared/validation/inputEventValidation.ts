import type { InputEventPayload } from "../../types/input";

type Jsonish = string | number | boolean | null | undefined | object;

type DataBag = Record<string, Jsonish>;

function isPlainObject(value: object): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function isFiniteNumber(value: Jsonish): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: Jsonish): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeInputEventPayload(
  payload: Jsonish
): InputEventPayload | null {
  if (!payload || typeof payload !== "object") return null;
  if (!isPlainObject(payload)) return null;
  const payloadObj = payload as DataBag;
  const type = payloadObj.type;
  const data = payloadObj.data;

  if (typeof type !== "string") return null;
  if (type !== "track-selection" && type !== "method-trigger") return null;
  if (!data || typeof data !== "object") return null;
  if (!isPlainObject(data)) return null;
  const dataObj = data as DataBag;

  const source = dataObj.source;
  if (source !== "midi" && source !== "osc" && source !== "audio" && source !== "file") return null;

  const timestamp = isFiniteNumber(dataObj.timestamp)
    ? dataObj.timestamp
    : Date.now() / 1000;

  if (source === "midi") {
    if (!isFiniteNumber(dataObj.note)) return null;
    if (!isFiniteNumber(dataObj.channel)) return null;
    if (!isFiniteNumber(dataObj.velocity)) return null;
    const note = dataObj.note;
    const channel = dataObj.channel;
    const velocity = dataObj.velocity;
    return {
      type,
      data: {
        ...dataObj,
        source: "midi",
        timestamp,
        note,
        channel,
        velocity,
      },
    };
  }

  if (source === "audio") {
    if (type !== "method-trigger") return null;
    if (!isNonEmptyString(dataObj.channelName)) return null;
    if (!isFiniteNumber(dataObj.velocity)) return null;
    const channelName = dataObj.channelName;
    const velocity = dataObj.velocity;
    return {
      type,
      data: {
        ...dataObj,
        source: "audio",
        timestamp,
        channelName,
        velocity,
      },
    };
  }

  if (source === "file") {
    if (type !== "method-trigger") return null;
    if (!isNonEmptyString(dataObj.channelName)) return null;
    if (!isFiniteNumber(dataObj.velocity)) return null;
    const channelName = dataObj.channelName;
    const velocity = dataObj.velocity;
    return {
      type,
      data: {
        ...dataObj,
        source: "file",
        timestamp,
        channelName,
        velocity,
      },
    };
  }

  if (!isNonEmptyString(dataObj.address)) return null;
  const address = dataObj.address;

  if (type === "track-selection") {
    if (!isNonEmptyString(dataObj.identifier)) return null;
    const identifier = dataObj.identifier;
    return {
      type,
      data: {
        ...dataObj,
        source: "osc",
        timestamp,
        address,
        identifier,
      },
    };
  }

  if (!isNonEmptyString(dataObj.channelName)) return null;
  if (!isFiniteNumber(dataObj.velocity)) return null;
  const channelName = dataObj.channelName;
  const velocity = dataObj.velocity;
  return {
    type,
    data: {
      ...dataObj,
      source: "osc",
      timestamp,
      address,
      channelName,
      velocity,
    },
  };
}
