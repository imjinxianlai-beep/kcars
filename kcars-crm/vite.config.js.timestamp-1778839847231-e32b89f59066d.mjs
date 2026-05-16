// vite.config.js
import { defineConfig } from "file:///Users/isakswaglai/Documents/GitHub/kcars/kcars-crm/node_modules/vite/dist/node/index.js";
import react from "file:///Users/isakswaglai/Documents/GitHub/kcars/kcars-crm/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///Users/isakswaglai/Documents/GitHub/kcars/kcars-crm/vite.config.js";
var __dirname = fileURLToPath(new URL(".", __vite_injected_original_import_meta_url));
var stableDevServer = {
  name: "stable-dev-server",
  configureServer(server) {
    const noWatch = /* @__PURE__ */ new Set([
      path.resolve(__dirname, ".env"),
      path.resolve(__dirname, ".env.local"),
      path.resolve(__dirname, ".env.production"),
      path.resolve(__dirname, "vite.config.js"),
      path.resolve(__dirname, "package.json")
    ]);
    const _emit = server.watcher.emit.bind(server.watcher);
    server.watcher.emit = function(event, filePath, ...args) {
      if ((event === "change" || event === "add" || event === "unlink") && typeof filePath === "string" && noWatch.has(path.resolve(filePath))) {
        return false;
      }
      return _emit(event, filePath, ...args);
    };
  }
};
var vite_config_default = defineConfig({
  plugins: [react(), stableDevServer],
  resolve: {
    alias: {
      "lucide-react": path.resolve(__dirname, "src/lib/lucide-react-shim.jsx")
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/.env", "**/vite.config.js", "**/package.json", "**/.git/**", "**/node_modules/**"]
    }
  },
  optimizeDeps: {
    // framer-motion v12 ships native ESM — exclude from esbuild pre-bundling to avoid
    // the deps_temp infinite-optimization loop that occurs on slow machines.
    exclude: ["framer-motion"]
  },
  build: {
    rollupOptions: {
      // framer-motion v12 ESM has deep circular deps that hang Rollup — use the pre-resolved CJS bundle.
      plugins: [
        {
          name: "framer-motion-cjs",
          resolveId(id) {
            if (id === "framer-motion") {
              return path.resolve(__dirname, "node_modules/framer-motion/dist/cjs/index.js");
            }
          }
        }
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaXNha3N3YWdsYWkvRG9jdW1lbnRzL0dpdEh1Yi9rY2Fycy9rY2Fycy1jcm1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9pc2Frc3dhZ2xhaS9Eb2N1bWVudHMvR2l0SHViL2tjYXJzL2tjYXJzLWNybS92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaXNha3N3YWdsYWkvRG9jdW1lbnRzL0dpdEh1Yi9rY2Fycy9rY2Fycy1jcm0vdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnXG5cbmNvbnN0IF9fZGlybmFtZSA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpXG5cbi8vIG1hY09TIEZTRXZlbnRzIGZpcmVzIG9uIGZpbGUgUkVBRFMgKFNwb3RsaWdodCwgVlMgQ29kZSwgVGltZSBNYWNoaW5lKSwgbm90IGp1c3Qgd3JpdGVzLlxuLy8gVml0ZSB3YXRjaGVzIC5lbnYgYW5kIHZpdGUuY29uZmlnLmpzIGFuZCB0cmVhdHMgYW55IEZTRXZlbnQgYXMgYSBjb250ZW50IGNoYW5nZSBcdTIxOTIgcmVzdGFydCBsb29wLlxuLy8gc2VydmVyLndhdGNoZXIudW53YXRjaCgpIGlzIHVucmVsaWFibGUgaGVyZSBiZWNhdXNlIFZpdGUgcmUtYWRkcyB0aGVzZSBmaWxlcyBhZnRlciBjb25maWd1cmVTZXJ2ZXIuXG4vLyBGaXg6IGludGVyY2VwdCB0aGUgd2F0Y2hlcidzIEV2ZW50RW1pdHRlci5lbWl0KCkgZGlyZWN0bHkgYW5kIGRyb3AgY2hhbmdlIGV2ZW50cyBmb3IgcHJvdGVjdGVkXG4vLyBmaWxlcyBiZWZvcmUgdGhleSByZWFjaCBWaXRlJ3MgcmVzdGFydCBoYW5kbGVyLlxuY29uc3Qgc3RhYmxlRGV2U2VydmVyID0ge1xuICBuYW1lOiAnc3RhYmxlLWRldi1zZXJ2ZXInLFxuICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgY29uc3Qgbm9XYXRjaCA9IG5ldyBTZXQoW1xuICAgICAgcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy5lbnYnKSxcbiAgICAgIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuZW52LmxvY2FsJyksXG4gICAgICBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLmVudi5wcm9kdWN0aW9uJyksXG4gICAgICBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAndml0ZS5jb25maWcuanMnKSxcbiAgICAgIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlLmpzb24nKSxcbiAgICBdKVxuXG4gICAgY29uc3QgX2VtaXQgPSBzZXJ2ZXIud2F0Y2hlci5lbWl0LmJpbmQoc2VydmVyLndhdGNoZXIpXG4gICAgc2VydmVyLndhdGNoZXIuZW1pdCA9IGZ1bmN0aW9uIChldmVudCwgZmlsZVBhdGgsIC4uLmFyZ3MpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGV2ZW50ID09PSAnY2hhbmdlJyB8fCBldmVudCA9PT0gJ2FkZCcgfHwgZXZlbnQgPT09ICd1bmxpbmsnKSAmJlxuICAgICAgICB0eXBlb2YgZmlsZVBhdGggPT09ICdzdHJpbmcnICYmXG4gICAgICAgIG5vV2F0Y2guaGFzKHBhdGgucmVzb2x2ZShmaWxlUGF0aCkpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgICByZXR1cm4gX2VtaXQoZXZlbnQsIGZpbGVQYXRoLCAuLi5hcmdzKVxuICAgIH1cbiAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIHN0YWJsZURldlNlcnZlcl0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ2x1Y2lkZS1yZWFjdCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvbGliL2x1Y2lkZS1yZWFjdC1zaGltLmpzeCcpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICB3YXRjaDoge1xuICAgICAgaWdub3JlZDogWycqKi8uZW52JywgJyoqL3ZpdGUuY29uZmlnLmpzJywgJyoqL3BhY2thZ2UuanNvbicsICcqKi8uZ2l0LyoqJywgJyoqL25vZGVfbW9kdWxlcy8qKiddLFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIC8vIGZyYW1lci1tb3Rpb24gdjEyIHNoaXBzIG5hdGl2ZSBFU00gXHUyMDE0IGV4Y2x1ZGUgZnJvbSBlc2J1aWxkIHByZS1idW5kbGluZyB0byBhdm9pZFxuICAgIC8vIHRoZSBkZXBzX3RlbXAgaW5maW5pdGUtb3B0aW1pemF0aW9uIGxvb3AgdGhhdCBvY2N1cnMgb24gc2xvdyBtYWNoaW5lcy5cbiAgICBleGNsdWRlOiBbJ2ZyYW1lci1tb3Rpb24nXSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAvLyBmcmFtZXItbW90aW9uIHYxMiBFU00gaGFzIGRlZXAgY2lyY3VsYXIgZGVwcyB0aGF0IGhhbmcgUm9sbHVwIFx1MjAxNCB1c2UgdGhlIHByZS1yZXNvbHZlZCBDSlMgYnVuZGxlLlxuICAgICAgcGx1Z2luczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ2ZyYW1lci1tb3Rpb24tY2pzJyxcbiAgICAgICAgICByZXNvbHZlSWQoaWQpIHtcbiAgICAgICAgICAgIGlmIChpZCA9PT0gJ2ZyYW1lci1tb3Rpb24nKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL2ZyYW1lci1tb3Rpb24vZGlzdC9janMvaW5kZXguanMnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyVSxTQUFTLG9CQUFvQjtBQUN4VyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMscUJBQXFCO0FBSGdMLElBQU0sMkNBQTJDO0FBSy9QLElBQU0sWUFBWSxjQUFjLElBQUksSUFBSSxLQUFLLHdDQUFlLENBQUM7QUFPN0QsSUFBTSxrQkFBa0I7QUFBQSxFQUN0QixNQUFNO0FBQUEsRUFDTixnQkFBZ0IsUUFBUTtBQUN0QixVQUFNLFVBQVUsb0JBQUksSUFBSTtBQUFBLE1BQ3RCLEtBQUssUUFBUSxXQUFXLE1BQU07QUFBQSxNQUM5QixLQUFLLFFBQVEsV0FBVyxZQUFZO0FBQUEsTUFDcEMsS0FBSyxRQUFRLFdBQVcsaUJBQWlCO0FBQUEsTUFDekMsS0FBSyxRQUFRLFdBQVcsZ0JBQWdCO0FBQUEsTUFDeEMsS0FBSyxRQUFRLFdBQVcsY0FBYztBQUFBLElBQ3hDLENBQUM7QUFFRCxVQUFNLFFBQVEsT0FBTyxRQUFRLEtBQUssS0FBSyxPQUFPLE9BQU87QUFDckQsV0FBTyxRQUFRLE9BQU8sU0FBVSxPQUFPLGFBQWEsTUFBTTtBQUN4RCxXQUNHLFVBQVUsWUFBWSxVQUFVLFNBQVMsVUFBVSxhQUNwRCxPQUFPLGFBQWEsWUFDcEIsUUFBUSxJQUFJLEtBQUssUUFBUSxRQUFRLENBQUMsR0FDbEM7QUFDQSxlQUFPO0FBQUEsTUFDVDtBQUNBLGFBQU8sTUFBTSxPQUFPLFVBQVUsR0FBRyxJQUFJO0FBQUEsSUFDdkM7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLGVBQWU7QUFBQSxFQUNsQyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxnQkFBZ0IsS0FBSyxRQUFRLFdBQVcsK0JBQStCO0FBQUEsSUFDekU7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsV0FBVyxxQkFBcUIsbUJBQW1CLGNBQWMsb0JBQW9CO0FBQUEsSUFDakc7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUE7QUFBQTtBQUFBLElBR1osU0FBUyxDQUFDLGVBQWU7QUFBQSxFQUMzQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBO0FBQUEsTUFFYixTQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsTUFBTTtBQUFBLFVBQ04sVUFBVSxJQUFJO0FBQ1osZ0JBQUksT0FBTyxpQkFBaUI7QUFDMUIscUJBQU8sS0FBSyxRQUFRLFdBQVcsOENBQThDO0FBQUEsWUFDL0U7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
