import { Injectable } from '@angular/core';
import { PDFDocument, degrees } from 'pdf-lib';
import { ScannedPage } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  async export(pages: ScannedPage[], filename = 'scan.pdf'): Promise<void> {
    const pdf = await PDFDocument.create();

    for (const page of pages) {
      const imgBytes = await this.dataUrlToBytes(page.dataUrl);
      const isJpeg = page.dataUrl.startsWith('data:image/jpeg');
      const img = isJpeg
        ? await pdf.embedJpg(imgBytes)
        : await pdf.embedPng(imgBytes);

      const pdfPage = pdf.addPage([img.width, img.height]);

      if (page.rotation !== 0) {
        pdfPage.setRotation(degrees(page.rotation));
      }

      pdfPage.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    const bytes = await pdf.save();
    this.triggerDownload(bytes, filename);
  }

  private dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
    return fetch(dataUrl)
      .then(r => r.arrayBuffer())
      .then(buf => new Uint8Array(buf));
  }

  private triggerDownload(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
