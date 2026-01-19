type ElectronProtocol = {
  registerSchemesAsPrivileged(
    schemes: Array<{
      scheme: string;
      privileges: {
        standard: boolean;
        secure: boolean;
        supportFetchAPI: boolean;
        corsEnabled: boolean;
      };
    }>
  ): void;
};

type ElectronApp = {
  setName(name: string): void;
  getVersion(): string;
  setAboutPanelOptions(opts: { applicationName: string; applicationVersion: string }): void;
  commandLine: { appendSwitch(name: string, value?: string): void };
};

const { app, protocol } = require("electron") as {
  app: ElectronApp;
  protocol: ElectronProtocol;
};

export function setupApp() {
  app.setName("nw_wrld");

  protocol.registerSchemesAsPrivileged([
    {
      scheme: "nw-sandbox",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "nw-assets",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);

  if (process.platform === "darwin") {
    app.setAboutPanelOptions({
      applicationName: "nw_wrld",
      applicationVersion: app.getVersion(),
    });
  }

  app.commandLine.appendSwitch("max-webgl-contexts", "64");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
}
