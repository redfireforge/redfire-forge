import subprocess
import os
import re

projects = ["demo-gql7", "demo-gql8", "demo-gql9", "demo-gql10"]

for p in projects:
    # 1) Cleanup
    cleanup_cmd = 'pkill -f "run_isolated.sh|run_tests.sh|run_all.py|run_subset.py|run_recheck.py" || true; pkill -f "playwright test --project" || true; pkill -f "playwright/lib/common/process.js" || true; pkill -f "chrome-headless-shell" || true; lsof -ti :3001 | xargs kill -9 2>/dev/null || true; lsof -ti :5173 | xargs kill -9 2>/dev/null || true'
    subprocess.run(cleanup_cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 2) Run
    log_path = f"/tmp/direct-{p}.log"
    if os.path.exists(log_path):
        os.remove(log_path)
    
    run_cmd = f'npx playwright test --project="{p}" --workers=1 --reporter=list > {log_path} 2>&1'
    res = subprocess.run(run_cmd, shell=True)
    exit_code = res.returncode
    
    # 3) Print exit code
    print(f"PROJECT={p} EXIT={exit_code}")
    
    # 4 & 5) Classify and extract first failure block
    if exit_code == 0:
        print("STATUS: PASS")
        print("="*60)
        continue
    
    content = ""
    if os.path.exists(log_path):
        with open(log_path, 'r', errors='ignore') as f:
            content = f.read()
            
    # Classify status
    status = "FAIL_ASSERTION"
    if exit_code in [137, 143]:
        status = "INTERRUPTED_137_143"
    elif "No tests found" in content or "Failed to launch" in content or "ECONNREFUSED" in content or "listen EADDRINUSE" in content:
        status = "FAIL_STARTUP"
    elif "Invalid UI state" in content or "unable to start" in content:
        status = "FAIL_STARTUP"
        
    print(f"STATUS: {status}")
    
    lines = content.split('\n')
    heading = None
    error_lines = []
    
    # Attempt to locate the first playwright failure heading
    # Often matches looks like "  1) [demo-gql7] › ..." or "  1) ..."
    # Or "×  ..."
    for line in lines:
        stripped = line.strip()
        if re.search(r'^\d+\)\s', stripped) or (stripped.startswith('×') and len(stripped) > 2):
            heading = stripped
            break
            
    # Look for Error block
    in_error = False
    for line in lines:
        if "Error:" in line or "TypeError:" in line or "AssertionError" in line:
            in_error = True
        if in_error:
            error_lines.append(line)
            # Stop if we hit empty line, or a new fast/fail count, or limit it to 12 lines
            if len(error_lines) > 12 or line.strip() == "":
                break
                
    if heading:
         print(f"First failure heading: {heading}")
    else:
         # Try to find any project name or test path
         for line in lines:
             if "›" in line:
                 print(f"First failure heading (approx): {line.strip()}")
                 break
                 
    if error_lines:
         print("First Error block:")
         print("\n".join(error_lines).strip())
    else:
         # Fallback to printing lines that look like error or just head
         important_lines = [line.strip() for line in lines if "error" in line.lower() or "fail" in line.lower()]
         if important_lines:
             print("First Error block (inferred):")
             print("\n".join(important_lines[:5]))
         else:
             print("Log block snippet:")
             print("\n".join(lines[:12]))
             
    print("="*60)

