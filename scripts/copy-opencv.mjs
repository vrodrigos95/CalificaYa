// Copia opencv.js a public/ para servirlo como archivo estático (lo usa el Web Worker).
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/opencv', { recursive: true });
copyFileSync('node_modules/@techstark/opencv-js/dist/opencv.js', 'public/opencv/opencv.js');
