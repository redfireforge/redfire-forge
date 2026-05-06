# RedfireForge CLI — CI/CD Integration Guide

Integrate RedfireForge performance tests into your CI/CD pipelines for automated API testing.

## Quick Start

### Option 1: Using npm Package (Recommended)

```bash
# Install globally or use npx
npm install -g redfireforge-cli

# Run tests
redfireforge run tests/api-test.yaml \
  --junit results.xml \
  --fail-on-error \
  -q
```

### Option 2: Using Source Repository

```bash
# Install dependencies
npm install

# Run tests with CI-friendly options
npx tsx cli/index.ts run tests/api-test.yaml \
  --junit results.xml \
  --fail-on-error \
  -q
```

---

## GitHub Actions

### Basic Test Job (Using npm Package)

The simplest approach uses the `redfireforge-cli` npm package:

```yaml
name: API Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run API tests
        run: |
          npx redfireforge-cli run tests/api-test.yaml \
            --concurrency 5 \
            --transactions 100 \
            --junit test-results.xml \
            --fail-on-error \
            -q
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results.xml
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'test-results.xml'
```

### Basic Test Job (Using Source)

If you have the full source repository:

```yaml
name: API Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run API tests
        run: |
          npx tsx cli/index.ts run tests/api-test.yaml \
            --concurrency 5 \
            --transactions 100 \
            --junit test-results.xml \
            --fail-on-error \
            -q
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results.xml
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'test-results.xml'
```

### Multi-Environment Testing

```yaml
name: Multi-Environment API Tests

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  test:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Run tests against ${{ github.event.inputs.environment }}
        run: |
          npx tsx cli/index.ts run tests/api-test.yaml \
            --base-url ${{ vars.API_BASE_URL }} \
            --env ${{ github.event.inputs.environment }} \
            --concurrency 10 \
            --transactions 500 \
            --junit results-${{ github.event.inputs.environment }}.xml \
            --markdown results-${{ github.event.inputs.environment }}.md \
            --fail-threshold 5 \
            -q
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: results-${{ github.event.inputs.environment }}
          path: |
            results-*.xml
            results-*.md
```

### Workflow Performance Tests

```yaml
name: Workflow Performance Tests

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:

jobs:
  workflow-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Run checkout workflow test
        run: |
          npx tsx cli/index.ts workflow workflows/checkout-flow.yaml \
            --iterations 100 \
            --concurrency 10 \
            --var userId=test-user \
            --var productId=12345 \
            --junit workflow-results.xml \
            --markdown workflow-results.md \
            --fail-on-error \
            -q
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: workflow-results
          path: |
            workflow-results.xml
            workflow-results.md
```

### Parallel Test Suites

```yaml
name: Parallel Performance Tests

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        test-suite:
          - users
          - products
          - orders
          - payments
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Run ${{ matrix.test-suite }} tests
        run: |
          npx tsx cli/index.ts run tests/${{ matrix.test-suite }}-test.yaml \
            --concurrency 5 \
            --transactions 200 \
            --junit results-${{ matrix.test-suite }}.xml \
            --fail-on-error \
            -q
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: results-${{ matrix.test-suite }}
          path: results-${{ matrix.test-suite }}.xml
```

---

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml

stages:
  - test
  - report

variables:
  NODE_VERSION: "20"

performance-test:
  stage: test
  image: node:${NODE_VERSION}
  
  before_script:
    - npm ci
  
  script:
    - |
      npx tsx cli/index.ts run tests/api-test.yaml \
        --concurrency 5 \
        --transactions 100 \
        --junit test-results.xml \
        --output test-results.json \
        --fail-on-error \
        -q
  
  artifacts:
    when: always
    paths:
      - test-results.xml
      - test-results.json
    reports:
      junit: test-results.xml
  
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"

workflow-test:
  stage: test
  image: node:${NODE_VERSION}
  
  before_script:
    - npm ci
  
  script:
    - |
      npx tsx cli/index.ts workflow workflows/checkout.yaml \
        --iterations 50 \
        --concurrency 5 \
        --junit workflow-results.xml \
        --fail-on-error \
        -q
  
  artifacts:
    when: always
    paths:
      - workflow-results.xml
    reports:
      junit: workflow-results.xml
  
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### Environment-Specific Testing

```yaml
# .gitlab-ci.yml

.test-template: &test-template
  image: node:20
  before_script:
    - npm ci
  artifacts:
    when: always
    reports:
      junit: "*.xml"

staging-test:
  <<: *test-template
  stage: test
  environment:
    name: staging
  script:
    - |
      npx tsx cli/index.ts run tests/api-test.yaml \
        --base-url ${STAGING_API_URL} \
        --env staging \
        --junit staging-results.xml \
        --fail-on-error \
        -q
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"

production-test:
  <<: *test-template
  stage: test
  environment:
    name: production
  script:
    - |
      npx tsx cli/index.ts run tests/api-test.yaml \
        --base-url ${PRODUCTION_API_URL} \
        --env production \
        --transactions 50 \
        --concurrency 2 \
        --junit production-results.xml \
        --fail-threshold 1 \
        -q
  rules:
    - if: $CI_COMMIT_TAG
```

---

## Jenkins

### Jenkinsfile (Declarative Pipeline)

```groovy
pipeline {
    agent any
    
    tools {
        nodejs 'NodeJS-20'
    }
    
    environment {
        API_BASE_URL = credentials('api-base-url')
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('Validate Tests') {
            steps {
                sh 'npx tsx cli/index.ts validate tests/api-test.yaml'
            }
        }
        
        stage('Run Performance Tests') {
            steps {
                sh '''
                    npx tsx cli/index.ts run tests/api-test.yaml \
                        --base-url ${API_BASE_URL} \
                        --concurrency 10 \
                        --transactions 500 \
                        --junit test-results.xml \
                        --markdown test-results.md \
                        --fail-on-error \
                        -q
                '''
            }
            post {
                always {
                    junit 'test-results.xml'
                    archiveArtifacts artifacts: 'test-results.*', fingerprint: true
                }
            }
        }
        
        stage('Workflow Tests') {
            steps {
                sh '''
                    npx tsx cli/index.ts workflow workflows/checkout.yaml \
                        --iterations 100 \
                        --concurrency 5 \
                        --junit workflow-results.xml \
                        --fail-on-error \
                        -q
                '''
            }
            post {
                always {
                    junit 'workflow-results.xml'
                }
            }
        }
    }
    
    post {
        failure {
            emailext (
                subject: "Performance Test Failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Check console output at ${env.BUILD_URL}",
                recipientProviders: [developers()]
            )
        }
    }
}
```

### Parameterized Build

```groovy
pipeline {
    agent any
    
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], description: 'Target environment')
        string(name: 'CONCURRENCY', defaultValue: '5', description: 'Concurrent requests')
        string(name: 'TRANSACTIONS', defaultValue: '100', description: 'Total transactions')
        booleanParam(name: 'FAIL_ON_ERROR', defaultValue: true, description: 'Fail build on test failure')
    }
    
    stages {
        stage('Test') {
            steps {
                sh """
                    npx tsx cli/index.ts run tests/api-test.yaml \
                        --base-url \${${params.ENVIRONMENT.toUpperCase()}_API_URL} \
                        --env ${params.ENVIRONMENT} \
                        --concurrency ${params.CONCURRENCY} \
                        --transactions ${params.TRANSACTIONS} \
                        --junit results.xml \
                        ${params.FAIL_ON_ERROR ? '--fail-on-error' : ''} \
                        -q
                """
            }
        }
    }
}
```

---

## Azure DevOps

### azure-pipelines.yml

```yaml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'

stages:
  - stage: Test
    displayName: 'Performance Tests'
    jobs:
      - job: APITests
        displayName: 'API Performance Tests'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
            displayName: 'Install Node.js'
          
          - script: npm ci
            displayName: 'Install dependencies'
          
          - script: |
              npx tsx cli/index.ts run tests/api-test.yaml \
                --concurrency 10 \
                --transactions 500 \
                --junit $(Build.ArtifactStagingDirectory)/test-results.xml \
                --output $(Build.ArtifactStagingDirectory)/test-results.json \
                --fail-on-error \
                -q
            displayName: 'Run API tests'
          
          - task: PublishTestResults@2
            condition: always()
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '$(Build.ArtifactStagingDirectory)/test-results.xml'
              testRunTitle: 'API Performance Tests'
          
          - task: PublishBuildArtifacts@1
            condition: always()
            inputs:
              pathtoPublish: '$(Build.ArtifactStagingDirectory)'
              artifactName: 'test-results'
      
      - job: WorkflowTests
        displayName: 'Workflow Performance Tests'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
          
          - script: npm ci
          
          - script: |
              npx tsx cli/index.ts workflow workflows/checkout.yaml \
                --iterations 50 \
                --concurrency 5 \
                --junit $(Build.ArtifactStagingDirectory)/workflow-results.xml \
                --fail-on-error \
                -q
            displayName: 'Run workflow tests'
          
          - task: PublishTestResults@2
            condition: always()
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '$(Build.ArtifactStagingDirectory)/workflow-results.xml'
              testRunTitle: 'Workflow Performance Tests'
```

---

## CircleCI

### .circleci/config.yml

```yaml
version: 2.1

executors:
  node-executor:
    docker:
      - image: cimg/node:20.0

jobs:
  performance-test:
    executor: node-executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-deps-{{ checksum "package-lock.json" }}
      - run:
          name: Install dependencies
          command: npm ci
      - save_cache:
          key: npm-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
      - run:
          name: Run API tests
          command: |
            npx tsx cli/index.ts run tests/api-test.yaml \
              --concurrency 5 \
              --transactions 200 \
              --junit test-results/results.xml \
              --fail-on-error \
              -q
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: test-results

  workflow-test:
    executor: node-executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: Run workflow tests
          command: |
            npx tsx cli/index.ts workflow workflows/checkout.yaml \
              --iterations 50 \
              --concurrency 5 \
              --junit workflow-results/results.xml \
              --fail-on-error \
              -q
      - store_test_results:
          path: workflow-results

workflows:
  version: 2
  test:
    jobs:
      - performance-test
      - workflow-test:
          requires:
            - performance-test
```

---

## Best Practices

### 1. Use Quiet Mode in CI

Always use `-q` (quiet) in CI to reduce log noise:

```bash
npx tsx cli/index.ts run tests/api-test.yaml --fail-on-error -q
```

### 2. Set Appropriate Failure Thresholds

For production monitoring, use `--fail-threshold` instead of `--fail-on-error`:

```bash
# Fail if more than 5% of requests fail
npx tsx cli/index.ts run tests/api-test.yaml --fail-threshold 5 -q
```

### 3. Use JUnit for Test Reporting

Most CI systems support JUnit XML format:

```bash
npx tsx cli/index.ts run tests/api-test.yaml --junit results.xml
```

### 4. Cache Node Modules

Speed up CI by caching `node_modules`:

```yaml
# GitHub Actions
- uses: actions/cache@v4
  with:
    path: node_modules
    key: npm-${{ hashFiles('package-lock.json') }}
```

### 5. Use Environment Variables for Secrets

Never hardcode URLs or credentials:

```yaml
# GitHub Actions
env:
  API_BASE_URL: ${{ secrets.API_BASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}

- run: |
    npx tsx cli/index.ts run tests/api-test.yaml \
      --base-url $API_BASE_URL
```

### 6. Run Smoke Tests on Every PR

Quick smoke tests on PRs, full tests on main:

```yaml
# Smoke test (fast)
- if: github.event_name == 'pull_request'
  run: npx tsx cli/index.ts run tests/api-test.yaml -c 1 -t 10 --tags smoke

# Full test (main only)  
- if: github.ref == 'refs/heads/main'
  run: npx tsx cli/index.ts run tests/api-test.yaml -c 10 -t 500
```

### 7. Archive All Reports

Keep JSON, XML, and Markdown reports for historical analysis:

```bash
npx tsx cli/index.ts run tests/api-test.yaml \
  -o results.json \
  --junit results.xml \
  --markdown results.md
```

---

## Exit Codes Reference

| Code | Meaning | CI Behavior |
|------|---------|-------------|
| `0` | All tests passed | Build succeeds |
| `1` | Test failure | Build fails (with `--fail-on-error` or threshold exceeded) |
| `2` | Error (invalid file, execution error) | Build fails |

---

## See Also

- [CLI Reference](./cli-reference.md) — Full command documentation
- [Workflow Runner Guide](./workflow-runner-guide.md) — Understanding workflow tests
