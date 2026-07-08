import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../api.service';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-create-test',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Navbar],
  templateUrl: './create-test.html',
  styleUrl: './create-test.css',
})
export class CreateTest {
  createTestForm: FormGroup;
  methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  isGenerating = false;
  generationSuccess = false;
  generationError: string | null = null;
  formSubmitted = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.createTestForm = this.fb.group({
      testName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_\-]+$/)]],
      url: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?([a-zA-Z0-9\.\-_]+)(:\d+)?(\/.*)?$/)]],
      method: ['GET', Validators.required],
      threads: [10, [Validators.required, Validators.min(1)]],
      rampUp: [5, [Validators.required, Validators.min(0)]],
      duration: [60, [Validators.required, Validators.min(1)]],
      loopCount: [-1, Validators.required],
      body: [''],
    });
  }

  generate() {
    this.formSubmitted = true;
    if (this.createTestForm.invalid) {
      return;
    }

    const payload: any = {
      ...this.createTestForm.value,
    };

    if (this.showBody() && payload.body && payload.body.trim() !== '') {
      try {
        JSON.parse(payload.body);
      } catch {
        this.generationError = 'Request Body contains invalid JSON. Please correct it.';
        this.cdr.detectChanges();
        return;
      }
    } else {
      payload.body = null;
    }

    this.isGenerating = true;
    this.generationSuccess = false;
    this.generationError = null;
    this.cdr.detectChanges();

    this.zone.run(() => {
      this.api.createTest(payload).subscribe({
        next: (res: any) => {
          this.zone.run(() => {
            this.isGenerating = false;
            this.generationSuccess = true;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.isGenerating = false;
            let errMsg = 'Failed to generate JMX file.';
            if (err?.error?.detail) {
              errMsg = typeof err.error.detail === 'string' 
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

  showBody(): boolean {
    const method = this.createTestForm.get('method')?.value;
    return method === 'POST' || method === 'PUT' || method === 'PATCH';
  }

  clearError() {
    this.generationError = null;
    this.cdr.detectChanges();
  }

  resetForm() {
    this.createTestForm.patchValue({
      testName: '',
      url: '',
      method: 'GET',
      threads: 10,
      rampUp: 5,
      duration: 60,
      loopCount: -1,
      body: ''
    });
    this.formSubmitted = false;
    this.generationSuccess = false;
    this.generationError = null;
    this.cdr.detectChanges();
  }
}
