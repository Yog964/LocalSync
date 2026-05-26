const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Metadata Management (For Security & Cleanup) ─────────────
const metadataPath = path.join(uploadsDir, 'metadata.json');
let fileMetadata = {};

function loadMetadata() {
  if (fs.existsSync(metadataPath)) {
    try {
      fileMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (e) {
      fileMetadata = {};
    }
  }
}

function saveMetadata() {
  fs.writeFileSync(metadataPath, JSON.stringify(fileMetadata, null, 2));
}

loadMetadata();

// Active devices tracking
const activeDevices = new Map();
const activityLogs = [];

function addLog(action, file, deviceName = 'Unknown Device') {
  activityLogs.unshift({ action, file, deviceName, time: new Date().toISOString() });
  if (activityLogs.length > 50) activityLogs.pop();
}

// ── Authentication & Pairing ──────────────────────────────────────
const authSessions = new Set();
let currentPairingRequest = null;

function isHost(req) {
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  return ip.includes('127.0.0.1') || ip.includes('::1') || ip === 'localhost';
}

function checkAuth(req, res, next) {
  if (isHost(req)) return next();
  
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const cleanIp = ip ? ip.replace(/^.*:/, '') : 'unknown';
  
  if (authSessions.has(cleanIp)) return next();

  // Allow the PIN verification endpoint
  if (req.path === '/api/verify-pin') return next();

  // If requesting an API, block it
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized. Please pair device first.' });
  }

  // Otherwise, it's a browser requesting the app. Generate PIN & serve Auth Page.
  if (!currentPairingRequest || currentPairingRequest.ip !== cleanIp || (Date.now() - currentPairingRequest.time > 60000)) {
    currentPairingRequest = {
      ip: cleanIp,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      time: Date.now()
    };
  }

  return res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Device Pairing</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f6f8; color: #1f3a5f; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
          input { font-size: 2rem; letter-spacing: 5px; width: 150px; text-align: center; padding: 10px; margin: 20px 0; border: 2px solid #1f3a5f; border-radius: 4px; }
          button { background: #1f3a5f; color: white; border: none; padding: 10px 20px; font-size: 1.2rem; border-radius: 4px; cursor: pointer; width: 100%; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Connection Request Sent</h2>
          <p>Look at your PC screen. Enter the 4-digit PIN displayed there.</p>
          <form onsubmit="submitPin(event)">
            <input type="number" id="pin" max="9999" autocomplete="off" required>
            <br>
            <button type="submit">Connect to LocalSync</button>
          </form>
          <p id="error" style="color: #d32f2f; font-weight: bold;"></p>
        </div>
        <script>
          async function submitPin(e) {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            const res = await fetch('/api/verify-pin', {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({pin})
            });
            const data = await res.json();
            if(data.success) window.location.reload();
            else document.getElementById('error').innerText = 'Invalid PIN. Try again.';
          }
        </script>
      </body>
    </html>
  `);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(checkAuth);

// Multer configuration with original name preservation
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    // Preserve original name but add timestamp to avoid collisions
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${name}__${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2000 * 1024 * 1024 }, // 2GB limit
});

// ── Helper Functions ──────────────────────────────────────────────

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function getFileCategory(ext) {
  const map = {
    '.pdf': 'document',
    '.doc': 'document', '.docx': 'document',
    '.txt': 'document', '.rtf': 'document',
    '.xls': 'spreadsheet', '.xlsx': 'spreadsheet', '.csv': 'spreadsheet',
    '.ppt': 'presentation', '.pptx': 'presentation',
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
    '.gif': 'image', '.webp': 'image', '.svg': 'image', '.bmp': 'image',
    '.mp4': 'video', '.avi': 'video', '.mkv': 'video',
    '.mov': 'video', '.wmv': 'video', '.webm': 'video',
    '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio',
    '.aac': 'audio', '.ogg': 'audio',
    '.zip': 'archive', '.rar': 'archive', '.7z': 'archive',
    '.tar': 'archive', '.gz': 'archive',
    '.js': 'code', '.py': 'code', '.java': 'code',
    '.cpp': 'code', '.html': 'code', '.css': 'code',
    '.exe': 'executable', '.msi': 'executable', '.apk': 'executable',
  };
  return map[ext] || 'other';
}

function getMimeType(ext) {
  const mimes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.txt': 'text/plain', '.html': 'text/html',
    '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.csv': 'text/csv',
    '.zip': 'application/zip',
  };
  return mimes[ext] || 'application/octet-stream';
}

function getDisplayName(filename) {
  return filename.replace(/__\d+-\d+/, '');
}

function formatFileInfo(filename) {
  const filePath = path.join(uploadsDir, filename);
  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  
  const meta = fileMetadata[filename] || {};

  return {
    name: filename,
    displayName: getDisplayName(filename),
    size: stats.size,
    category: getFileCategory(ext),
    mimeType: getMimeType(ext),
    ext: ext,
    uploadedAt: stats.mtime.toISOString(),
    isLocked: !!meta.pin,
    isOneTime: meta.isOneTime || false,
    expiry: meta.expiry || null
  };
}

// ── Smart Cleanup Routine ─────────────────────────────────────────

// Runs every minute to delete expired files
setInterval(() => {
  const files = fs.readdirSync(uploadsDir);
  const now = Date.now();
  let changed = false;

  for (const file of files) {
    if (file === 'metadata.json' || file.startsWith('.')) continue;
    
    const meta = fileMetadata[file];
    if (meta && meta.expiry && now > meta.expiry) {
      try {
        fs.unlinkSync(path.join(uploadsDir, file));
        delete fileMetadata[file];
        addLog('Auto-Deleted', getDisplayName(file), 'System');
        changed = true;
      } catch(e) {}
    }
  }

  // Enforce Max Storage (e.g., 5GB limit)
  let totalSize = 0;
  const fileStats = [];
  for (const file of fs.readdirSync(uploadsDir)) {
    if (file === 'metadata.json' || file.startsWith('.')) continue;
    try {
      const stats = fs.statSync(path.join(uploadsDir, file));
      totalSize += stats.size;
      fileStats.push({ file, time: stats.mtimeMs, size: stats.size });
    } catch(e) {}
  }

  const MAX_STORAGE = 5 * 1024 * 1024 * 1024; // 5 GB
  if (totalSize > MAX_STORAGE) {
    // Sort oldest first
    fileStats.sort((a, b) => a.time - b.time);
    while (totalSize > MAX_STORAGE && fileStats.length > 0) {
      const oldest = fileStats.shift();
      try {
        fs.unlinkSync(path.join(uploadsDir, oldest.file));
        delete fileMetadata[oldest.file];
        totalSize -= oldest.size;
        addLog('Storage Cleanup', getDisplayName(oldest.file), 'System');
        changed = true;
      } catch(e) {}
    }
  }

  if (changed) saveMetadata();
}, 60000);

// ── API Routes ────────────────────────────────────────────────────

// Pairing Status Endpoint (Only Host calls this)
app.get('/api/pairing-status', (req, res) => {
  if (!isHost(req)) return res.json({ request: null });
  if (currentPairingRequest && (Date.now() - currentPairingRequest.time < 60000)) {
    res.json({ request: currentPairingRequest });
  } else {
    res.json({ request: null });
  }
});

// Verify PIN Endpoint (Guest calls this)
app.post('/api/verify-pin', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const cleanIp = ip ? ip.replace(/^.*:/, '') : 'unknown';
  
  if (currentPairingRequest && currentPairingRequest.ip === cleanIp && currentPairingRequest.pin === req.body.pin) {
    authSessions.add(cleanIp);
    currentPairingRequest = null;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

// Server info + QR code
app.get('/api/server-info', async (req, res) => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;
  try {
    const qrCode = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    res.json({ ip, port: PORT, url, qrCode, hostname: os.hostname() });
  } catch (err) {
    res.json({ ip, port: PORT, url, qrCode: null, hostname: os.hostname() });
  }
});

// Get active devices count and update own status
app.get('/api/devices', (req, res) => {
  const deviceName = req.query.name || 'Unknown Device';
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const cleanIp = ip ? ip.replace(/^.*:/, '') : 'unknown';
  
  activeDevices.set(cleanIp, { time: Date.now(), name: deviceName });

  const now = Date.now();
  let count = 0;
  const names = [];
  for (const [key, data] of activeDevices.entries()) {
    if (now - data.time < 15000) { // Active in last 15 seconds
      count++;
      if (data.name !== 'Unknown Device' && !names.includes(data.name)) {
        names.push(data.name);
      }
    } else {
      activeDevices.delete(key);
    }
  }
  res.json({ count: Math.max(1, count), names });
});

// Get Activity Logs
app.get('/api/logs', (req, res) => {
  res.json(activityLogs);
});

// Shared Clipboard
let sharedClipboard = { text: '', updatedBy: 'System', time: Date.now() };

app.get('/api/clipboard', (req, res) => {
  res.json(sharedClipboard);
});

app.post('/api/clipboard', (req, res) => {
  const deviceName = req.body.deviceName || 'Unknown Device';
  if (req.body.text !== undefined) {
    sharedClipboard = {
      text: req.body.text,
      updatedBy: deviceName,
      time: Date.now()
    };
    if (req.body.text) {
      addLog('Updated Clipboard', 'Text Snippet', deviceName);
    }
  }
  res.json({ success: true, clipboard: sharedClipboard });
});

// Upload files (multiple)
app.post('/api/upload', upload.array('files', 50), (req, res) => {
  const deviceName = req.body.deviceName || 'Unknown Device';
  const mode = req.body.mode || 'permanent'; // 'permanent', '1h', '24h', 'onetime'
  const pin = req.body.pin || null;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const files = req.files.map((f) => {
    const dispName = getDisplayName(f.filename);
    addLog('Uploaded', dispName, deviceName);

    // Apply metadata rules
    const meta = {};
    if (pin) meta.pin = pin;
    if (mode === '1h') meta.expiry = Date.now() + (60 * 60 * 1000);
    if (mode === '24h') meta.expiry = Date.now() + (24 * 60 * 60 * 1000);
    if (mode === 'onetime') meta.isOneTime = true;

    if (Object.keys(meta).length > 0) {
      fileMetadata[f.filename] = meta;
    }

    return {
      name: f.filename,
      displayName: dispName,
      originalName: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
      uploadedAt: new Date().toISOString(),
    };
  });
  
  saveMetadata();
  res.json({ success: true, files, count: files.length });
});

// List all files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir)
      .filter((f) => !f.startsWith('.') && f !== 'metadata.json')
      .map(formatFileInfo);
    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    res.json({ files, totalCount: files.length, totalSize });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Check file security and trigger actions
function handleFileAccess(filename, reqPin) {
  const filePath = path.join(uploadsDir, filename);
  if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
    return { error: 'File not found', status: 404 };
  }

  const meta = fileMetadata[filename] || {};
  if (meta.pin && meta.pin !== reqPin) {
    return { error: 'Unauthorized. Invalid PIN.', status: 401 };
  }

  return { filePath, meta };
}

// Download file
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const deviceName = req.query.deviceName || 'Unknown Device';
  const pin = req.query.pin;

  const access = handleFileAccess(filename, pin);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const dispName = getDisplayName(filename);
  addLog('Downloaded', dispName, deviceName);

  res.download(access.filePath, dispName, (err) => {
    // If One-Time transfer, delete immediately after successful download
    if (!err && access.meta.isOneTime) {
      try {
        fs.unlinkSync(access.filePath);
        delete fileMetadata[filename];
        saveMetadata();
        addLog('Burned (One-Time)', dispName, 'System');
      } catch(e) {}
    }
  });
});

// Preview file (inline)
app.get('/api/preview/:filename', (req, res) => {
  const filename = req.params.filename;
  const pin = req.query.pin;

  const access = handleFileAccess(filename, pin);
  if (access.error) return res.status(access.status).send(access.error);

  const ext = path.extname(filename).toLowerCase();
  const mime = getMimeType(ext);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(access.filePath).pipe(res);
});

// Delete file
app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const deviceName = req.query.deviceName || 'Unknown Device';
  const filePath = path.join(uploadsDir, filename);
  
  if (!filePath.startsWith(uploadsDir)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  
  fs.unlinkSync(filePath);
  if (fileMetadata[filename]) {
    delete fileMetadata[filename];
    saveMetadata();
  }
  
  addLog('Deleted', getDisplayName(filename), deviceName);
  res.json({ success: true, message: `Deleted ${filename}` });
});

// ── Serve React Frontend ──────────────────────────────────────────

const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

// ── Start Server ──────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║         🚀 LocalSync Server Running          ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}             ║`);
  console.log(`  ║  Network: http://${ip}:${PORT}        ║`);
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log('  ║  📱 Open the Network URL on your phone       ║');
  console.log('  ║  📡 Both devices must be on same WiFi        ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
