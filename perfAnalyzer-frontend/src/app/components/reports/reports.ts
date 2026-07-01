import { Component } from '@angular/core';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-reports',
  imports: [],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  constructor(protected api: ApiService) {}

  getRpsMax(): number {
    const history = this.api.rpsHistory();
    return Math.max(...history, 10);
  }

  getRpsMiddle(): number {
    return Math.round((this.getRpsMax() / 2) * 10) / 10;
  }

  getRtMax(): number {
    const history = this.api.rtHistory();
    return Math.max(...history, 100);
  }

  getRtMiddle(): number {
    return Math.round(this.getRtMax() / 2);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getLeftTimeLabel(): string {
    const elapsed = this.api.elapsedSeconds();
    const start = Math.max(0, elapsed - 20);
    return this.formatTime(start);
  }

  getMiddle1TimeLabel(): string {
    const elapsed = this.api.elapsedSeconds();
    const start = Math.max(0, elapsed - 20);
    const end = Math.max(20, elapsed);
    const t = Math.round(start + (end - start) * (70 / 210));
    return this.formatTime(t);
  }

  getMiddle2TimeLabel(): string {
    const elapsed = this.api.elapsedSeconds();
    const start = Math.max(0, elapsed - 20);
    const end = Math.max(20, elapsed);
    const t = Math.round(start + (end - start) * (140 / 210));
    return this.formatTime(t);
  }

  getRightTimeLabel(): string {
    const elapsed = this.api.elapsedSeconds();
    const end = Math.max(20, elapsed);
    return this.formatTime(end);
  }

  getRpsPath(): string {
    const history = this.api.rpsHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = this.getRpsMax();
    return history.map((val, i) => {
      const x = 35 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }

  getRtPath(): string {
    const history = this.api.rtHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = this.getRtMax();
    return history.map((val, i) => {
      const x = 35 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }

  getErrorPath(): string {
    const history = this.api.errorHistory();
    if (history.length < 2) return 'M 35,90 L 245,90';
    const maxVal = Math.max(...history, 1);
    return history.map((val, i) => {
      const x = 35 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }
}
