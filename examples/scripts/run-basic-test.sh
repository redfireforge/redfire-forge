#!/bin/bash
# Run Basic Test Script
# Demonstrates basic CLI usage with common options
#
# Usage: ./examples/scripts/run-basic-test.sh

set -e

echo "=== RedfireForge Basic Test ==="
echo ""

# Run from project root
cd "$(dirname "$0")/../.."
mkdir -p results

# Validate first
echo "Step 1: Validating test file..."
npx tsx cli/index.ts validate examples/cli-basic-test.yaml

echo ""
echo "Step 2: Running test..."
npx tsx cli/index.ts run examples/cli-basic-test.yaml \
  --concurrency 2 \
  --transactions 10 \
  --output results/basic-results.json \
  --junit results/basic-results.xml \
  --markdown results/basic-results.md

echo ""
echo "=== Test Complete ==="
echo "Reports saved to results/ directory"
