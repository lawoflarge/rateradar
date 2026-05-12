// Metro config for Expo + pnpm monorepo.
//
// Standard `getDefaultConfig(__dirname)` is enough for non-monorepo apps, but
// pnpm hoists transitive deps to `<workspace-root>/node_modules/.pnpm/` which
// Metro doesn't traverse by default. Result: deps that resolve fine via
// Node's require also need to resolve via Metro's worker. We need to:
//   1. Tell Metro to watch the workspace root (so it knows about hoisted deps).
//   2. Add the workspace root's node_modules to nodeModulesPaths so Metro
//      walks both `apps/ios-expo/node_modules` (symlinks to .pnpm) AND the
//      workspace root's node_modules (where .pnpm/ lives).
//   3. Pin projectRoot to __dirname so the entry-file (`index.js`) is
//      resolved relative to the app, not the workspace root (Codemagic /
//      Windows otherwise misanchor it and fail with "Unable to resolve module
//      ./index.js from <workspace-root>/." — observed locally on Windows
//      while preparing build #9).
//
// Pattern documented at https://docs.expo.dev/guides/monorepos/.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;

module.exports = config;
