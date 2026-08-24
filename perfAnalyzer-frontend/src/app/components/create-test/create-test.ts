import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'app-create-test',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-test.html',
  styleUrl: './create-test.css',
})
export class CreateTest {
  createTestForm: FormGroup;

  isGenerating = false;
  generationSuccess = false;
  generationError: string | null = null;
  formSubmitted = false;
  discoveryMode: string | null = null;
  endpointsCount = 0;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.createTestForm = this.fb.group({
      testName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_\-]+$/)]],
      url: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(https?:\/\/)?([a-zA-Z0-9\.\-_]+)(:\d+)?(\/.*)?$/),
        ],
      ],
      threads: [10, [Validators.required, Validators.min(1)]],
      rampUp: [5, [Validators.required, Validators.min(0)]],
      duration: [60, [Validators.required, Validators.min(1)]],
      loopCount: [-1, Validators.required],
    });
  }

  generate() {
    this.formSubmitted = true;
    if (this.createTestForm.invalid) {
      return;
    }

    const formVal = this.createTestForm.value;

    // Ensure URL has a scheme (default to https:// if missing)
    let targetUrl = formVal.url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    const payload: any = {
      testName: formVal.testName,
      baseUrl: targetUrl,
      threads: formVal.threads,
      rampUp: formVal.rampUp,
      duration: formVal.duration,
      loopCount: formVal.loopCount,
      discovery: 'openapi',
    };

    this.isGenerating = true;
    this.generationSuccess = false;
    this.generationError = null;
    this.discoveryMode = null;
    this.endpointsCount = 0;
    this.cdr.detectChanges();

    this.zone.run(() => {
      this.api.createTest(payload).subscribe({
        next: (res: any) => {
          this.zone.run(() => {
            this.isGenerating = false;
            this.generationSuccess = true;
            this.discoveryMode = res.discoveryMode || 'single';
            this.endpointsCount = res.endpointsCount || 1;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.isGenerating = false;
            let errMsg = 'Failed to generate JMX file.';
            if (err?.error?.detail) {
              errMsg =
                typeof err.error.detail === 'string'
                  ? err.error.detail
                  : JSON.stringify(err.error.detail);
            } else if (err?.message) {
              errMsg = err.message;
            }
            this.generationError = errMsg;
            this.cdr.detectChanges();
          });
        },
      });
    });
  }

  clearError() {
    this.generationError = null;
    this.cdr.detectChanges();
  }

  resetForm() {
    this.createTestForm.patchValue({
      testName: '',
      url: '',
      threads: 10,
      rampUp: 5,
      duration: 60,
      loopCount: -1,
    });
    this.formSubmitted = false;
    this.generationSuccess = false;
    this.generationError = null;
    this.discoveryMode = null;
    this.endpointsCount = 0;
    this.cdr.detectChanges();
  }
}
