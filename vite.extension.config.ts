import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function copyExtensionAssetsPlugin(): Plugin {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'chromeexe');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      // 1. Copy manifest.json
      const manifestSrc = path.resolve(__dirname, 'extension', 'manifest.json');
      const manifestDest = path.resolve(outDir, 'manifest.json');
      if (fs.existsSync(manifestSrc)) {
        fs.copyFileSync(manifestSrc, manifestDest);
        console.log('Copied manifest.json to chromeexe/');
      }

      // 2. Copy icons directory
      const iconsSrcDir = path.resolve(__dirname, 'extension', 'icons');
      const iconsDestDir = path.resolve(outDir, 'icons');
      if (!fs.existsSync(iconsDestDir)) {
        fs.mkdirSync(iconsDestDir, { recursive: true });
      }
      if (fs.existsSync(iconsSrcDir)) {
        const files = fs.readdirSync(iconsSrcDir);
        for (const file of files) {
          fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDestDir, file));
        }
        console.log(`Copied ${files.length} icons to chromeexe/icons/`);
      }

      // 3. Move popup.html to chromeexe/popup/popup.html
      const nestedPopupHtml = path.resolve(outDir, 'src', 'extension', 'popup', 'popup.html');
      const targetPopupDir = path.resolve(outDir, 'popup');
      const targetPopupHtml = path.resolve(targetPopupDir, 'popup.html');

      if (!fs.existsSync(targetPopupDir)) {
        fs.mkdirSync(targetPopupDir, { recursive: true });
      }

      if (fs.existsSync(nestedPopupHtml)) {
        let content = fs.readFileSync(nestedPopupHtml, 'utf-8');
        fs.writeFileSync(targetPopupHtml, content);
        console.log('Moved popup.html to chromeexe/popup/popup.html');
        // Clean up nested src folder
        fs.rmSync(path.resolve(outDir, 'src'), { recursive: true, force: true });
      }

      // 4. Mirror to dist-extension for compatibility
      const legacyDir = path.resolve(__dirname, 'dist-extension');
      if (fs.existsSync(legacyDir)) {
        fs.rmSync(legacyDir, { recursive: true, force: true });
      }
      fs.cpSync(outDir, legacyDir, { recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionAssetsPlugin()],
  build: {
    outDir: 'chromeexe',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, 'src/extension/content/content.tsx'),
        background: path.resolve(__dirname, 'src/extension/background/service-worker.ts'),
        popup: path.resolve(__dirname, 'src/extension/popup/popup.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/content.js';
          }
          return 'popup/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            if (assetInfo.name.includes('content')) {
              return 'content/content.css';
            }
            if (assetInfo.name.includes('popup')) {
              return 'popup/popup.css';
            }
          }
          return 'assets/[name][extname]';
        }
      }
    }
  }
});
