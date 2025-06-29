import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    {
      name: "service-worker-plugin",
      generateBundle(options, bundle) {
        // Collect all CSS and JS assets that were generated
        const staticAssets: string[] = [];

        console.log("bundle", bundle.fileName);
        Object.keys(bundle).forEach((fileName) => {
          // Only include CSS and JS files
          if (fileName.match(/\.(css|js)$/)) {
            staticAssets.push(`/build/client/${fileName}`);
          }
        });

        // Read your service worker template
        const swPath = path.resolve(__dirname, "app/service-worker.js");
        let swContent = fs.readFileSync(swPath, "utf-8");

        // Replace the STATIC_ASSETS array with the actual built assets
        swContent = swContent.replace(
          /const STATIC_ASSETS = \[[\s\S]*?\];/,
          `const STATIC_ASSETS = [
    ${staticAssets.map((asset) => `"${asset}"`).join(",\n    ")}
];`
        );

        // Emit the updated service worker
        this.emitFile({
          type: "asset",
          fileName: "service-worker.js",
          source: swContent,
        });
      },
    },
  ],
});
