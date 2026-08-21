@echo off
rem RedfireForge short CLI alias — same binary as redfireforge.exe, always in
rem CLI mode (no --cli flag needed). Installed alongside redfireforge.exe so it
rem picks up the same PATH entry.
"%~dp0redfireforge.exe" --cli %*
