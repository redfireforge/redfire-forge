import subprocess
import os
import re
import sys
import time

projects = ["demo-gql17", "demo-gql18", "demo-gql19", "demo-gql110"]

cleanup_cmd = (
    'pkill -f "run_isolated.sh|run_tests.sh|run_all.py|run_subset.py|run_recheck.py|run_isolated_tests.py" || true; '
    'pkill -f "playwright test --project" || true; '
    'pkill -f "playwright/lib/common/process.js" || true; '
    'pkill -f "chrome-headless-shell" || true; '
    'lsof -ti :3001 | xargs kill -9 2>/dev/null || true; '
    'lsof -ti :5173 | xargs kill -9 2>/dev/null || true'
)

def run_project(p):
    print(f"=== Starting project {p} ===")
    
    # 1) cleanup
    os.system(cleanup_cmd)
    time.sleep(2)  # brief wait for cleanup to take effect
    
    # 2) run
    log_file = f"/tmp/direct-{p}.log"
    run_cmd = f"npx playwright test --project={p} --workers=1 --reporter=list > {log_file} 2>&1"
    
    # subprocess to run and get outcome
    res = subprocess.run(run_cmd, shell=True)
    exit_code = res.returncode
    
    print(f"PROJECT={p} EXIT_CODE={exit_code}")
    
    # 3) read log to classify and extract info
    if not os.path.exists(log_file):
        print(f"Error: Log file {log_file} not found.")
        print(f"CLASSIFICATION: FAIL_STARTUP (No log file)\n")
        return
        
    with open(log_file, "r") as f:
        log_content = f.read()
        
    # classify
    classification = "UNKNOWN"
    if exit_code == 0:
        classification = "PASS"
    elif exit_code in [137, 143]:
        classification = "INTERRUPTED_137_143"
    else:
        # Check standard failed to launch/connect, webserver errors or other startup issues
        # Also check if actual tests were executed but assertion/locator timeout occurred.
        # Startup failures:
        # - "Error: webServer project"
        # - "Failed to launch browser"
        # - "no tests found"
        # - "Error: " followed by something not code/test assertion
        # Assertion failure:
        # - Locator/Page/expect errors
        # Let's inspect log content
        if "Error:" in log_content or "Exception" in log_content or "FAIL" in log_content:
            # Let's see if we see "1) " which indicates test failure details
            # Or "Error: expect(" or similar expectation/assertion/timeout errors.
            if "expect(" in log_content or "Error: locator." in log_content or "Error: page." in log_content or re.search(r'\d+\)\s+\[\w+\]', log_content) or "Error: timed out" in log_content or "Test timeout of" in log_content:
                classification = "FAIL_ASSERTION"
            else:
                classification = "FAIL_STARTUP"
        else:
            classification = "FAIL_STARTUP"
            
    print(f"CLASSIFICATION: {classification}")
    
    # 4) for non-pass, include first failure heading and first Error block
    if classification != "PASS":
        # Find first failure heading
        # A test failure block in Playwright typically looks like:
        #   1) [demo-gql17] › src/features/catalog/ApiCatalog.spec.ts:12:3 › test name
        #   Error: ...
        lines = log_content.splitlines()
        first_heading = None
        error_block_lines = []
        capture_error = False
        
        for line in lines:
            # Try to match heading
            if not first_heading:
                # Matches e.g., "  1) [demo-gql17] ..." or "1) [demo-gql17]" etc
                match = re.search(r'^\s*\d+\)\s+\[', line) or "Error:" in line or "Failed" in line
                if match:
                    first_heading = line.strip()
                    capture_error = True
                    error_block_lines.append(line)
                    continue
            
            if capture_error:
                # collect error block until next test starts or empty/end of traceback block
                # Playwright marks and spaces
                if line.strip() == "" and len(error_block_lines) > 5:
                    # Let's see if we have captured enough
                    capture_error = False
                elif re.search(r'^\s*\d+\)\s+\[', line):
                    # Next failure starts, stop capturing
                    capture_error = False
                else:
                    error_block_lines.append(line)
                    if len(error_block_lines) > 15: # cap size
                        capture_error = False
        
        if first_heading:
            print(f"First Failure Heading: {first_heading}")
            print("First Error Block:")
            print("\n".join(error_block_lines[:15]))
        else:
            # Maybe it didn't match standard playwright format, print first few lines of the log containing words like Error
            print("First Error Block (log tail/head):")
            err_lines = [l for l in lines if "Error" in l or "fail" in l or "FAIL" in l]
            print("\n".join(err_lines[:5]))
            if not err_lines:
                print("\n".join(lines[:10]))
                
    print("\n" + "="*40 + "\n")

for p in projects:
    run_project(p)

