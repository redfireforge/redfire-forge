#!/bin/bash
# CI Full Test Script
# Complete test suite for CI/CD - runs all test types with JUnit output
#
# Usage: ./examples/scripts/ci-full-test.sh
#
# Exit codes:
#   0 - All tests passed (error rate under threshold)
#   1 - Tests failed (error rate >= 5%)
#   2 - Error (file not found, invalid test, etc.)

set -e

echo "=== RedfireForge CI Full Test Suite ==="
echo ""

cd "$(dirname "$0")/../.."
mkdir -p results

EXIT_CODE=0

# Test 1: Basic API tests
echo ">>> Running basic API tests..."
if npx tsx cli/index.ts run examples/cli-basic-test.yaml \
  --concurrency 5 \
  --transactions 50 \
  --junit results/ci-basic.xml \
  --fail-threshold 5 \
  -q; then
  echo "✅ Basic tests passed"
else
  echo "❌ Basic tests failed"
  EXIT_CODE=1
fi

echo ""

# Test 2: Assertions tests  
echo ">>> Running assertion tests..."
if npx tsx cli/index.ts run examples/cli-assertions.yaml \
  --concurrency 3 \
  --transactions 30 \
  --junit results/ci-assertions.xml \
  --fail-threshold 5 \
  -q; then
  echo "✅ Assertion tests passed"
else
  echo "❌ Assertion tests failed"
  EXIT_CODE=1
fi

echo ""

# Test 3: Parameterized tests (smoke tag only)
echo ">>> Running parameterized tests (smoke tag)..."
if npx tsx cli/index.ts run examples/cli-parameterized.yaml \
  --tags smoke \
  --concurrency 2 \
  --transactions 10 \
  --junit results/ci-parameterized.xml \
  --fail-threshold 5 \
  -q; then
  echo "✅ Parameterized tests passed"
else
  echo "❌ Parameterized tests failed"
  EXIT_CODE=1
fi

echo ""

# Test 4: Workflow tests
echo ">>> Running workflow tests..."
if npx tsx cli/index.ts workflow examples/workflow-cli-parallel.yaml \
  --iterations 10 \
  --concurrency 2 \
  --junit results/ci-workflow.xml \
  --fail-threshold 5 \
  -q; then
  echo "✅ Workflow tests passed"
else
  echo "❌ Workflow tests failed"
  EXIT_CODE=1
fi

echo ""
echo "=== CI Test Suite Complete ==="

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed"
else
  echo "❌ Some tests failed - see JUnit reports in results/"
fi

exit $EXIT_CODE
