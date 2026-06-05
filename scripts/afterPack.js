// electron-builder afterPack hook: harden the packaged Electron binary by
// flipping security fuses BEFORE electron-builder code-signs the app (afterPack
// runs prior to signing, so the resulting signature covers the modified binary).
//
// Fuses disabled here close the standard Electron local-code-execution backdoors:
//   - RunAsNode: blocks ELECTRON_RUN_AS_NODE=... relaunching the signed app as a
//     generic Node runtime inside the app's code-signing identity / entitlements.
//   - EnableNodeCliInspectArguments: blocks --inspect / --inspect-brk attaching a
//     debugger to the main process.
//   - EnableNodeOptionsEnvironmentVariable: blocks NODE_OPTIONS injection.
//
// Intentionally NOT touching OnlyLoadAppFromAsar / EnableEmbeddedAsarIntegrityValidation:
// those interact with electron-builder's asar packing/signing and need a dedicated
// build+notarize test before enabling. They can be added later once verified.
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
    electronBinaryPath = path.join(appOutDir, appName);
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
