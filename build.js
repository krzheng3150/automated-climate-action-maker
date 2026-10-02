import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'node:fs';

const isWatch = process.argv.includes('--watch');

function copyStaticAssets() {
  if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
  }
  cpSync('public', 'dist', { recursive: true });
}

copyStaticAssets();

const configs = [
  {
    entryPoints: ['src/content/content.ts'],
    bundle: true,
    outfile: 'dist/content.js',
    format: 'iife',
    sourcemap: true,
    target: ['chrome100', 'firefox100'],
  },
  {
    entryPoints: ['src/background/background.ts'],
    bundle: true,
    outfile: 'dist/background.js',
    format: 'esm',
    sourcemap: true,
    target: ['chrome100', 'firefox100'],
  },
  {
    entryPoints: ['src/popup/popup.ts'],
    bundle: true,
    outfile: 'dist/popup.js',
    format: 'iife',
    sourcemap: true,
    target: ['chrome100', 'firefox100'],
  },
];

if (isWatch) {
  for (const config of configs) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  }
  console.log('⚡ Watching for changes...');
} else {
  for (const config of configs) {
    await esbuild.build(config);
  }
  console.log('✅ Build complete! Output placed in dist/');
}