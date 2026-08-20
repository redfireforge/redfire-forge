// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::{Parser, Subcommand};
use std::process::{Command, exit};
use std::env;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "redfireforge")]
#[command(author = "RedfireForge Team")]
#[command(version)]
#[command(about = "RedfireForge — API Performance Testing Tool", long_about = None)]
struct Cli {
    /// Run in CLI mode instead of launching the GUI
    #[arg(long)]
    cli: bool,

    /// CLI subcommand (when --cli is used)
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Execute a test file
    Run {
        /// Path to a .yaml, .yml, or .json test file
        file: String,
        /// Number of concurrent requests
        #[arg(short, long)]
        concurrency: Option<u32>,
        /// Total number of requests
        #[arg(short, long)]
        transactions: Option<u32>,
        /// Execution mode: sequential, batch, pool, load-profile
        #[arg(short, long)]
        mode: Option<String>,
        /// Per-request timeout in seconds
        #[arg(long)]
        timeout: Option<u32>,
        /// Retry count on failure
        #[arg(long)]
        retries: Option<u32>,
        /// Delay between retries in milliseconds
        #[arg(long)]
        retry_delay: Option<u32>,
        /// Duration in seconds (load-profile mode)
        #[arg(long)]
        duration: Option<u32>,
        /// Override the base URL for all tests
        #[arg(long)]
        base_url: Option<String>,
        /// External data file (CSV or JSON) for parameterized testing
        #[arg(long)]
        data: Option<String>,
        /// Run only the test matching this name (used with --data)
        #[arg(long)]
        scenario: Option<String>,
        /// Environment name (metadata only)
        #[arg(long)]
        env: Option<String>,
        /// Error policy: continue, stop-first, stop-threshold
        #[arg(long)]
        error_policy: Option<String>,
        /// Stop after N errors (threshold mode)
        #[arg(long)]
        max_errors: Option<u32>,
        /// Stop at error rate % (threshold mode)
        #[arg(long)]
        max_error_rate: Option<f32>,
        /// Exit code 1 if any request fails
        #[arg(long)]
        fail_on_error: bool,
        /// Exit code 1 if error rate exceeds this %
        #[arg(long)]
        fail_threshold: Option<f32>,
        /// Write JSON report to file
        #[arg(short, long)]
        output: Option<String>,
        /// Write JUnit XML report to file
        #[arg(long)]
        junit: Option<String>,
        /// Write Markdown report to file
        #[arg(long)]
        markdown: Option<String>,
        /// Write data row summary JSON (CI/CD format)
        #[arg(long)]
        data_rows_summary: Option<String>,
        /// Run only data rows with these tags (comma-separated)
        #[arg(long)]
        tags: Option<String>,
        /// Tag matching mode: any (default) or all
        #[arg(long)]
        tag_mode: Option<String>,
        /// Run only scenarios with these tags (comma-separated)
        #[arg(long)]
        scenario_tags: Option<String>,
        /// Scenario tag matching mode: any (default) or all
        #[arg(long)]
        scenario_tag_mode: Option<String>,
        /// JSON file of SLA targets to evaluate after the run (SlaTarget[])
        #[arg(long)]
        sla_config: Option<String>,
        /// Exit code 4 if any SLA violations are detected (requires --sla-config)
        #[arg(long)]
        fail_on_sla: bool,
        /// Compare run against a saved baseline ("latest-baseline" or a specific runId)
        #[arg(long)]
        compare_baseline: Option<String>,
        /// Exit code 2 (regression only) or 3 (also test failures) when regressions are detected
        #[arg(long)]
        fail_on_regression: bool,
        /// Save this run as a new baseline after completion
        #[arg(long)]
        save_baseline: bool,
        /// Human-readable label for the saved baseline
        #[arg(long)]
        baseline_label: Option<String>,
        /// Directory for the baseline store
        #[arg(long)]
        baselines_dir: Option<String>,
        /// Write the Markdown comparison report to a file
        #[arg(long)]
        comparison_report: Option<String>,
        /// Suppress progress output
        #[arg(short, long)]
        quiet: bool,
    },
    /// Execute a workflow file as a performance test
    Workflow {
        /// Path to a workflow .yaml, .yml, or .json file
        file: String,
        /// Total number of workflow iterations
        #[arg(short, long)]
        iterations: Option<u32>,
        /// Number of concurrent iterations
        #[arg(short, long)]
        concurrency: Option<u32>,
        /// Set workflow variables (format: name=value)
        #[arg(long = "var")]
        vars: Vec<String>,
        /// Per-request timeout in seconds
        #[arg(long)]
        timeout: Option<u32>,
        /// Error policy: continue, stop-first, stop-threshold
        #[arg(long)]
        error_policy: Option<String>,
        /// Stop after N errors (threshold mode)
        #[arg(long)]
        max_errors: Option<u32>,
        /// Stop at error rate % (threshold mode)
        #[arg(long)]
        max_error_rate: Option<f32>,
        /// Base URL for HTTP nodes with relative paths
        #[arg(long)]
        base_url: Option<String>,
        /// Trace capture level: minimal, standard, full, debug (default: standard)
        #[arg(long)]
        trace_level: Option<String>,
        /// Write the full execution trace (per-node/per-iteration) as JSON to file
        #[arg(long)]
        trace_output: Option<String>,
        /// Exit code 1 if any request fails
        #[arg(long)]
        fail_on_error: bool,
        /// Exit code 1 if error rate exceeds this %
        #[arg(long)]
        fail_threshold: Option<f32>,
        /// Write JSON report to file
        #[arg(short, long)]
        output: Option<String>,
        /// Write JUnit XML report to file
        #[arg(long)]
        junit: Option<String>,
        /// Write Markdown report to file
        #[arg(long)]
        markdown: Option<String>,
        /// Suppress progress output
        #[arg(short, long)]
        quiet: bool,
    },
    /// Validate a test file without running it
    Validate {
        /// Path to a .yaml, .yml, or .json test file
        file: String,
    },
    /// Validate a workflow file without running it
    ValidateWorkflow {
        /// Path to a workflow .yaml, .yml, or .json file
        file: String,
    },
}

/// Detect whether this binary was invoked via the `rff` symlink/alias rather than
/// `redfireforge` — if so, `main()` defaults straight to CLI mode without requiring
/// `--cli`, mirroring the npm package's `rff` bin alias. Reads argv[0] (the name we
/// were actually invoked as), not `current_exe()`, so it reflects the symlink name
/// rather than the resolved binary path.
fn invoked_as_rff() -> bool {
    std::env::args()
        .next()
        .and_then(|arg0| {
            PathBuf::from(arg0)
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|name| name.eq_ignore_ascii_case("rff"))
        })
        .unwrap_or(false)
}

/// Get the path to the bundled CLI script
fn get_cli_script_path() -> PathBuf {
    // In production, the CLI script is bundled in the Resources directory
    if let Ok(exe_path) = env::current_exe() {
        // macOS: App.app/Contents/MacOS/app -> App.app/Contents/Resources/cli/redfireforge.mjs
        // Windows: app.exe -> cli/redfireforge.mjs (same directory)
        // Linux: app -> cli/redfireforge.mjs (same directory)
        
        #[cfg(target_os = "macos")]
        {
            if let Some(parent) = exe_path.parent() {
                let resources = parent.parent().map(|p| p.join("Resources")).unwrap_or_default();
                let cli_path = resources.join("cli").join("redfireforge.mjs");
                if cli_path.exists() {
                    return cli_path;
                }
            }
        }
        
        #[cfg(not(target_os = "macos"))]
        {
            if let Some(parent) = exe_path.parent() {
                let cli_path = parent.join("cli").join("redfireforge.mjs");
                if cli_path.exists() {
                    return cli_path;
                }
            }
        }
    }
    
    // Fallback: try current directory or rely on npm package
    PathBuf::from("cli/dist/redfireforge.mjs")
}

fn run_cli(args: &[String]) -> i32 {
    let cli_path = get_cli_script_path();
    
    // Try using Node.js directly first
    let result = Command::new("node")
        .arg(&cli_path)
        .args(args)
        .status();
    
    match result {
        Ok(status) => status.code().unwrap_or(1),
        Err(e) => {
            // If node is not found, suggest using the npm package
            eprintln!("Error: Could not execute CLI: {}", e);
            eprintln!();
            eprintln!("The desktop CLI mode requires Node.js to be installed.");
            eprintln!("Alternatively, you can install the standalone npm package:");
            eprintln!();
            eprintln!("  npm install -g redfireforge-cli");
            eprintln!("  redfireforge <command> [options]");
            eprintln!();
            2
        }
    }
}

fn build_cli_args(cmd: &Commands) -> Vec<String> {
    let mut args = Vec::new();
    
    match cmd {
        Commands::Run {
            file, concurrency, transactions, mode, timeout, retries, retry_delay,
            duration, base_url, data, scenario, env, error_policy, max_errors,
            max_error_rate, fail_on_error, fail_threshold, output, junit, markdown,
            data_rows_summary, tags, tag_mode, scenario_tags, scenario_tag_mode,
            sla_config, fail_on_sla, compare_baseline, fail_on_regression,
            save_baseline, baseline_label, baselines_dir, comparison_report, quiet
        } => {
            args.push("run".to_string());
            args.push(file.clone());
            if let Some(c) = concurrency { args.extend(["-c".to_string(), c.to_string()]); }
            if let Some(t) = transactions { args.extend(["-t".to_string(), t.to_string()]); }
            if let Some(m) = mode { args.extend(["-m".to_string(), m.clone()]); }
            if let Some(t) = timeout { args.extend(["--timeout".to_string(), t.to_string()]); }
            if let Some(r) = retries { args.extend(["--retries".to_string(), r.to_string()]); }
            if let Some(r) = retry_delay { args.extend(["--retry-delay".to_string(), r.to_string()]); }
            if let Some(d) = duration { args.extend(["--duration".to_string(), d.to_string()]); }
            if let Some(b) = base_url { args.extend(["--base-url".to_string(), b.clone()]); }
            if let Some(d) = data { args.extend(["--data".to_string(), d.clone()]); }
            if let Some(s) = scenario { args.extend(["--scenario".to_string(), s.clone()]); }
            if let Some(e) = env { args.extend(["--env".to_string(), e.clone()]); }
            if let Some(p) = error_policy { args.extend(["--error-policy".to_string(), p.clone()]); }
            if let Some(n) = max_errors { args.extend(["--max-errors".to_string(), n.to_string()]); }
            if let Some(r) = max_error_rate { args.extend(["--max-error-rate".to_string(), r.to_string()]); }
            if *fail_on_error { args.push("--fail-on-error".to_string()); }
            if let Some(f) = fail_threshold { args.extend(["--fail-threshold".to_string(), f.to_string()]); }
            if let Some(o) = output { args.extend(["-o".to_string(), o.clone()]); }
            if let Some(j) = junit { args.extend(["--junit".to_string(), j.clone()]); }
            if let Some(m) = markdown { args.extend(["--markdown".to_string(), m.clone()]); }
            if let Some(d) = data_rows_summary { args.extend(["--data-rows-summary".to_string(), d.clone()]); }
            if let Some(t) = tags { args.extend(["--tags".to_string(), t.clone()]); }
            if let Some(t) = tag_mode { args.extend(["--tag-mode".to_string(), t.clone()]); }
            if let Some(t) = scenario_tags { args.extend(["--scenario-tags".to_string(), t.clone()]); }
            if let Some(t) = scenario_tag_mode { args.extend(["--scenario-tag-mode".to_string(), t.clone()]); }
            if let Some(s) = sla_config { args.extend(["--sla-config".to_string(), s.clone()]); }
            if *fail_on_sla { args.push("--fail-on-sla".to_string()); }
            if let Some(b) = compare_baseline { args.extend(["--compare-baseline".to_string(), b.clone()]); }
            if *fail_on_regression { args.push("--fail-on-regression".to_string()); }
            if *save_baseline { args.push("--save-baseline".to_string()); }
            if let Some(l) = baseline_label { args.extend(["--baseline-label".to_string(), l.clone()]); }
            if let Some(d) = baselines_dir { args.extend(["--baselines-dir".to_string(), d.clone()]); }
            if let Some(r) = comparison_report { args.extend(["--comparison-report".to_string(), r.clone()]); }
            if *quiet { args.push("-q".to_string()); }
        },
        Commands::Workflow {
            file, iterations, concurrency, vars, timeout, error_policy,
            max_errors, max_error_rate, base_url, trace_level, trace_output,
            fail_on_error, fail_threshold, output, junit, markdown, quiet
        } => {
            args.push("workflow".to_string());
            args.push(file.clone());
            if let Some(i) = iterations { args.extend(["-i".to_string(), i.to_string()]); }
            if let Some(c) = concurrency { args.extend(["-c".to_string(), c.to_string()]); }
            for v in vars { args.extend(["--var".to_string(), v.clone()]); }
            if let Some(t) = timeout { args.extend(["--timeout".to_string(), t.to_string()]); }
            if let Some(p) = error_policy { args.extend(["--error-policy".to_string(), p.clone()]); }
            if let Some(n) = max_errors { args.extend(["--max-errors".to_string(), n.to_string()]); }
            if let Some(r) = max_error_rate { args.extend(["--max-error-rate".to_string(), r.to_string()]); }
            if let Some(b) = base_url { args.extend(["--base-url".to_string(), b.clone()]); }
            if let Some(t) = trace_level { args.extend(["--trace-level".to_string(), t.clone()]); }
            if let Some(t) = trace_output { args.extend(["--trace-output".to_string(), t.clone()]); }
            if *fail_on_error { args.push("--fail-on-error".to_string()); }
            if let Some(f) = fail_threshold { args.extend(["--fail-threshold".to_string(), f.to_string()]); }
            if let Some(o) = output { args.extend(["-o".to_string(), o.clone()]); }
            if let Some(j) = junit { args.extend(["--junit".to_string(), j.clone()]); }
            if let Some(m) = markdown { args.extend(["--markdown".to_string(), m.clone()]); }
            if *quiet { args.push("-q".to_string()); }
        },
        Commands::Validate { file } => {
            args.push("validate".to_string());
            args.push(file.clone());
        },
        Commands::ValidateWorkflow { file } => {
            args.push("validate-workflow".to_string());
            args.push(file.clone());
        },
    }
    
    args
}

fn main() {
    let invoked_as_rff = invoked_as_rff();
    let cli = Cli::parse();

    if cli.cli || invoked_as_rff {
        // CLI mode: run the Node.js CLI script
        if let Some(command) = cli.command {
            let args = build_cli_args(&command);
            let exit_code = run_cli(&args);
            exit(exit_code);
        } else {
            // No subcommand provided, show help
            let invocation = if invoked_as_rff { "rff" } else { "redfireforge --cli" };
            eprintln!("RedfireForge CLI Mode");
            eprintln!();
            eprintln!("Usage: {invocation} <COMMAND>");
            eprintln!();
            eprintln!("Commands:");
            eprintln!("  run                Execute a test file");
            eprintln!("  workflow           Execute a workflow file as a performance test");
            eprintln!("  validate           Validate a test file without running it");
            eprintln!("  validate-workflow  Validate a workflow file without running it");
            eprintln!();
            eprintln!("Run '{invocation} <COMMAND> --help' for more information on a command.");
            exit(0);
        }
    } else {
        // GUI mode: launch the Tauri application
        app_lib::run();
    }
}
