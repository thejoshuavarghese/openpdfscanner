import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScannedPage } from '../../models/page.model';
import { ScannerService } from '../../services/scanner.service';

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss'],
})
export class ImageEditorComponent {
  @Input() page!: ScannedPage;
  @Output() closed = new EventEmitter<void>();

  scanner = inject(ScannerService);

  rotate(delta: 90 | -90): void {
    this.scanner.rotatePage(this.page.id, delta);
    // Reflect locally for preview
    this.page = { ...this.page, rotation: ((this.page.rotation + delta + 360) % 360) as any };
  }
}
