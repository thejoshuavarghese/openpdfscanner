import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScannerService } from './services/scanner.service';
import { PdfExportService } from './services/pdf-export.service';
import { PlatformService } from './services/platform.service';
import { PageListComponent } from './components/page-list/page-list.component';
import { ScanEditorComponent } from './components/scan-editor/scan-editor.component';
import { ReviewModalComponent } from './components/review-modal/review-modal.component';
import { ImageEditorComponent } from './components/image-editor/image-editor.component';
import { ScannedPage } from './models/page.model';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PageListComponent,
    ScanEditorComponent,
    ReviewModalComponent,
    ImageEditorComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  scanner = inject(ScannerService);
  pdfExport = inject(PdfExportService);
  platform = inject(PlatformService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  showScanEditor = signal(false);
  showReviewModal = signal(false);
  showImageEditor = signal(false);

  pendingQueue: { dataUrl: string; name: string }[] = [];
  currentScan: { dataUrl: string; name: string } | null = null;
  currentReview: string | null = null;
  editingPage: ScannedPage | null = null;

  toastMsg = signal('');
  toastVisible = signal(false);
  private toastTimer: any;

  exporting = signal(false);

  // ── Capture ───────────────────────────────────────────────────────

  async capturePhoto(): Promise<void> {
    if (this.platform.supportsNativeCamera) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 90,
        });
        if (photo.dataUrl) this.enqueue(photo.dataUrl, 'Scan');
      } catch (err) {
        console.warn('Camera cancelled', err);
      }
    } else {
      this.fileInputRef.nativeElement.accept = 'image/*';
      this.fileInputRef.nativeElement.capture = 'environment';
      this.fileInputRef.nativeElement.multiple = false;
      this.fileInputRef.nativeElement.click();
    }
  }

  pickFiles(): void {
    this.fileInputRef.nativeElement.accept = 'image/*';
    this.fileInputRef.nativeElement.removeAttribute('capture');
    this.fileInputRef.nativeElement.multiple = true;
    this.fileInputRef.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => this.enqueue(reader.result as string, file.name.replace(/\.[^.]+$/, ''));
      reader.readAsDataURL(file);
    });
    (event.target as HTMLInputElement).value = '';
  }

  // ── Queue management ──────────────────────────────────────────────

  private enqueue(dataUrl: string, name: string): void {
    this.pendingQueue.push({ dataUrl, name });
    if (!this.showScanEditor()) this.processNext();
  }

  processNext(): void {
    if (this.pendingQueue.length === 0) return;
    this.currentScan = this.pendingQueue.shift()!;
    this.showScanEditor.set(true);
  }

  onCropApplied(croppedDataUrl: string): void {
    this.currentReview = croppedDataUrl;
    this.showScanEditor.set(false);
    this.showReviewModal.set(true);
  }

  onScanCancelled(): void {
    this.showScanEditor.set(false);
    this.currentScan = null;
    this.processNext();
  }

  onReviewAccepted(): void {
    if (this.currentReview && this.currentScan) {
      this.scanner.addPage(this.currentReview, this.currentScan.name);
      this.showToast('Page added');
    }
    this.showReviewModal.set(false);
    this.currentReview = null;
    this.currentScan = null;
    this.processNext();
  }

  onReviewBack(): void {
    this.showReviewModal.set(false);
    this.showScanEditor.set(true);
  }

  onReviewDiscarded(): void {
    this.showReviewModal.set(false);
    this.currentReview = null;
    this.currentScan = null;
    this.processNext();
  }

  // ── Page list actions ─────────────────────────────────────────────

  onEditPage(page: ScannedPage): void {
    this.editingPage = page;
    this.showImageEditor.set(true);
  }

  onEditorClose(): void {
    this.showImageEditor.set(false);
    this.editingPage = null;
  }

  clearAll(): void {
    this.scanner.clearAll();
    this.showToast('All pages cleared');
  }

  // ── Export ────────────────────────────────────────────────────────

  async exportPdf(): Promise<void> {
    const pages = this.scanner.pages();
    if (!pages.length) return;
    this.exporting.set(true);
    try {
      await this.pdfExport.export(pages);
      this.showToast('PDF saved!');
    } catch (err) {
      this.showToast('Export failed — please try again');
      console.error(err);
    } finally {
      this.exporting.set(false);
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────

  showToast(msg: string): void {
    this.toastMsg.set(msg);
    this.toastVisible.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastVisible.set(false), 2200);
  }
}
