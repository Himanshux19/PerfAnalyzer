import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-reports',
  imports: [NgIf],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  @Input() isVisible = false;
  @Input() report = '';
}
