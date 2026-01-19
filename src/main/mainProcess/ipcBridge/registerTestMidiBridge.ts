import { ipcMain } from "electron";

import { getOrCreateGlobalMockWebMidi } from "../../testing/mockWebMidi";

export function registerTestMidiBridge(): void {
  const isTest = process.env.NODE_ENV === "test";
  const isMockMidi = process.env.NW_WRLD_TEST_MIDI_MOCK === "1";
  if (isTest && isMockMidi) {
    const defaultDevices = [{ id: "e2e-midi-1", name: "E2E MIDI Device", manufacturer: "nw_wrld" }];
    const mock = getOrCreateGlobalMockWebMidi(defaultDevices);
    (globalThis as unknown as { __nwWrldWebMidiOverride?: unknown }).__nwWrldWebMidiOverride = mock;

    ipcMain.handle("test:midi:reset", async (_event, devices: unknown) => {
      const list = Array.isArray(devices)
        ? (devices as Array<{ id?: unknown; name?: unknown; manufacturer?: unknown }>)
        : [];
      const normalized = list
        .map((d) => ({
          id: typeof d?.id === "string" ? d.id : "",
          name: typeof d?.name === "string" ? d.name : "",
          manufacturer: typeof d?.manufacturer === "string" ? d.manufacturer : "",
        }))
        .filter((d) => d.id && d.name);
      mock.resetDevices(normalized);
      return { ok: true };
    });

    ipcMain.handle("test:midi:disconnect", async (_event, deviceId: unknown) => {
      const id = typeof deviceId === "string" ? deviceId : "";
      if (!id) return { ok: false };
      mock.disconnectDevice(id);
      return { ok: true };
    });

    ipcMain.handle("test:midi:reconnect", async (_event, device: unknown) => {
      const d = device && typeof device === "object" ? (device as Record<string, unknown>) : null;
      const id = d && typeof d.id === "string" ? d.id : "";
      const name = d && typeof d.name === "string" ? d.name : "";
      const manufacturer = d && typeof d.manufacturer === "string" ? d.manufacturer : "";
      if (!id || !name) return { ok: false };
      mock.reconnectDevice({ id, name, manufacturer });
      return { ok: true };
    });

    ipcMain.handle("test:midi:noteOn", async (_event, payload: unknown) => {
      const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const deviceId = p && typeof p.deviceId === "string" ? p.deviceId : "";
      const note = p && typeof p.note === "number" ? p.note : NaN;
      const channel = p && typeof p.channel === "number" ? p.channel : NaN;
      const velocity = p && typeof p.velocity === "number" ? p.velocity : undefined;
      if (!deviceId) return { ok: false };
      const ok = mock.noteOn(deviceId, { note, channel, velocity });
      return { ok };
    });
  }
}

