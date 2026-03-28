// esbuild.mjs - Bundle VS Code extension into a single file
// vscode is provided at runtime by the extension host, so it must be external.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: false,
});

console.log('✅ Extension bundled to out/extension.js');
