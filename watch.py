#!/usr/bin/env python3
"""
Auto-compile script that watches the game/ directory for changes
and automatically runs compile.sh when files are modified.
"""

import os
import sys
import time
import subprocess
from pathlib import Path

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RED = '\033[91m'
ENDC = '\033[0m'
BOLD = '\033[1m'

def print_colored(message, color=ENDC):
    """Print colored message."""
    print(f"{color}{message}{ENDC}")

def get_file_mtimes(directory):
    """Get modification times for all files in directory recursively."""
    mtimes = {}
    for root, dirs, files in os.walk(directory):
        # Skip .vscode and other hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            filepath = os.path.join(root, file)
            try:
                mtimes[filepath] = os.path.getmtime(filepath)
            except OSError:
                pass
    return mtimes

def run_compile():
    """Run the compile.sh script."""
    script_dir = Path(__file__).parent
    compile_script = script_dir / "compile.sh"
    
    if not compile_script.exists():
        print_colored(f"Error: {compile_script} not found!", RED)
        return False
    
    print_colored(f"\n{BOLD}🔄 Changes detected! Compiling...{ENDC}", BLUE)
    print_colored(f"{'=' * 50}", BLUE)
    
    try:
        result = subprocess.run(
            ["bash", str(compile_script)],
            cwd=str(script_dir),
            check=False,
            capture_output=False
        )
        
        if result.returncode == 0:
            print_colored(f"\n{BOLD}✅ Compilation successful!{ENDC}\n", GREEN)
            return True
        else:
            print_colored(f"\n{BOLD}❌ Compilation failed!{ENDC}\n", RED)
            return False
    except Exception as e:
        print_colored(f"Error running compile script: {e}", RED)
        return False

def watch_directory(directory, interval=1.0):
    """Watch directory for changes and compile when files are modified."""
    directory = Path(directory).resolve()
    
    if not directory.exists():
        print_colored(f"Error: Directory {directory} does not exist!", RED)
        sys.exit(1)
    
    print_colored(f"{BOLD}👀 Watching: {directory}{ENDC}", GREEN)
    print_colored(f"{BOLD}📝 Press Ctrl+C to stop{ENDC}\n", YELLOW)
    
    # Initial compile
    print_colored("Running initial compilation...", BLUE)
    run_compile()
    
    # Get initial file modification times
    previous_mtimes = get_file_mtimes(directory)
    
    try:
        while True:
            time.sleep(interval)
            
            # Get current file modification times
            current_mtimes = get_file_mtimes(directory)
            
            # Check for changes
            changed = False
            for filepath, mtime in current_mtimes.items():
                if filepath not in previous_mtimes or previous_mtimes[filepath] != mtime:
                    changed = True
                    break
            
            # Check for deleted files
            for filepath in previous_mtimes:
                if filepath not in current_mtimes:
                    changed = True
                    break
            
            if changed:
                previous_mtimes = current_mtimes
                run_compile()
                
    except KeyboardInterrupt:
        print_colored(f"\n{BOLD}👋 Stopping file watcher...{ENDC}", YELLOW)
        sys.exit(0)

def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    game_dir = script_dir / "game"
    
    # Check if game directory exists
    if not game_dir.exists():
        print_colored(f"Error: {game_dir} directory not found!", RED)
        sys.exit(1)
    
    # Start watching
    watch_directory(game_dir)

if __name__ == "__main__":
    main()

