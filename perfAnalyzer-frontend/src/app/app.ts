import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ExecutionControls } from './components/execution-controls/execution-controls';
import { Logs } from './components/logs/logs';
import { Navbar } from './components/navbar/navbar';
import { Reports } from './components/reports/reports';
import { TestConfig } from './components/test-config/test-config';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ExecutionControls, Logs, Navbar, Reports, TestConfig, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('perfAnalyzer-frontend');
}
