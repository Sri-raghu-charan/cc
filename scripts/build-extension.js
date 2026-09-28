import { build } from 'vite';
import path from 'path';
import fs from 'fs';
import react from '@vitejs/plugin-react';

async function runExtensionBuild() {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'chromeexe');

  console.log('Cleaning chromeexe/ directory...');
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'content'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'background'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'popup'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'icons'), { recursive: true });

  // 0. Build Page Bridge Script (MAIN world standalone IIFE)
  console.log('0. Building page bridge script (MAIN world)...');
  await build({
    configFile: false,
    publicDir: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    build: {
      outDir: path.join(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/extension/content/page-bridge.ts'),
        name: 'CctvPageBridge',
        formats: ['iife'],
        fileName: () => 'page-bridge.js'
      }
    }
  });

  // 1. Build Content Script as an IIFE (zero top-level imports, isolated, runs in classic content script)
  console.log('1. Building content script (IIFE standalone)...');
  await build({
    configFile: false,
    publicDir: false,
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    build: {
      outDir: path.join(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/extension/content/content.tsx'),
        name: 'CctvContentScript',
        formats: ['iife'],
        fileName: () => 'content.js'
      },
      rollupOptions: {
        output: {
          extend: true,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'content.css';
            }
            return '[name][extname]';
          }
        }
      }
    }
  });

  // Rename generated files.css or style.css to content.css if necessary
  const contentDir = path.join(outDir, 'content');
  const contentFiles = fs.readdirSync(contentDir);
  for (const f of contentFiles) {
    if (f.endsWith('.css') && f !== 'content.css') {
      const srcPath = path.join(contentDir, f);
      const destPath = path.join(contentDir, 'content.css');
      if (fs.existsSync(destPath)) {
        // Append content
        const extraCss = fs.readFileSync(srcPath, 'utf-8');
        fs.appendFileSync(destPath, '\n' + extraCss);
        fs.unlinkSync(srcPath);
      } else {
        fs.renameSync(srcPath, destPath);
      }
    }
  }

  // 2. Build Background Service Worker
  console.log('2. Building background service worker...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: path.join(outDir, 'background'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/extension/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js'
      }
    }
  });

  // 3. Build Popup
  console.log('3. Building popup UI...');
  const popupSrcDir = path.resolve(rootDir, 'src/extension/popup');
  await build({
    configFile: false,
    publicDir: false,
    root: popupSrcDir,
    plugins: [react()],
    base: './',
    build: {
      outDir: path.join(outDir, 'popup'),
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(popupSrcDir, 'popup.html')
      }
    }
  });

  // 4. Copy manifest and icons
  console.log('4. Copying manifest and icons...');
  fs.copyFileSync(
    path.resolve(rootDir, 'extension', 'manifest.json'),
    path.join(outDir, 'manifest.json')
  );

  const iconsSrc = path.resolve(rootDir, 'extension', 'icons');
  if (fs.existsSync(iconsSrc)) {
    const iconFiles = fs.readdirSync(iconsSrc);
    for (const f of iconFiles) {
      fs.copyFileSync(path.join(iconsSrc, f), path.join(outDir, 'icons', f));
    }
  }

  // Also maintain dist-extension for backward compatibility
  const legacyDir = path.resolve(rootDir, 'dist-extension');
  if (fs.existsSync(legacyDir)) {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
  fs.cpSync(outDir, legacyDir, { recursive: true });

  console.log('Extension build completed successfully into chromeexe/ (and mirrored to dist-extension/)!');
}

runExtensionBuild().catch((err) => {
  console.error('Extension build failed:', err);
  process.exit(1);
});
