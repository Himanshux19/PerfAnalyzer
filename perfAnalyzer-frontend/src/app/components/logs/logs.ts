import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-logs',
  imports: [],
  templateUrl: './logs.html',
  styleUrl: './logs.css',
})
export class Logs implements AfterViewChecked {
  @ViewChild('terminalBox') private terminalBox!: ElementRef;

  constructor(protected api: ApiService) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.terminalBox) {
        const element = this.terminalBox.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error auto-scrolling terminal logs:', err);
    }
  }
}
