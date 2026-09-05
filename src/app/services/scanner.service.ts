import { Injectable, signal } from '@angular/core';
import { Corner, CropCorners, ScannedPage } from '../models/page.model';

declare const cv: any;

@Injectable({ providedIn: 'root' })
export class ScannerService {
  pages = signal<ScannedPage[]>([]);
  private idCounter = 0;

  private readonly OPENCV_SOURCES = [
    'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.1/dist/opencv.js',
    'https://unpkg.com/@techstark/opencv-js@4.9.0-release.1/dist/opencv.js',
    'https://docs.opencv.org/4.9.0/opencv.js',
  ];
  private cvLoadPromise: Promise<void> | null = null;

  // ── Page management ──────────────────────────────────────────────

  addPage(dataUrl: string, name: string): void {
    this.pages.update(p => [...p, { id: this.idCounter++, dataUrl, rotation: 0, name }]);
  }

  removePage(id: number): void {
    this.pages.update(p => p.filter(page => page.id !== id));
  }

  reorderPages(pages: ScannedPage[]): void {
    this.pages.set([...pages]);
  }

  rotatePage(id: number, delta: 90 | -90): void {
    this.pages.update(p =>
      p.map(page =>
        page.id === id
          ? { ...page, rotation: ((page.rotation + delta + 360) % 360) as 0 | 90 | 180 | 270 }
          : page
      )
    );
  }

  clearAll(): void {
    this.pages.set([]);
  }

  // ── OpenCV loading ────────────────────────────────────────────────

  loadCv(timeoutMs = 20000): Promise<void> {
    if (typeof cv !== 'undefined' && cv.Mat) return Promise.resolve();
    if (this.cvLoadPromise) return this.cvLoadPromise;

    this.cvLoadPromise = (async () => {
      let lastErr: Error | null = null;
      for (const src of this.OPENCV_SOURCES) {
        try {
          await this.loadScript(src, timeoutMs);
          if (typeof cv !== 'undefined' && cv.Mat) return;
        } catch (err) {
          lastErr = err as Error;
          console.warn('OpenCV source failed:', src);
        }
      }
      this.cvLoadPromise = null;
      throw lastErr ?? new Error('All OpenCV sources failed');
    })();

    return this.cvLoadPromise;
  }

  private loadScript(src: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (ok: boolean, err?: Error) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timer);
        ok ? resolve() : reject(err ?? new Error('failed'));
      };
      const timer = setTimeout(() => finish(false, new Error('timeout: ' + src)), timeoutMs);
      const poll = setInterval(() => { if (typeof cv !== 'undefined' && cv.Mat) finish(true); }, 100);
      script.src = src;
      script.async = true;
      script.onload = () => {
        if (typeof cv !== 'undefined' && cv.Mat) { finish(true); return; }
        if (typeof cv !== 'undefined') cv.onRuntimeInitialized = () => finish(true);
      };
      script.onerror = () => finish(false, new Error('failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  // ── Auto-detect document edges ────────────────────────────────────

  async autoDetectCorners(canvas: HTMLCanvasElement): Promise<CropCorners | null> {
    await this.loadCv();
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edged = new cv.Mat();
    const dilated = new cv.Mat();
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edged, 50, 150);
      cv.dilate(edged, dilated, kernel);
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestQuad: any = null;
      let bestArea = 0;
      const imgArea = src.rows * src.cols;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4) {
          const area = Math.abs(cv.contourArea(approx));
          if (area > bestArea && area > imgArea * 0.15) {
            bestArea = area;
            if (bestQuad) bestQuad.delete();
            bestQuad = approx;
          } else approx.delete();
        } else approx.delete();
        cnt.delete();
      }

      if (!bestQuad) return null;

      const pts: Corner[] = [];
      for (let i = 0; i < 4; i++) {
        pts.push({ x: bestQuad.intPtr(i, 0)[0], y: bestQuad.intPtr(i, 0)[1] });
      }
      bestQuad.delete();
      return this.orderCorners(pts);
    } finally {
      src.delete(); gray.delete(); blurred.delete();
      edged.delete(); dilated.delete(); kernel.delete();
      contours.delete(); hierarchy.delete();
    }
  }

  // ── Perspective warp ──────────────────────────────────────────────

  async perspectiveWarp(canvas: HTMLCanvasElement, corners: CropCorners): Promise<string> {
    const [tl, tr, br, bl] = corners;
    const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);
    const outW = Math.max(Math.round(Math.max(dist(tl, tr), dist(bl, br))), 50);
    const outH = Math.max(Math.round(Math.max(dist(tl, bl), dist(tr, br))), 50);

    try {
      await this.loadCv();
      const src = cv.imread(canvas);
      const dst = new cv.Mat();
      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      cv.warpPerspective(src, dst, M, new cv.Size(outW, outH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      const out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      cv.imshow(out, dst);
      [src, dst, srcPts, dstPts, M].forEach(m => m.delete());
      return out.toDataURL('image/jpeg', 0.92);
    } catch {
      // Fallback: bounding-box crop
      const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
      const minX = Math.max(0, Math.min(...xs)), minY = Math.max(0, Math.min(...ys));
      const maxX = Math.min(canvas.width, Math.max(...xs)), maxY = Math.min(canvas.height, Math.max(...ys));
      const cw = Math.max(1, maxX - minX), ch = Math.max(1, maxY - minY);
      const out = document.createElement('canvas');
      out.width = cw; out.height = ch;
      out.getContext('2d')!.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
      return out.toDataURL('image/jpeg', 0.92);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private orderCorners(pts: Corner[]): CropCorners {
    const sum = pts.map(p => p.x + p.y);
    const diff = pts.map(p => p.x - p.y);
    return [
      pts[sum.indexOf(Math.min(...sum))],   // TL
      pts[diff.indexOf(Math.max(...diff))], // TR
      pts[sum.indexOf(Math.max(...sum))],   // BR
      pts[diff.indexOf(Math.min(...diff))], // BL
    ];
  }

  defaultCorners(w: number, h: number): CropCorners {
    const pad = 20;
    return [
      { x: pad, y: pad },
      { x: w - pad, y: pad },
      { x: w - pad, y: h - pad },
      { x: pad, y: h - pad },
    ];
  }
}
