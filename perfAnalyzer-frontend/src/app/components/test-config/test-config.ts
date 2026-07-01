import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-test-config',
  templateUrl: './test-config.html',
  styleUrls: ['./test-config.css'],
  imports: [FormsModule]
})
export class TestConfig {
  constructor(protected api: ApiService) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    
    if (filename.endsWith('.jmx')) {
      // Clear CSV file states
      this.api.csvFileName.set(null);
      this.api.csvServerName.set(null);
      this.api.csvUploadStatus.set('idle');

      // Upload JMX
      this.api.jmxFileName.set(file.name);
      this.api.jmxFileSize.set(`${(file.size / 1024).toFixed(0)} KB`);
      this.api.jmxUploadStatus.set('uploading');
      this.api.addLog(`Uploading JMX script: ${file.name}...`, 'system');

      this.api.uploadJmxFile(file).subscribe({
        next: (res) => {
          this.api.jmxServerName.set(res.filename); // sequential name like Test1.jmx
          this.api.jmxUploadStatus.set('success');
          this.api.addLog(`JMX uploaded successfully. Saved as ${res.filename} on server.`, 'success');
        },
        error: (err) => {
          this.api.jmxUploadStatus.set('error');
          const errorMsg = err.error?.detail || err.message || 'Connection error';
          this.api.addLog(`JMX upload failed: ${errorMsg}`, 'error');
        }
      });

    } else if (filename.endsWith('.csv')) {
      // Clear JMX file states
      this.api.jmxFileName.set(null);
      this.api.jmxServerName.set(null);
      this.api.jmxUploadStatus.set('idle');

      // Upload CSV
      this.api.csvFileName.set(file.name);
      this.api.csvFileSize.set(`${(file.size / 1024).toFixed(0)} KB`);
      this.api.csvUploadStatus.set('uploading');
      this.api.addLog(`Uploading CSV data file: ${file.name}...`, 'system');

      this.api.uploadCsvFile(file).subscribe({
        next: (res) => {
          this.api.csvServerName.set(res.filename); // sequential name like Result1.csv
          this.api.csvUploadStatus.set('success');
          this.api.addLog(`CSV uploaded successfully. Saved as ${res.filename} on server.`, 'success');
        },
        error: (err) => {
          this.api.csvUploadStatus.set('error');
          const errorMsg = err.error?.detail || err.message || 'Connection error';
          this.api.addLog(`CSV upload failed: ${errorMsg}`, 'error');
        }
      });
    } else {
      this.api.addLog('Error: Only .jmx and .csv files are supported.', 'error');
    }
  }
}