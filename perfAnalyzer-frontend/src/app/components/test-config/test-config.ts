import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-test-config',
  templateUrl: './test-config.html',
  styleUrls: ['./test-config.css'],
  imports: [FormsModule]
})
export class TestConfig {

  users = 0;
  rampUp = 0;
  duration = 0;

  jmxFile: File | null = null;
  csvFile: File | null = null;

  onJmxSelected(event: any) {
    this.jmxFile = event.target.files[0];
  }

  onCsvSelected(event: any) {
    this.csvFile = event.target.files[0];
  }

}