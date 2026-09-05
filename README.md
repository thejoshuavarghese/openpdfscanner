# Open PDF Scanner

Cross-platform, fully offline document scanner. No accounts, no cloud, no tracking.
Built with Angular 18 + TypeScript. Ships as a PWA (web), desktop app (Tauri), and mobile app (Capacitor).

## Stack
- **Frontend**: Angular 18, TypeScript, SCSS
- **Image processing**: OpenCV.js (lazy-loaded, auto-detects document edges)
- **PDF export**: pdf-lib
- **Desktop**: Tauri (Rust shell, tiny binary)
- **Mobile**: Capacitor (iOS & Android)
- **PWA**: @angular/pwa (offline, installable from browser)

---

## Development

```bash
npm install
npm start          # Dev server at http://localhost:4200
```

---

## Build & Deploy

### Web / PWA
```bash
npm run build:prod
# Deploy dist/open-pdf-scanner/browser/ to any static host
```

### Android
```bash
# Prerequisites: Android Studio + Android SDK
npm run cap:android
# Opens Android Studio — press Run
```

### iOS
```bash
# Prerequisites: Xcode (macOS only)
npm run cap:ios
# Opens Xcode — press Run
```

### Desktop (Tauri)
```bash
# Prerequisites: Rust + system WebView (pre-installed on Win/Mac/Linux)
# https://tauri.app/start/prerequisites/
npm run tauri:dev    # Dev mode
npm run tauri:build  # Produces installer in src-tauri/target/release/bundle/
```

---

## Project Structure

```
src/app/
  models/
    page.model.ts          # ScannedPage, Corner, CropCorners types
  services/
    scanner.service.ts     # OpenCV auto-detect, perspective warp, page state (Signals)
    pdf-export.service.ts  # pdf-lib export
    platform.service.ts    # Detects web / Tauri / Capacitor
  components/
    page-list/             # Draggable page list
    scan-editor/           # Perspective-crop modal with corner handles
    review-modal/          # Accept / discard after crop
    image-editor/          # Rotate an existing page
src-tauri/                 # Tauri desktop shell
capacitor.config.ts        # Capacitor mobile config
```

---

## Adding Tauri (first time)
```bash
npm install --save-dev @tauri-apps/cli @tauri-apps/api
# Then: npm run tauri:build
```

## Adding Capacitor platforms (first time)
```bash
npx cap add android
npx cap add ios
```
