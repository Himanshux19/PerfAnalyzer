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

  getRpsPath(): string {
    const history = this.api.rpsHistory();
    if (history.length < 2) return 'M 20,90 L 230,90';
    const maxVal = Math.max(...history, 10);
    return history.map((val, i) => {
      const x = 20 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }

  getRtPath(): string {
    const history = this.api.rtHistory();
    if (history.length < 2) return 'M 20,90 L 230,90';
    const maxVal = Math.max(...history, 100);
    return history.map((val, i) => {
      const x = 20 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }

  getErrorPath(): string {
    const history = this.api.errorHistory();
    if (history.length < 2) return 'M 20,90 L 230,90';
    const maxVal = Math.max(...history, 1);
    return history.map((val, i) => {
      const x = 20 + i * (210 / (history.length - 1));
      const y = 90 - (val / maxVal) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  }
}
