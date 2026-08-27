import { renderAtlas } from "./atlas";
import type { AtlasLocalState } from "./atlas";

function mountAtlas(): void {
  const container = document.getElementById("atlas");
  if (container === null) {
    return;
  }

  const bridge = globalThis.nwWrldBridge?.observatory;
  const localState: AtlasLocalState = {
    state: null,
    selectedRunId: null,
    selectedNodeId: null,
    lastPulseSeqByRun: new Map(),
    emitterInFlight: false,
    statusLine: "Loading private Route Atlas…",
    preview: null,
    restoreNodeIds: [],
    narrowedClaimIds: [],
    legalOrThirdPartyConstraint: false,
  };

  renderAtlas(container, bridge, localState);

  if (bridge?.getState === undefined || bridge.onState === undefined) {
    localState.statusLine = "refused: OBSERVATORY_BRIDGE_UNAVAILABLE";
    renderAtlas(container, bridge, localState);
    return;
  }

  bridge.onState(() => {
    void bridge
      .getState()
      .then((result) => {
        if (result.ok) {
          localState.state = result.state;
        }
      })
      .finally(() => {
        renderAtlas(container, bridge, localState);
      });
  });

  void bridge
    .getState()
    .then((result) => {
      if (result.ok) {
        localState.state = result.state;
      } else {
        localState.statusLine = `refused: ${result.code}`;
      }
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message) {
        localState.statusLine = `failed: ${error.message}`;
      } else {
        localState.statusLine = "failed: bridge request";
      }
    })
    .finally(() => {
      renderAtlas(container, bridge, localState);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAtlas, { once: true });
} else {
  mountAtlas();
}
