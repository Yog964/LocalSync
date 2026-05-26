# LocalSync

## Project Name

LocalSync - Offline local-network file sharing and shared clipboard.
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/3f7ae4ca-e02c-4055-827e-35c7018d38bd" />

## Problem Statement

Moving files between a laptop, desktop, and phone is often slower than it should be. Cloud drives need internet access, USB cables are inconvenient, messaging apps compress or limit files, and ad-hoc transfer tools can be confusing for non-technical users. LocalSync solves this by turning one computer on the same WiFi/LAN into a simple local sharing hub.

## What Is This Project?

LocalSync is a React and Node.js web app for sharing files and text snippets between devices connected to the same local network. The host machine runs an Express server, serves the React dashboard, stores uploaded files locally, and exposes a QR code URL that phones or other computers can scan to connect.

## Why Does It Exist?

LocalSync exists to make private, offline, same-network transfer simple:

- No internet connection is required after setup.
- Files stay on the host machine instead of passing through third-party cloud storage.
- Mobile devices can connect quickly by scanning a QR code.
- Temporary, one-time, and PIN-protected transfers reduce clutter and accidental sharing.

## Key Features

- Local WiFi/LAN file sharing through a browser.
- QR code based device connection.
- Pairing PIN for guest device access.
- Multi-file upload with progress display.
- Shared clipboard for moving text between devices.
- File listing with search, type filters, sorting, preview, download, and delete actions.
- File categories for documents, images, videos, audio, archives, code, executables, and other files.
- Optional upload modes: permanent, auto-delete after 1 hour, auto-delete after 24 hours, or one-time download.
- Optional per-file PIN protection.
- Activity log for uploads, downloads, deletes, clipboard updates, and cleanup actions.
- Automatic cleanup for expired files and storage above 5 GB.
- Windows helper scripts for one-click startup and optional custom protocol registration.

## Screenshots
| Dashboard | Mobile Connect |
| --- | --- |
| ![Dashboard](https://github.com/user-attachments/assets/234b4004-3a6a-498e-8243-d2629828bd11) | ![Mobile Connect](https://github.com/user-attachments/assets/61c30245-5075-4855-b725-3f105ce41900) |

## Tech Stack

- Frontend: React 18, Vite, CSS
- Backend: Node.js, Express
- Upload handling: Multer
- QR generation: qrcode
- Runtime utilities: Node `fs`, `path`, `os`
- Process manager support: PM2
- Container support: Docker

## Project Structure

```text
LocalSync/
|-- client/                         # React frontend
|   |-- src/
|   |   |-- App.jsx                 # Main dashboard and workflow UI
|   |   |-- index.css               # Application styles
|   |   `-- main.jsx                # React entry point
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- server/
|   |-- index.js                    # Express API, uploads, pairing, cleanup, static serving
|   |-- package.json
|   `-- package-lock.json
|-- uploads/                        # Runtime upload storage, ignored by git
|-- Dockerfile                      # Production container build
|-- ecosystem.config.js             # PM2 configuration
|-- Register_LocalSync_Protocol.reg # Optional Windows protocol registration
|-- Start_LocalSync.bat             # Windows startup helper
|-- package.json                    # Root scripts
`-- README.md
```

## How To Run

### Prerequisites

- Node.js 18 or newer.
- npm.
- Devices connected to the same WiFi/LAN network.
- Windows firewall/private network access enabled for Node.js if connecting from another device.
- Docker Desktop, only if running with Docker.

### 1. Clone The Repository

```bash
git clone https://github.com/Yog964/LocalSync.git
cd LocalSync
```

### 2. Run The Backend

Install dependencies and start the Express server:

```bash
npm run install:server
npm run dev:server
```

The backend runs on:

```text
http://localhost:3000
http://<your-local-ip>:3000
```

### 3. Run The Frontend

For frontend development, open a second terminal:

```bash
npm run install:client
npm run dev:client
```

Vite runs the React app in development mode. For the normal all-in-one production flow, build the frontend and let the backend serve it:

```bash
npm run setup
npm start
```

### 4. Run With Docker

Build and run the container:

```bash
docker build -t localsync .
docker run --rm -p 3000:3000 -v localsync_uploads:/app/uploads localsync
```

Then open:

```text
http://localhost:3000
```

Use the network URL shown by the server when connecting another device on the same WiFi/LAN.

## Main Workflow

1. Start LocalSync on the host computer.
2. Open `http://localhost:3000` on the host.
3. Scan the QR code from another device on the same network.
4. Enter the pairing PIN shown on the host screen.
5. Upload files or send clipboard text from any paired device.
6. Preview, download, delete, or search shared files from the dashboard.
7. Use temporary, one-time, or PIN-protected transfer settings when needed.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/server-info` | Returns host IP, port, access URL, hostname, and QR code data URL. |
| `GET` | `/api/pairing-status` | Returns the current guest pairing request for the host. |
| `POST` | `/api/verify-pin` | Verifies a guest device pairing PIN. |
| `GET` | `/api/devices?name=<device>` | Updates and returns active device information. |
| `GET` | `/api/logs` | Returns recent activity logs. |
| `GET` | `/api/clipboard` | Returns the shared clipboard text. |
| `POST` | `/api/clipboard` | Updates or clears the shared clipboard text. |
| `POST` | `/api/upload` | Uploads one or more files with optional mode and PIN metadata. |
| `GET` | `/api/files` | Lists uploaded files with metadata and total storage size. |
| `GET` | `/api/download/:filename` | Downloads a file and burns it if it is a one-time transfer. |
| `GET` | `/api/preview/:filename` | Streams a file inline for browser preview. |
| `DELETE` | `/api/files/:filename` | Deletes an uploaded file. |

## Useful Scripts

| Script | Description |
| --- | --- |
| `npm run install:server` | Installs backend dependencies. |
| `npm run install:client` | Installs frontend dependencies. |
| `npm run install:all` | Installs backend and frontend dependencies. |
| `npm run dev:server` | Starts the Express backend directly. |
| `npm run dev:client` | Starts the Vite frontend dev server. |
| `npm run build:client` | Builds the React frontend into `client/dist`. |
| `npm run setup` | Installs dependencies and builds the frontend. |
| `npm start` | Starts the production backend server. |
| `npm run pm2:start` | Starts LocalSync with PM2. |
| `npm run pm2:stop` | Stops the PM2 process. |
| `npm run pm2:restart` | Restarts the PM2 process. |

## Testing

Automated tests are not currently configured. Recommended manual checks:

- Start the app with `npm run setup` and `npm start`.
- Open `http://localhost:3000` on the host.
- Connect a second device using the QR code and pairing PIN.
- Upload multiple files and confirm they appear in the file table.
- Preview and download supported file types.
- Test PIN-protected, one-time, 1-hour, and 24-hour transfer modes.
- Update, copy, and clear the shared clipboard.
- Delete a file and confirm the activity log updates.

## Notes

- `uploads/` is runtime storage and is intentionally ignored by git.
- `client/dist/` is generated by `npm run build:client` and is intentionally ignored by git.
- `node_modules/` is intentionally ignored by git.
- Guest devices must be on the same network as the host.
- If a phone cannot open the QR URL, check firewall rules and ensure the host network profile is private/trusted.
- The server defaults to port `3000`; set `PORT` to override it.
- `Register_LocalSync_Protocol.reg` is optional and intended for Windows users who want `localsync://start` links.

## License

MIT
