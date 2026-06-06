// electron-builder afterPack hook: disable RunAsNode / inspect / NODE_OPTIONS
// fuses before signing, so the signature covers the hardened binary.
const path = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appName = packager.appInfo.productFilename;

  let electronBinaryPath;
  if (electronPlatformName === "darwin") {
    electronBinaryPath = path.join(
      appOutDir,
      `${appName}.app`,
      "Contents",
      "MacOS",
      appName
    );
  } else if (electronPlatformName === "win32") {
    electronBinaryPath = path.join(appOutDir, `${appName}.exe`);
  } else {
    // Linux executable name comes from package "name", not productName.
    const linuxExecutableName =
      packager.executableName || packager.appInfo.sanitizedName.toLowerCase();
    electronBinaryPath = path.join(appOutDir, linuxExecutableName);
  }

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  });

  console.log(
    `[afterPack] Disabled RunAsNode / inspect / NODE_OPTIONS fuses on ${electronBinaryPath}`
  );
};
