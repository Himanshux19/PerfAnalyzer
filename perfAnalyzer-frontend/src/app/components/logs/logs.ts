import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-logs',
  imports: [NgIf],
  templateUrl: './logs.html',
  styleUrl: './logs.css',
})
export class Logs {
  @Input() isVisible = false;
  @Input() logs = '';
}
