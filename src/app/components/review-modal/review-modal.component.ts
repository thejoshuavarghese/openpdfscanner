import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './review-modal.component.html',
  styleUrls: ['./review-modal.component.scss'],
})
export class ReviewModalComponent {
  @Input() imageDataUrl!: string;
  @Output() accepted = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() discarded = new EventEmitter<void>();
}
