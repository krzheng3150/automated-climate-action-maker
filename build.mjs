import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const isWatch = process.argv.includes('--watch');

function copyStaticFiles() {
  if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
  }
  const filesToCopy = ['manifest.json', 'popup.html', 'popup.css'];
  for (const file of filesToCopy) {
    if (existsSync(file)) {
      copyFileSync(file, `dist/${file}`);
    }
  }
  if (existsSync('icons')) {
    mkdirSync('dist/icons', { recursive: true });
    for (const size of [16, 32, 48, 128]) {
      const icon = `icons/icon-${size}.png`;
      if (existsSync(icon)) {
        copyFileSync(icon, `dist/${icon}`);
      }
    }
  }
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: {
    background: 'background.ts',
    content: 'content.ts',
    popup: 'popup.ts',
  },
  bundle: true,
  outdir: 'dist',
  target: 'chrome110',
  sourcemap: true,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [
      {
        name: 'copy-static-assets',
        setup(build) {
          build.onEnd(() => {
            copyStaticFiles();
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log('[esbuild] Watching for changes...');
} else {
  copyStaticFiles();
  await esbuild.build(buildOptions);
  console.log('[esbuild] Build complete. Output written to dist/');
}