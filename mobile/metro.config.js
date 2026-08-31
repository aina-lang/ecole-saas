const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  "react-native",
  "require",
  "default",
];

// Keep Metro out of the native build output. Without watchman installed, Metro falls back to
// a watcher that crawls a directory then watches it — and crashes with ENOENT if the
// directory disappeared in between. Gradle creates and deletes its intermediates constantly
// (data_binding_layout_info_type_merge/... is a known offender), so a `run:android` that
// bundles right after compiling hits that race reliably. None of this is source Metro needs,
// and skipping it also avoids crawling tens of thousands of generated files.
const nativeBuildArtifacts = [
  /\/android\/app\/build\/.*/,
  /\/android\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/android\/\.kotlin\/.*/,
  /\/ios\/build\/.*/,
];
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, nativeBuildArtifacts)
  : nativeBuildArtifacts;

module.exports = withNativeWind(config, { input: "./global.css" });
