import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    this.createTestForm = this.fb.group({
      testName: ['', Validators.required],
      url: ['', Validators.required],
      method: ['GET', Validators.required],
      threads: [1, Validators.required],
      rampUp: [0, Validators.required],
      duration: [60, Validators.required],
      loopCount: [-1],
      body: [null],
    });
  }

  generate() {
    if (this.createTestForm.invalid) {
      return;
    }
    const payload: any = {
      ...this.createTestForm.value,
    };
    if (payload.body && payload.body.trim() !== '') {
      try {
        payload.body = JSON.parse(payload.body);
      } catch {
        alert('Request Body contains invalid JSON');

        return;
      }
    } else {
      payload.body = null;
    }
    console.log(payload);
    this.http.post('http://localhost:8000/create-test', payload).subscribe({
      next: (res) => console.log(res),
      error: (err) => console.log(err),
    });
  }

  showBody(): boolean {
    const method = this.createTestForm.get('method')?.value;
    return method === 'POST' || method === 'PUT' || method === 'PATCH';
  }
}
