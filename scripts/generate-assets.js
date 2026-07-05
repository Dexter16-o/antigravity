const fs = require('fs');
const path = require('path');

// A valid base64 PNG for a solid emerald green square (PWA Icon)
const ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEBAQMAAABKo7VPAAAAA1BMVEUQsP+T1nviAAAAG0lEQVR4Ae3BMQEAAADCoPVPbQwfoAAAAIC3AQ+gAAEq57c1AAAAAElFTkSuQmCC';

// A valid base64 PNG for a dark slate rectangle (PWA Splash Screen)
const SPLASH_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYCAMAAACj/z8RAAAAA1BMVEUDBxY5n2N+AAAASElEQVR4Ae3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwBt4HAAGg8jLgAAAAAElFTkSuQmCC';

const makeDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const writeAsset = (filePath, base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Asset generated: ${filePath}`);
};

const run = () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const splashDir = path.join(publicDir, 'splash');

  makeDir(iconsDir);
  makeDir(splashDir);

  // Write PWA Icons
  writeAsset(path.join(iconsDir, 'icon-192.png'), ICON_BASE64);
  writeAsset(path.join(iconsDir, 'icon-512.png'), ICON_BASE64);
  writeAsset(path.join(iconsDir, 'icon-maskable.png'), ICON_BASE64);
  writeAsset(path.join(iconsDir, 'apple-touch-icon.png'), ICON_BASE64);

  // Write iOS Splash Screens
  const splashScreens = [
    'apple-splash-2048-2732.png',
    'apple-splash-1668-2388.png',
    'apple-splash-1536-2048.png',
    'apple-splash-1290-2796.png',
    'apple-splash-1179-2556.png',
    'apple-splash-1284-2778.png',
    'apple-splash-1170-2532.png',
    'apple-splash-1125-2436.png',
    'apple-splash-1242-2688.png',
    'apple-splash-828-1792.png'
  ];

  splashScreens.forEach(screen => {
    writeAsset(path.join(splashDir, screen), SPLASH_BASE64);
  });

  console.log('🎉 All mock PWA assets successfully generated!');
};

run();
