import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Tell webpack to ignore .wasm files imported inline — Rive loads
// rive.wasm at runtime via fetch() using its own locateFile mechanism,
// so webpack must not try to bundle it.
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.wasm$/,
          type: "asset/resource",
        },
      ],
    },
  };
});
