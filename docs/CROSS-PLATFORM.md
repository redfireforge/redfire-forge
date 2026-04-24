# Cross-Platform Compatibility Guide

**RedfireForge Performance Workbench** is fully compatible with **Windows**, **macOS**, and **Linux**.

---

## ✅ Platform Support

| Platform | Support Status | Tested Versions |
|----------|---------------|-----------------|
| **macOS** | ✅ Fully Supported | macOS 11+ (Intel & Apple Silicon) |
| **Windows** | ✅ Fully Supported | Windows 10/11 |
| **Linux** | ✅ Fully Supported | Ubuntu 20.04+, Debian, Fedora |

---

## 📁 Application Data Paths

The webhook server and Tauri app store data in platform-specific directories:

### **macOS**
```
~/Library/Application Support/redfireforge/
├── workflows/
├── triggers/
├── executions/
└── webhook-deliveries/
```

### **Windows**
```
%APPDATA%\redfireforge\
├── workflows\
├── triggers\
├── executions\
└── webhook-deliveries\
```

Typical location: `C:\Users\YourName\AppData\Roaming\redfireforge\`

### **Linux**
```
~/.local/share/redfireforge/
├── workflows/
├── triggers/
├── executions/
└── webhook-deliveries/
```

---

## 🚀 Installation

### **Prerequisites (All Platforms)**

1. **Node.js** 18+ ([nodejs.org](https://nodejs.org))
2. **npm** (comes with Node.js)

### **Install Dependencies**

```bash
# All platforms
npm install
```

---

## 🖥️ Running the Application

### **Development Mode**

```bash
# Terminal 1: Start webhook server (all platforms)
npm run server

# Terminal 2: Start UI dev server (all platforms)
npm run dev
```

### **Tauri Desktop App**

```bash
# Development mode (all platforms)
npm run tauri:dev

# Build for your platform
npm run tauri:build
```

---

## 🔧 Building for Production

### **macOS**

```bash
npm run tauri:build
```

**Output:**
- `.dmg` installer: `src-tauri/target/release/bundle/dmg/`
- `.app` bundle: `src-tauri/target/release/bundle/macos/`

**Code Signing:** Requires Apple Developer certificate for distribution

---

### **Windows**

```bash
npm run tauri:build
```

**Output:**
- `.msi` installer: `src-tauri/target/release/bundle/msi/`
- `.exe` portable: `src-tauri/target/release/`

**Code Signing:** Use `signtool.exe` with certificate for distribution

---

### **Linux**

```bash
npm run tauri:build
```

**Output:**
- `.deb` package: `src-tauri/target/release/bundle/deb/`
- `.AppImage`: `src-tauri/target/release/bundle/appimage/`
- Binary: `src-tauri/target/release/`

**Installation:**
```bash
# Debian/Ubuntu
sudo dpkg -i target/release/bundle/deb/redfireforge_*.deb

# AppImage
chmod +x target/release/bundle/appimage/redfireforge_*.AppImage
./target/release/bundle/appimage/redfireforge_*.AppImage
```

---

## 📝 Platform-Specific Notes

### **macOS**

**Security & Permissions:**
- First launch: Right-click → Open (bypass Gatekeeper)
- Network access: May prompt for firewall permissions
- File access: Automatic (sandboxed App Support directory)

**Apple Silicon (M1/M2/M3):**
- Native ARM64 builds supported
- Universal binary builds available
- Intel binaries run via Rosetta 2

**Terminal Access:**
```bash
# View logs
tail -f ~/Library/Logs/redfireforge.log

# Clear app data
rm -rf ~/Library/Application\ Support/redfireforge/
```

---

### **Windows**

**Security & Permissions:**
- Windows Defender may prompt on first run
- Add exception if needed: Settings → Virus & threat protection
- Server port 3001 may require firewall rule

**PowerShell Commands:**
```powershell
# View logs
Get-Content "$env:APPDATA\redfireforge\server.log" -Wait

# Clear app data
Remove-Item "$env:APPDATA\redfireforge" -Recurse -Force

# Allow firewall (admin required)
New-NetFirewallRule -DisplayName "RedfireForge Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

**WSL Users:**
- Webhook server accessible from WSL at `http://localhost:3001`
- Use `host.docker.internal:3001` from Docker containers

---

### **Linux**

**System Requirements:**
- GTK3 or GTK4
- WebKit2GTK (webkitgtk-4.0 or webkitgtk-6.0)
- OpenSSL

**Install Dependencies:**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  libayatana-appindicator \
  librsvg
```

**Terminal Access:**
```bash
# View logs
tail -f ~/.local/share/redfireforge/server.log

# Clear app data
rm -rf ~/.local/share/redfireforge/

# Check if server is running
lsof -i :3001
```

---

## 🌐 Webhook Server Access

### **Localhost (Default)**

All platforms:
```
http://localhost:3001
http://127.0.0.1:3001
```

### **Network Access (Optional)**

**macOS/Linux:**
```bash
# Get local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Start server on all interfaces
HOST=0.0.0.0 npm run server
```

**Windows:**
```powershell
# Get local IP
ipconfig | findstr "IPv4"

# Start server on all interfaces
$env:HOST="0.0.0.0"; npm run server
```

Then access from other devices:
```
http://192.168.1.100:3001
```

### **Internet Exposure (Testing Only)**

All platforms can use:

**ngrok:**
```bash
# Install
brew install ngrok  # macOS
choco install ngrok  # Windows
# or download from ngrok.com

# Tunnel localhost:3001
ngrok http 3001

# Output: https://abc123.ngrok.io
```

**Tailscale:**
```bash
# Install and setup
# macOS: brew install tailscale
# Windows: Download from tailscale.com
# Linux: See tailscale.com/download

# Share port
tailscale serve http://localhost:3001
```

---

## 🧪 Testing Webhooks

### **cURL (All Platforms)**

```bash
# macOS/Linux
curl -X POST http://localhost:3001/webhooks/workflow-123/trigger-456 \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "message": "Hello"}'

# Windows PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/webhooks/workflow-123/trigger-456" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"userId": "1", "message": "Hello"}'
```

### **Insomnia / Postman**

All platforms support these GUI tools:
- **Insomnia**: [insomnia.rest](https://insomnia.rest)
- **Postman**: [postman.com](https://postman.com)

Configure:
- URL: `http://localhost:3001/webhooks/{workflowId}/{triggerId}`
- Method: POST/PUT/PATCH
- Headers: `Content-Type: application/json`
- Body: JSON payload

---

## 🔍 Troubleshooting

### **Server Won't Start**

**All Platforms:**
```bash
# Check if port is in use
# macOS/Linux:
lsof -i :3001

# Windows:
netstat -ano | findstr :3001

# Kill process
# macOS/Linux:
kill -9 <PID>

# Windows:
taskkill /PID <PID> /F
```

### **Can't Access Data Directory**

**macOS:**
```bash
# Open in Finder
open ~/Library/Application\ Support/redfireforge/
```

**Windows:**
```powershell
# Open in Explorer
explorer "$env:APPDATA\redfireforge"
```

**Linux:**
```bash
# Open in file manager
xdg-open ~/.local/share/redfireforge/
# or
nautilus ~/.local/share/redfireforge/
```

### **Permission Errors**

**macOS/Linux:**
```bash
# Fix permissions
chmod -R 755 ~/Library/Application\ Support/redfireforge/  # macOS
chmod -R 755 ~/.local/share/redfireforge/  # Linux
```

**Windows:**
```powershell
# Run PowerShell as Administrator if needed
```

### **Build Errors**

**macOS:**
- Install Xcode Command Line Tools: `xcode-select --install`
- Accept Xcode license: `sudo xcodebuild -license accept`

**Windows:**
- Install Visual Studio Build Tools
- Install Windows SDK

**Linux:**
- Install development packages (see Linux section above)
- Update GTK: `sudo apt upgrade libwebkit2gtk-4.1-dev`

---

## 📦 Distribution

### **Code Signing**

**macOS:**
```bash
# Sign with Apple Developer certificate
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" \
  src-tauri/target/release/bundle/macos/RedfireForge.app

# Notarize for Gatekeeper
xcrun notarytool submit src-tauri/target/release/bundle/dmg/RedfireForge_*.dmg \
  --apple-id your@email.com \
  --team-id TEAMID \
  --password app-specific-password
```

**Windows:**
```powershell
# Sign with certificate
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com \
  src-tauri\target\release\bundle\msi\RedfireForge_*.msi
```

**Linux:**
- GPG signing recommended for repositories
- AppImage supports built-in signing

---

## 🌍 Environment Variables

Cross-platform environment configuration:

**macOS/Linux (bash/zsh):**
```bash
export PORT=3002
export HOST=0.0.0.0
npm run server
```

**Windows (PowerShell):**
```powershell
$env:PORT=3002
$env:HOST="0.0.0.0"
npm run server
```

**Windows (CMD):**
```cmd
set PORT=3002
set HOST=0.0.0.0
npm run server
```

**All Platforms (.env file):**
```bash
# Create .env file
PORT=3002
HOST=0.0.0.0
```

---

## 🚢 CI/CD for Multi-Platform Builds

### **GitHub Actions Example**

```yaml
name: Build Multi-Platform

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, windows-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm install
      
      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.1-dev build-essential
      
      - name: Build Tauri app
        run: npm run tauri:build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: app-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

---

## 📊 Platform Compatibility Matrix

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Tauri Desktop App | ✅ | ✅ | ✅ |
| Webhook Server | ✅ | ✅ | ✅ |
| Cron Scheduler | ✅ | ✅ | ✅ |
| File Storage | ✅ | ✅ | ✅ |
| UI (Vite/React) | ✅ | ✅ | ✅ |
| CLI Tool | ✅ | ✅ | ✅ |
| Auto-updates | ✅ | ✅ | ✅ |
| System Tray | ✅ | ✅ | ✅ |
| Keyboard Shortcuts | ✅ | ✅ | ✅ |

---

## 🔗 Resources

- **Tauri Documentation**: [tauri.app](https://tauri.app)
- **Node.js Downloads**: [nodejs.org](https://nodejs.org)
- **Platform-Specific Issues**: [GitHub Issues](https://github.com/yourusername/redfireforge/issues)

---

## ✅ Testing Checklist

Before releasing, test on all platforms:

- [ ] **macOS**
  - [ ] App launches successfully
  - [ ] Webhook server starts on port 3001
  - [ ] Workflows save to `~/Library/Application Support/redfireforge/`
  - [ ] Webhooks receive requests correctly
  - [ ] Schedules execute at correct times
  - [ ] DMG installer works

- [ ] **Windows**
  - [ ] App launches successfully
  - [ ] Webhook server starts on port 3001
  - [ ] Workflows save to `%APPDATA%\redfireforge\`
  - [ ] Webhooks receive requests correctly
  - [ ] Schedules execute at correct times
  - [ ] MSI installer works

- [ ] **Linux**
  - [ ] App launches successfully
  - [ ] Webhook server starts on port 3001
  - [ ] Workflows save to `~/.local/share/redfireforge/`
  - [ ] Webhooks receive requests correctly
  - [ ] Schedules execute at correct times
  - [ ] DEB/AppImage packages work

---

## 🎉 Summary

RedfireForge is designed to be truly cross-platform:

- ✅ **Same codebase** for all platforms
- ✅ **Same features** on all platforms
- ✅ **Same data format** (JSON files)
- ✅ **Same webhook API** (localhost:3001)
- ✅ **Same user experience**

Users can seamlessly switch between platforms without compatibility issues!
