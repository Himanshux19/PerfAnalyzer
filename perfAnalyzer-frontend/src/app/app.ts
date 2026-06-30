import { Component, OnDestroy } from '@angular/core';
import { Logs } from './components/logs/logs';
import { Navbar } from './components/navbar/navbar';
import { Reports } from './components/reports/reports';
import { TestConfig } from './components/test-config/test-config';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';

@Component({
  selector: 'app-root',
  imports: [Logs, Navbar, Reports, TestConfig, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  title = 'PerfAnalyzer';
  private pollingInterval: any = null;

  constructor(protected api: ApiService) {}

  onRunTest() {
    const jmxServer = this.api.jmxServerName();
    const jmxLocal = this.api.jmxFileName();

    if (!jmxServer) {
      this.api.addLog('Error: Please select and upload a JMX script first.', 'error');
      return;
    }

    const threads = this.api.users() || 0;
    const rampUp = this.api.rampUp() || 0;
    const duration = this.api.duration() || 0;

    if (threads <= 0 || duration < 0) {
      this.api.addLog('Error: Thread count must be greater than 0, and duration must be 0 or greater.', 'error');
      return;
    }

    // Reset charts history and terminal console logs
    this.api.rpsHistory.set([]);
    this.api.rtHistory.set([]);
    this.api.errorHistory.set([]);
    this.api.runnerRps.set('0 RPS');
    this.api.runnerPeakRps.set('peak 0');
    this.api.runnerAvgRt.set('0 ms');
    this.api.runnerErrorRate.set('0.0%');
    this.api.clearLogs();

    this.api.testStatus.set('running');
    this.api.addLog(`Initializing test execution: ${jmxLocal} (Server: ${jmxServer})`, 'system');
    this.api.addLog(`Parameters: Threads: ${threads} | Ramp-up: ${rampUp}s | Duration: ${duration}s`, 'system');
    this.api.addLog('Firing Taurus execution on backend...', 'system');

    // Cancel existing poll just in case
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.api.runTest(jmxServer, threads, rampUp, duration).subscribe({
      next: (res) => {
        this.api.addLog(`Test background process initialized: ${res.test_name}`, 'system');
        
        // Start polling logs and metrics every 1 second
        this.pollingInterval = setInterval(() => {
          this.pollStatus(res.test_name);
        }, 1000);
      },
      error: (err) => {
        this.api.testStatus.set('error');
        const errorMsg = err.error?.detail || err.message || 'Connection error';
        this.api.addLog(`Error starting test: ${errorMsg}`, 'error');
      }
    });
  }

  pollStatus(testName: string) {
    this.api.getTestStatus(testName).subscribe({
      next: (res) => {
        // 1. Process JMeter logs
        if (res.jmeter_log) {
          const lines = res.jmeter_log.split('\n').filter(l => l.trim() !== '');
          const formattedLines = lines.map(line => {
            const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([A-Z]+)\s+([a-zA-Z0-9\.\$\_]+:)?\s*(.*)$/);
            if (match) {
              return {
                date: match[1],
                time: match[2],
                level: match[3],
                category: match[4] || '',
                message: match[5],
                raw: null
              };
            } else {
              return {
                date: null,
                time: null,
                level: null,
                category: null,
                message: null,
                raw: line
              };
            }
          });
          this.api.terminalLogs.set(formattedLines);
        }

        // 2. Parse JTL stats if available, else fall back to parsing bzt.log
        if (res.throughput !== undefined && res.throughput > 0) {
          const tput = res.throughput || 0;
          const avgRtVal = res.avg_rt !== undefined ? res.avg_rt : 0;
          const errVal = res.error_rate !== undefined ? res.error_rate : 0;

          this.api.users.set(res.active_users || 0);
          this.api.runnerRps.set(`${tput} RPS`);
          this.api.runnerAvgRt.set(`${avgRtVal} ms`);
          this.api.runnerErrorRate.set(`${errVal.toFixed(2)}%`);
          
          // update peak
          const currentPeak = parseFloat(this.api.runnerPeakRps().split(' ')[1]) || 0;
          if (tput > currentPeak) {
            this.api.runnerPeakRps.set("peak " + tput);
          }
          
          // update history
          const rpsHistory = this.api.rpsHistory();
          if (rpsHistory.length === 0 || rpsHistory[rpsHistory.length - 1] !== tput) {
            this.api.rpsHistory.set([...rpsHistory, tput].slice(-20));
          }
          
          const rtHistory = this.api.rtHistory();
          if (rtHistory.length === 0 || rtHistory[rtHistory.length - 1] !== avgRtVal) {
            this.api.rtHistory.set([...rtHistory, avgRtVal].slice(-20));
          }
          
          const errHistory = this.api.errorHistory();
          if (errHistory.length === 0 || errHistory[errHistory.length - 1] !== errVal) {
            this.api.errorHistory.set([...errHistory, errVal].slice(-20));
          }
        } else {
          this.parseBztLog(res.bzt_log);
        }

        // 3. Handle completion status
        if (res.status === 'success' || res.status === 'error') {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
          this.api.testStatus.set(res.status);
          
          if (res.status === 'success') {
            this.api.addLog('Success: Test execution completed successfully!', 'success');
          } else {
            this.api.addLog(`Error: Test execution failed on server. ${res.error || ''}`, 'error');
          }
        }
      },
      error: (err) => {
        console.error('Error polling test status:', err);
      }
    });
  }

  parseBztLog(bztLog: string) {
    if (!bztLog) return;
    const lines = bztLog.split('\n');
    
    let parsedUsers: number | null = null;
    let parsedRps: number | null = null;
    let parsedRt: number | null = null;
    let parsedErrors: number | null = null;

    // Scan from bottom to top for recent statistics line or final-stats table row
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      // Check if we hit a table data row:
      // Example: | HTTP Request |   OK   | 100.00% |  1.174 |       |
      const matchTable = line.match(/\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([\d\.]+)%\s*\|\s*([\d\.]+)\s*\|/);
      if (matchTable && matchTable[1].trim() !== 'label' && matchTable[1].trim() !== 'Total') {
        const succRate = parseFloat(matchTable[3]);
        parsedErrors = 100 - succRate;
        parsedRt = Math.round(parseFloat(matchTable[4]) * 1000); // convert seconds to ms
        break;
      }
      
      // Pattern 1 (Taurus console display statistics):
      // Example: VU: 15   RPS: 24.3   avg: 124ms   errors: 0%
      const matchTaurus = line.match(/VU:\s*(\d+)\s+RPS:\s*([\d\.]+)\s+avg:\s*(\d+)ms\s+errors:\s*([\d\.]+)%/i);
      if (matchTaurus) {
        parsedUsers = parseInt(matchTaurus[1], 10);
        parsedRps = parseFloat(matchTaurus[2]);
        parsedRt = parseInt(matchTaurus[3], 10);
        parsedErrors = parseFloat(matchTaurus[4]);
        break;
      }

      // Pattern 2 (Standard stats report log line):
      // Example: Active Users: 15, throughput: 23.4 RPS, average response time: 0.124s, error rate: 0.1%
      const matchUsers = line.match(/Active Users:\s*(\d+)/i);
      const matchRps = line.match(/(?:throughput|RPS):\s*([\d\.]+)/i);
      const matchRt = line.match(/(?:average response time|avg):\s*([\d\.]+)(s|ms)?/i);
      const matchErrors = line.match(/(?:error rate|errors):\s*([\d\.]+)%/i);

      if (matchUsers && parsedUsers === null) parsedUsers = parseInt(matchUsers[1], 10);
      if (matchRps && parsedRps === null) parsedRps = parseFloat(matchRps[1]);
      if (matchRt && parsedRt === null) {
        const val = parseFloat(matchRt[1]);
        const unit = matchRt[2] || 'ms';
        parsedRt = unit.toLowerCase() === 's' ? Math.round(val * 1000) : Math.round(val);
      }
      if (matchErrors && parsedErrors === null) parsedErrors = parseFloat(matchErrors[1]);
      
      if (parsedUsers !== null && parsedRps !== null && parsedRt !== null && parsedErrors !== null) {
        break;
      }
    }

    // Also look for throughput (RPS) if we parsed final stats table but missed RPS
    if (parsedRps === null) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const matchRpsOnly = line.match(/(?:throughput|RPS):\s*([\d\.]+)/i);
        if (matchRpsOnly) {
          parsedRps = parseFloat(matchRpsOnly[1]);
          break;
        }
        const matchTaurus = line.match(/RPS:\s*([\d\.]+)/i);
        if (matchTaurus) {
          parsedRps = parseFloat(matchTaurus[1]);
          break;
        }
      }
    }

    if (parsedUsers !== null) this.api.users.set(parsedUsers);
    if (parsedRps !== null) {
      this.api.runnerRps.set(`${parsedRps} RPS`);
      
      const currentPeak = parseFloat(this.api.runnerPeakRps().split(' ')[1]) || 0;
      if (parsedRps > currentPeak) {
        this.api.runnerPeakRps.set(`peak ${parsedRps}`);
      }
      
      const history = [...this.api.rpsHistory(), parsedRps].slice(-20);
      this.api.rpsHistory.set(history);
    }
    if (parsedRt !== null) {
      this.api.runnerAvgRt.set(`${parsedRt} ms`);
      
      const history = [...this.api.rtHistory(), parsedRt].slice(-20);
      this.api.rtHistory.set(history);
    }
    if (parsedErrors !== null) {
      this.api.runnerErrorRate.set(`${parsedErrors.toFixed(2)}%`);
      
      const history = [...this.api.errorHistory(), parsedErrors].slice(-20);
      this.api.errorHistory.set(history);
    }
  }

  onGenerateReport() {
    const csvServer = this.api.csvServerName();
    const csvLocal = this.api.csvFileName();

    if (!csvServer) {
      this.api.addLog('Error: Please upload a CSV dataset file first.', 'error');
      return;
    }

    this.api.addLog(`Initializing HTML report generation from: ${csvLocal} (Server: ${csvServer})`, 'system');
    this.api.addLog('Running JMeter report generation process on backend...', 'system');

    this.api.generateHtml(csvServer).subscribe({
      next: (res) => {
        this.api.addLog('Success: JMeter Dashboard HTML Report generated successfully!', 'success');
        this.api.addLog(`Output Folder: ${res.report_folder}`, 'success');
      },
      error: (err) => {
        const errorMsg = err.error?.detail || err.message || 'Connection error';
        this.api.addLog(`Error generating report: ${errorMsg}`, 'error');
      }
    });
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}
