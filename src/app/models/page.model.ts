export interface ScannedPage {
  id: number;
  dataUrl: string;
  rotation: number; // 0 | 90 | 180 | 270
  name: string;
}

export interface Corner {
  x: number;
  y: number;
}

export type CropCorners = [Corner, Corner, Corner, Corner]; // TL, TR, BR, BL
