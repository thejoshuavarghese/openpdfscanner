import {
  Component, Input, Output, EventEmitter,
  OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScannerService } from '../../services/scanner.service';
import { Corner, CropCorners } from '../../models/page.model';

@Component({
  selector: 'app-scan-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scan-editor.component.html',
  styleUrls: ['./scan-editor.component.scss'],
})
export class ScanEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() imageDataUrl!: string;
  @Output() cropApplied = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('scanCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  scanner = inject(ScannerService);

  corners!: CropCorners;
  status = '';
  detecting = false;
  applying = false;
  rotation = 0;

  private img!: HTMLImageElement;
  private activeCorner: number | null = null;
  private ctx!: CanvasRenderingContext2D;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.img = new Image();
    this.img.onload = () => this.layout();
    this.img.src = this.imageDataUrl;
  }

  layout(): void {
    const canvas = this.canvasRef.nativeElement;
    const wrap = canvas.parentElement!;
    const maxW = wrap.clientWidth - 20;
    const maxH = wrap.clientHeight - 20;
    const scale = Math.min(maxW / this.img.width, maxH / this.img.height, 1);
    canvas.width = Math.round(this.img.width * scale);
    canvas.height = Math.round(this.img.height * scale);
    this.ctx = canvas.getContext('2d')!;
    this.ctx.drawImage(this.img, 0, 0, canvas.width, canvas.height);
    if (!this.corners) {
      this.corners = this.scanner.defaultCorners(canvas.width, canvas.height);
    }
    this.drawOverlay();
  }

  drawOverlay(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.drawImage(this.img, 0, 0, canvas.width, canvas.height);

    // Dimming overlay
    this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Crop region
    this.ctx.save();
    this.ctx.beginPath();
    const [tl, tr, br, bl] = this.corners;
    this.ctx.moveTo(tl.x, tl.y);
    this.ctx.lineTo(tr.x, tr.y);
    this.ctx.lineTo(br.x, br.y);
    this.ctx.lineTo(bl.x, bl.y);
    this.ctx.closePath();
    this.ctx.clip();
    this.ctx.drawImage(this.img, 0, 0, canvas.width, canvas.height);
    this.ctx.restore();

    // Outline
    this.ctx.strokeStyle = '#4f8cff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(tl.x, tl.y);
    [tr, br, bl].forEach(c => this.ctx.lineTo(c.x, c.y));
    this.ctx.closePath();
    this.ctx.stroke();

    // Corner handles
    this.corners.forEach(c => {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(79,140,255,0.25)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
  }

  getEventPos(event: MouseEvent | TouchEvent): Corner {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX ?? event.changedTouches[0].clientX;
      clientY = event.touches[0]?.clientY ?? event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  onPointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    const pos = this.getEventPos(event);
    let closest = -1, minDist = 30;
    this.corners.forEach((c, i) => {
      const d = Math.hypot(c.x - pos.x, c.y - pos.y);
      if (d < minDist) { minDist = d; closest = i; }
    });
    this.activeCorner = closest >= 0 ? closest : null;
  }

  onPointerMove(event: MouseEvent | TouchEvent): void {
    if (this.activeCorner === null) return;
    event.preventDefault();
    const pos = this.getEventPos(event);
    const canvas = this.canvasRef.nativeElement;
    const updated = [...this.corners] as CropCorners;
    updated[this.activeCorner] = {
      x: Math.max(0, Math.min(canvas.width, pos.x)),
      y: Math.max(0, Math.min(canvas.height, pos.y)),
    };
    this.corners = updated;
    this.drawOverlay();
  }

  onPointerUp(): void {
    this.activeCorner = null;
  }

  resetCorners(): void {
    const canvas = this.canvasRef.nativeElement;
    this.corners = this.scanner.defaultCorners(canvas.width, canvas.height);
    this.drawOverlay();
  }

  async autoDetect(): Promise<void> {
    this.detecting = true;
    this.status = 'Detecting edges…';
    try {
      const found = await this.scanner.autoDetectCorners(this.canvasRef.nativeElement);
      if (found) {
        this.corners = found;
        this.drawOverlay();
        this.status = 'Edges detected — adjust if needed';
      } else {
        this.status = 'No clear edge found — adjust corners manually';
      }
    } catch {
      this.status = 'Auto-detect unavailable — adjust corners manually';
    } finally {
      this.detecting = false;
      setTimeout(() => (this.status = ''), 3000);
    }
  }

  async applyCrop(): Promise<void> {
    this.applying = true;
    this.status = 'Flattening page…';
    try {
      const result = await this.scanner.perspectiveWarp(this.canvasRef.nativeElement, this.corners);
      this.cropApplied.emit(result);
    } catch {
      this.status = 'Could not process — try adjusting corners';
    } finally {
      this.applying = false;
    }
  }

  ngOnDestroy(): void {}
}
