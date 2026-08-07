pipeline {
    agent any

    parameters {
        string(name: 'TEST_NAME',        defaultValue: 'Performance_Run', description: 'Unique test execution identifier (used as result folder name)')
        string(name: 'JMX_SCRIPT',       defaultValue: '', description: 'Full absolute path to JMeter .jmx script on this agent')
        string(name: 'THREADS',          defaultValue: '10',  description: 'Number of concurrent virtual users (threads)')
        string(name: 'RAMP_UP',          defaultValue: '10',  description: 'Ramp-up period in seconds')
        string(name: 'DURATION',         defaultValue: '60',  description: 'Test hold duration in seconds')
        string(name: 'PERFANALYZER_URL', defaultValue: ${env.PERFANALYZER_URL}, description: 'PerfAnalyzer Backend Base URL')
        string(name: 'TRIGGERED_BY',     defaultValue: 'Jenkins CI/CD', description: 'User or system that triggered this run')
    }

    environment {
        TEST_ID      = "${params.TEST_NAME}"
        JMETER_JAR   = "${env.JMETER_JAR}"
        RESULTS_DIR  = "target\\results_${BUILD_NUMBER}"
    }

    stages {

        // ── Stage 1: Register test as RUNNING in PerfAnalyzer ─────────────
        stage('1. Register in PerfAnalyzer') {
            steps {
                script {
                    echo "Registering test '${env.TEST_ID}' as RUNNING in PerfAnalyzer..."
                    try {
                        bat """
                            curl -sf -X POST "${params.PERFANALYZER_URL}/api/jenkins/webhook" ^
                              -F "test_name=${env.TEST_ID}" ^
                              -F "status=running" ^
                              -F "username=${params.TRIGGERED_BY}" ^
                              -F "concurrency=${params.THREADS}" ^
                              -F "ramp_up=${params.RAMP_UP}" ^
                              -F "duration=${params.DURATION}" ^
                            || echo Warning: Could not notify PerfAnalyzer
                        """
                    } catch (Exception e) {
                        echo "Warning: Webhook stage failed silently: ${e.message}"
                    }
                }
            }
        }

        // ── Stage 2: Execute JMeter test (LOCKED for sequential queue) ────
        stage('2. Execute JMeter Test') {
            steps {
                lock('perfanalyzer-test-execution') {
                    script {
                        echo "Starting JMeter run: ${params.THREADS} users | ramp-up ${params.RAMP_UP}s | hold ${params.DURATION}s"
                        echo "JMX Script: ${params.JMX_SCRIPT}"

                        bat "if not exist \"${env.RESULTS_DIR}\" mkdir \"${env.RESULTS_DIR}\""

                        bat """
                            java -jar ${env.JMETER_JAR} -n ^
                              -t "${params.JMX_SCRIPT}" ^
                              -l "${env.RESULTS_DIR}\\kpi.jtl" ^
                              -j "${env.RESULTS_DIR}\\jmeter.log" ^
                              -Jthreads=${params.THREADS} ^
                              -Jrampup=${params.RAMP_UP} ^
                              -Jduration=${params.DURATION}
                        """
                    }
                }
            }
        }

        // ── Stage 3: Generate JMeter HTML Dashboard ───────────────────────
        stage('3. Generate HTML Report') {
            steps {
                script {
                    echo "Generating HTML Dashboard from kpi.jtl..."
                    bat """
                        java -jar ${env.JMETER_JAR} -g "${env.RESULTS_DIR}\\kpi.jtl" ^
                          -o "${env.RESULTS_DIR}\\HTML_Report"
                    """
                }
            }
        }

        // ── Stage 4: Upload Artifacts to PerfAnalyzer ─────────────────────
        stage('4. Upload Artifacts to PerfAnalyzer') {
            steps {
                script {
                    echo "Uploading kpi.jtl + jmeter.log to PerfAnalyzer Test Result/${env.TEST_ID}/..."
                    bat """
                        curl -sf -X POST "${params.PERFANALYZER_URL}/api/jenkins/artifacts/${env.TEST_ID}" ^
                          -F "kpi_file=@${env.RESULTS_DIR}\\kpi.jtl" ^
                          -F "log_file=@${env.RESULTS_DIR}\\jmeter.log" ^
                        || echo Warning: Artifact upload to PerfAnalyzer failed
                    """

                    echo "Marking test as SUCCESS in PerfAnalyzer..."
                    bat """
                        curl -sf -X POST "${params.PERFANALYZER_URL}/api/jenkins/webhook" ^
                          -F "test_name=${env.TEST_ID}" ^
                          -F "status=success" ^
                          -F "username=${params.TRIGGERED_BY}" ^
                          -F "concurrency=${params.THREADS}" ^
                          -F "ramp_up=${params.RAMP_UP}" ^
                          -F "duration=${params.DURATION}" ^
                        || echo Warning: Success webhook failed
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Archiving test artifacts in Jenkins..."
            archiveArtifacts artifacts: "target\\results_${BUILD_NUMBER}\\**", allowEmptyArchive: true
        }

        failure {
            script {
                echo "Pipeline failed - notifying PerfAnalyzer with ERROR status..."
                try {
                    bat """
                        curl -sf -X POST "${params.PERFANALYZER_URL}/api/jenkins/webhook" ^
                          -F "test_name=${env.TEST_ID}" ^
                          -F "status=error" ^
                          -F "username=${params.TRIGGERED_BY}" ^
                          -F "error_message=Failed at build #${BUILD_NUMBER}. Check console output." ^
                        || echo Warning: Error webhook failed
                    """
                } catch (Exception e) {
                    echo "Could not send failure webhook: ${e.message}"
                }
            }
        }

        aborted {
            script {
                echo "Pipeline aborted - notifying PerfAnalyzer..."
                try {
                    bat """
                        curl -sf -X POST "${params.PERFANALYZER_URL}/api/jenkins/webhook" ^
                          -F "test_name=${env.TEST_ID}" ^
                          -F "status=error" ^
                          -F "username=${params.TRIGGERED_BY}" ^
                          -F "error_message=Build #${BUILD_NUMBER} was manually aborted." ^
                        || echo Warning: Abort webhook failed
                    """
                } catch (Exception e) {
                    echo "Could not send abort webhook: ${e.message}"
                }
            }
        }
    }
}
