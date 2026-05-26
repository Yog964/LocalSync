# ⚡ LocalSync

LocalSync is a fast, secure, and completely offline peer-to-peer file-sharing system designed to operate over a local WiFi network. It features a clean, highly structured "Government-style" UI that prioritizes clarity, accessibility, and function.

With LocalSync, you can effortlessly share files between your desktop, laptop, and mobile devices without requiring any internet connection, USB cables, or third-party cloud services.

## ✨ Key Features

*   **🚫 100% Offline:** Transfers happen over your local router (WiFi/LAN). No internet required. No file size limits dictated by cloud providers.
*   **📱 Cross-Device Compatibility:** Fully responsive UI that works flawlessly on Desktop browsers, tablets, and smartphones.
*   **🏛️ Clean UI:** A strictly functional, structured interface designed for extreme usability, featuring tabular data and large touch targets for mobile.
*   **🔗 QR Code Connect:** Automatically generates a QR code on the desktop server. Scan it with your phone's camera to instantly open the app on your mobile device.
*   **👀 Real-time Device Tracking:** Detects device types (e.g., iPhone, MacBook, Windows PC) and shows exactly who is connected to the network in real-time.
*   **📋 Activity Log:** Keeps a running history of who uploaded, downloaded, or deleted files.
*   **📂 Smart File Management:** Sort by Date, Size, or Name. Filter by document type (Images, PDFs, Videos). Includes direct inline file previews.
*   **📦 Auto Cleanup & Smart Storage:** Configure files to auto-delete after 1 hour, 24 hours, or implement a strict 5GB maximum storage limit to prevent server bloat.
*   **🔥 One-Time Transfers (Skip Disk Bloat):** Send "Burn After Reading" files. The file is permanently destroyed the exact moment the receiver downloads it.
*   **🔐 Secure PIN Transfers:** Optional secure mode allowing you to lock specific uploads with a 4-digit PIN for private transfers over the network.

## 🛠️ Technology Stack

*   **Frontend:** React 18, Vite, pure Vanilla CSS (No bulky component libraries)
*   **Backend:** Node.js, Express.js
*   **File Handling:** Multer (Optimized for large file chunking)
*   **Utilities:** `qrcode` (for generating connection links), `os` native modules (for IP detection)

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher recommended)
*   Both devices (e.g., PC and Phone) **MUST** be connected to the exact same WiFi network.

### 1. Installation

Clone the repository and install the dependencies for both the frontend and backend:

```bash
# Install root, server, and client dependencies all at once
npm install
```

### 2. Running the App

**For Windows Users (Easiest Method):**
Simply double-click the included `Start_LocalSync.bat` file. 
This script will automatically start the Node.js server and launch the application in your default web browser.

**Manual Start:**
If you prefer using the terminal, run:
```bash
npm start
```
This will start the backend server on `http://0.0.0.0:3000` and automatically serve the built React frontend.

### 3. Connecting a Mobile Device
1. Look at the right sidebar (or bottom on mobile) of the LocalSync dashboard on your PC.
2. Point your phone's camera at the **QR Code**.
3. Tap the link that appears to instantly open LocalSync on your phone!

## 🔗 Custom URL Protocol (Optional)

LocalSync includes a custom Windows registry protocol that allows other applications or websites to launch the LocalSync server via a standard web link (e.g., `<a href="localsync://start">Launch App</a>`).

To enable this:
1. Double-click the `Register_LocalSync_Protocol.reg` file included in the root directory.
2. Accept the Windows prompt to add the keys to your registry.

## 📁 Directory Structure

```text
LocalSync/
├── client/              # React frontend (Vite)
│   ├── src/             # React components and CSS
│   └── dist/            # Compiled production frontend
├── server/              # Node.js Express backend
│   └── index.js         # Core API logic, device tracking, IP detection
├── uploads/             # Automatically created. Where all shared files are stored
├── Start_LocalSync.bat  # 1-click start script for Windows
└── package.json         # Root package manager
```

## ⚠️ Troubleshooting

*   **"Address already in use" Error:** If the server crashes and the port gets stuck, you can kill the process using: `npx kill-port 3000`.
*   **QR Code Link won't open on Phone:** Ensure your PC's network profile is set to **Private** (not Public), or ensure your Windows Firewall allows Node.js to communicate over port `3000` on private networks.
