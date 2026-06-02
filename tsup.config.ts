import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Fourni par le runtime Homebridge: ne pas bundler.
  external: ['homebridge', '@matter/main', '@matter/main/devices/occupancy-sensor'],
});
