import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: ["src/**/*"],
  clean: true,
  format: ["esm"],
  target: "esnext",
  // 避免產出很多 chunk 造成動態載入
  splitting: false,
  sourcemap: true,
  external: ["@pinecone-database"],
  ...options,
}));
