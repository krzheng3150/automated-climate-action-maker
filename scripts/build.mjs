import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFoodData, verifyFoodBundle } from './generate-food-data.mjs';
import { generateSwaps } from './generate-swaps.mjs';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');

const isWatch = process.argv.includes('--watch');

// Regenerate src/food/data.ts from the raw AGRIBALYSE CSV when it is present locally; otherwise
// the committed file is used. Either way the table is compiled into the background bundle.
const foodData = generateFoodData();
console.log(`[food-data] ${foodData.status}${foodData.count ? ` (${foodData.count} foods)` : ''}`);

// Swap rules are validated against the food table on every build; a rule without evidence or
// without carbon numbers for a changed food fails here.
const swapRules = generateSwaps();
console.log(`[swaps] ${swapRules.changed ? 'updated' : 'unchanged'} (${swapRules.rules} rules)`);

function checkFoodBundle() {
  const { foods, version } = verifyFoodBundle();
  console.log(`[food-data] bundle verified: ${foods} foods, AGRIBALYSE ${version}, background only`);
}

function copyStaticFiles() {
  const distDir = path.join(projectRoot, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest
  const manifestSrc = path.join(projectRoot, 'manifest.json');
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, path.join(distDir, 'manifest.json'));
  }

  // Ship the single data-credit file with every build
  const noticeSrc = path.join(projectRoot, 'data', 'NOTICE');
  if (existsSync(noticeSrc)) {
    copyFileSync(noticeSrc, path.join(distDir, 'NOTICE'));
  }

  // Copy popup static assets from src/
  for (const file of ['popup.html', 'popup.css']) {
    const srcPath = path.join(projectRoot, 'src', file);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, path.join(distDir, file));
    }
  }

  // Copy icons from assets/icons/ to dist/icons/
  const iconsSrcDir = path.join(projectRoot, 'assets', 'icons');
  if (existsSync(iconsSrcDir)) {
    const distIconsDir = path.join(distDir, 'icons');
    mkdirSync(distIconsDir, { recursive: true });
    for (const size of [16, 32, 48, 128]) {
      const iconPath = path.join(iconsSrcDir, `icon-${size}.png`);
      if (existsSync(iconPath)) {
        copyFileSync(iconPath, path.join(distIconsDir, `icon-${size}.png`));
      }
    }
  }
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: {
    background: path.join(projectRoot, 'src/background.ts'),
    content: path.join(projectRoot, 'src/content.ts'),
    popup: path.join(projectRoot, 'src/popup.ts'),
  },
  bundle: true,
  outdir: path.join(projectRoot, 'dist'),
  target: 'chrome110',
  sourcemap: true,
  minify: !isWatch,
};

const libBuildOptions = {
  entryPoints: {
    index: path.join(projectRoot, 'src/index.ts'),
    outbound: path.join(projectRoot, 'src/outbound.ts'),
    food: path.join(projectRoot, 'src/food/index.ts'),
  },
  bundle: true,
  format: 'esm',
  outdir: path.join(projectRoot, 'dist'),
  target: 'node18',
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
            try {
              checkFoodBundle();
            } catch (err) {
              console.error(err.message);
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log('[esbuild] Watching for changes...');
} else {
  copyStaticFiles();
  await Promise.all([
    esbuild.build(buildOptions),
    esbuild.build(libBuildOptions),
  ]);
  checkFoodBundle();
  console.log('[esbuild] Build complete. Output written to dist/');
}
