# PerfAnalyzer

PerfAnalyzer is a web-based platform that automates performance testing of websites and web applications using Apache JMeter and Taurus. It provides an intuitive dashboard for configuring tests, executing load scenarios, and analyzing performance metrics through detailed reports and visualizations.

## Features

- Web-based test configuration and execution
- Integration with Apache JMeter and Taurus
- Load, Stress, Spike, and Endurance Testing
- Real-time test monitoring
- Performance metrics and analytics
- Historical test result storage
- Interactive reports and visual dashboards

## Tech Stack

### Frontend
- Angular
- TypeScript
- Angular Material
- Chart.js

### Backend
- FastAPI
- Python

### Performance Testing
- Apache JMeter
- Taurus


## Workflow

```mermaid
flowchart TD
A[User Login] --> B[Angular Dashboard]
B --> C[Configure Performance Test]
C --> D[Submit Test]
D --> E[FastAPI API Layer]
E --> F[Generate Taurus Configuration]
F --> G[Dispatch Test Job]
G --> H[Taurus Engine]
H --> I[Apache JMeter]
I --> J[Execute Load Test]
J --> K[Collect Metrics]
K --> L[Store Results]
L --> M[Analyze Performance Data]
M --> N[Generate Reports & Visualizations]
N --> O[Dashboard Results]
O --> P[Performance Insights]
O --> Q[PDF/HTML Export]
```

## Status

🚧 Project under development.

## Future Enhancements

- Distributed Load Testing
- AI-Powered Performance Insights
- Scheduled Test Execution
- PDF Report Export
- Team Collaboration Features
