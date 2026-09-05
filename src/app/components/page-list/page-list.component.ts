import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScannedPage } from '../../models/page.model';

@Component({
  selector: 'app-page-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-list.component.html',
  styleUrls: ['./page-list.component.scss'],
})
export class PageListComponent {
  @Input() pages: ScannedPage[] = [];
  @Output() editPage = new EventEmitter<ScannedPage>();
  @Output() removePage = new EventEmitter<number>();
  @Output() rotatePage = new EventEmitter<{ id: number; delta: 90 | -90 }>();
  @Output() reorder = new EventEmitter<ScannedPage[]>();

  draggedIndex: number | null = null;

  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  onDrop(targetIndex: number): void {
    if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;
    const reordered = [...this.pages];
    const [moved] = reordered.splice(this.draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    this.reorder.emit(reordered);
    this.draggedIndex = null;
  }

  onDragEnd(): void {
    this.draggedIndex = null;
  }

  trackById(_: number, page: ScannedPage): number {
    return page.id;
  }
}
