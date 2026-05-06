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
        /// Override the base URL for all tests
        #[arg(long)]
        base_url: Option<String>,
        /// Write JSON report to file
        #[arg(short, long)]
        output: Option<String>,
        /// Write JUnit XML report to file
        #[arg(long)]
        junit: Option<String>,
        /// Write Markdown report to file
        #[arg(long)]
        markdown: Option<String>,
        /// Exit code 1 if any request fails
        #[arg(long)]
        fail_on_error: bool,
        /// Exit code 1 if error rate exceeds this %
        #[arg(long)]
        fail_threshold: Option<f32>,
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
        /// Write JSON report to file
        #[arg(short, long)]
        output: Option<String>,
        /// Write JUnit XML report to file
        #[arg(long)]
        junit: Option<String>,
        /// Write Markdown report to file
        #[arg(long)]
        markdown: Option<String>,
        /// Exit code 1 if any request fails
        #[arg(long)]
        fail_on_error: bool,
        /// Exit code 1 if error rate exceeds this %
        #[arg(long)]
        fail_threshold: Option<f32>,
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
            base_url, output, junit, markdown, fail_on_error, fail_threshold, quiet
        } => {
            args.push("run".to_string());
            args.push(file.clone());
            if let Some(c) = concurrency { args.extend(["-c".to_string(), c.to_string()]); }
            if let Some(t) = transactions { args.extend(["-t".to_string(), t.to_string()]); }
            if let Some(m) = mode { args.extend(["-m".to_string(), m.clone()]); }
            if let Some(t) = timeout { args.extend(["--timeout".to_string(), t.to_string()]); }
            if let Some(r) = retries { args.extend(["--retries".to_string(), r.to_string()]); }
            if let Some(r) = retry_delay { args.extend(["--retry-delay".to_string(), r.to_string()]); }
            if let Some(b) = base_url { args.extend(["--base-url".to_string(), b.clone()]); }
            if let Some(o) = output { args.extend(["-o".to_string(), o.clone()]); }
            if let Some(j) = junit { args.extend(["--junit".to_string(), j.clone()]); }
            if let Some(m) = markdown { args.extend(["--markdown".to_string(), m.clone()]); }
            if *fail_on_error { args.push("--fail-on-error".to_string()); }
            if let Some(f) = fail_threshold { args.extend(["--fail-threshold".to_string(), f.to_string()]); }
            if *quiet { args.push("-q".to_string()); }
        },
        Commands::Workflow {
            file, iterations, concurrency, vars, timeout,
            output, junit, markdown, fail_on_error, fail_threshold, quiet
        } => {
            args.push("workflow".to_string());
            args.push(file.clone());
            if let Some(i) = iterations { args.extend(["-i".to_string(), i.to_string()]); }
            if let Some(c) = concurrency { args.extend(["-c".to_string(), c.to_string()]); }
            for v in vars { args.extend(["--var".to_string(), v.clone()]); }
            if let Some(t) = timeout { args.extend(["--timeout".to_string(), t.to_string()]); }
            if let Some(o) = output { args.extend(["-o".to_string(), o.clone()]); }
            if let Some(j) = junit { args.extend(["--junit".to_string(), j.clone()]); }
            if let Some(m) = markdown { args.extend(["--markdown".to_string(), m.clone()]); }
            if *fail_on_error { args.push("--fail-on-error".to_string()); }
            if let Some(f) = fail_threshold { args.extend(["--fail-threshold".to_string(), f.to_string()]); }
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
    let cli = Cli::parse();
    
    if cli.cli {
        // CLI mode: run the Node.js CLI script
        if let Some(command) = cli.command {
            let args = build_cli_args(&command);
            let exit_code = run_cli(&args);
            exit(exit_code);
        } else {
            // No subcommand provided, show help
            eprintln!("RedfireForge CLI Mode");
            eprintln!();
            eprintln!("Usage: redfireforge --cli <COMMAND>");
            eprintln!();
            eprintln!("Commands:");
            eprintln!("  run                Execute a test file");
            eprintln!("  workflow           Execute a workflow file as a performance test");
            eprintln!("  validate           Validate a test file without running it");
            eprintln!("  validate-workflow  Validate a workflow file without running it");
            eprintln!();
            eprintln!("Run 'redfireforge --cli <COMMAND> --help' for more information on a command.");
            exit(0);
        }
    } else {
        // GUI mode: launch the Tauri application
        app_lib::run();
    }
}
