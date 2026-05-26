import React, { useState, useEffect, useRef } from 'react';

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'MacBook';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android.*?; (.*?) Build/);
    return match ? match[1] : 'Android Device';
  }
  return 'Desktop Browser';
}

function getTypeString(category) {
  const map = {
    document: 'Document', spreadsheet: 'Spreadsheet', presentation: 'Presentation',
    image: 'Image', video: 'Video', audio: 'Audio',
    archive: 'Archive', code: 'Code File', executable: 'Executable', other: 'File'
  };
  return map[category] || 'File';
}

export default function App() {
  const [serverInfo, setServerInfo] = useState(null);
  
  // Data States
  const [files, setFiles] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [connectedDevices, setConnectedDevices] = useState(1);
  const [connectedNames, setConnectedNames] = useState([]);
  const [pairingRequest, setPairingRequest] = useState(null);
  const [sharedClipboard, setSharedClipboard] = useState(null);
  const [clipboardText, setClipboardText] = useState('');
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterType, setFilterType] = useState('all');
  const [notification, setNotification] = useState('');
  
  // Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transferMode, setTransferMode] = useState('permanent');
  const [requirePin, setRequirePin] = useState(false);
  const [pinValue, setPinValue] = useState('');
  
  const fileInputRef = useRef(null);
  const deviceName = useRef(getDeviceName());

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const fetchServerInfo = async () => {
    try {
      const res = await fetch('/api/server-info');
      const data = await res.json();
      setServerInfo(data);
    } catch (error) {}
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (error) {}
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices?name=' + encodeURIComponent(deviceName.current));
      const data = await res.json();
      setConnectedDevices(data.count || 1);
      setConnectedNames(data.names || []);
    } catch (error) {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setActivityLogs(data);
    } catch (error) {}
  };

  const fetchPairing = async () => {
    try {
      const res = await fetch('/api/pairing-status');
      const data = await res.json();
      setPairingRequest(data.request || null);
    } catch (error) {}
  };

  const fetchClipboard = async () => {
    try {
      const res = await fetch('/api/clipboard');
      const data = await res.json();
      setSharedClipboard(data);
    } catch (error) {}
  };

  useEffect(() => {
    fetchServerInfo();
    fetchFiles();
    fetchDevices();
    fetchLogs();
    fetchPairing();
    fetchClipboard();

    const interval = setInterval(() => {
      fetchFiles();
      fetchDevices();
      fetchLogs();
      fetchPairing();
      fetchClipboard();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // --- Upload Handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const uploadFiles = (selectedFiles) => {
    if (requirePin && pinValue.length < 4) {
      alert("PIN must be at least 4 characters.");
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }
    formData.append('deviceName', deviceName.current);
    formData.append('mode', transferMode);
    if (requirePin && pinValue) {
      formData.append('pin', pinValue);
    }

    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status === 200) {
        fetchFiles();
        fetchLogs();
        showToast('Upload successful');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPinValue('');
        setRequirePin(false);
        setTransferMode('permanent');
      } else {
        showToast('Upload failed');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      showToast('Upload error');
    };

    xhr.send(formData);
  };

  const handleAction = (file, actionType) => {
    let pinStr = '';
    if (file.isLocked) {
      pinStr = window.prompt("🔒 This file is PIN protected. Enter PIN:");
      if (pinStr === null) return; // User cancelled
    }
    
    const qs = `?deviceName=${encodeURIComponent(deviceName.current)}&pin=${encodeURIComponent(pinStr || '')}`;
    
    if (actionType === 'download') {
      showToast('Download started');
      const link = document.createElement('a');
      link.href = `/api/download/${encodeURIComponent(file.name)}${qs}`;
      link.download = file.displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Wait a moment then refresh list in case it was a one-time burn
      setTimeout(fetchFiles, 1000);
    } else if (actionType === 'preview') {
      window.open(`/api/preview/${encodeURIComponent(file.name)}${qs}`, '_blank');
      setTimeout(fetchFiles, 1000);
    }
  };

  const deleteFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}?deviceName=${encodeURIComponent(deviceName.current)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchFiles();
        fetchLogs();
        showToast('File deleted');
      }
    } catch (err) {}
  };

  const updateClipboard = async () => {
    if (!clipboardText.trim()) return alert("Enter some text to share.");
    try {
      await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clipboardText, deviceName: deviceName.current })
      });
      setClipboardText('');
      showToast('Text updated on network');
      fetchClipboard();
      fetchLogs();
    } catch (err) {}
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => {
        fallbackCopyTextToClipboard(text);
      });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) showToast('Copied to clipboard!');
      else showToast('Failed to copy.');
    } catch (err) {
      showToast('Failed to copy.');
    }
    document.body.removeChild(textArea);
  };

  // Process Files
  let displayedFiles = files.filter(f => {
    if (filterType !== 'all' && f.category !== filterType) return false;
    if (searchQuery && !f.displayName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  displayedFiles.sort((a, b) => {
    if (sortBy === 'date') return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    if (sortBy === 'size') return b.size - a.size;
    if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
    return 0;
  });

  const getExpiryText = (file) => {
    if (file.isOneTime) return <span className="badge badge-danger">One-Time (Burn)</span>;
    if (file.expiry) {
      const hrs = Math.max(0, Math.floor((new Date(file.expiry) - new Date()) / 3600000));
      return <span className="badge badge-warning">{hrs}h left</span>;
    }
    return '';
  };

  return (
    <>
      <header className="header">
        <div className="brand">
          <h1>LocalSync</h1>
          <p>Secure Offline File Sharing System</p>
        </div>
        <div className="device-status">
          <div>Connected: {deviceName.current}</div>
          <div>Status: <span className="status-indicator">● Online</span></div>
          {connectedNames.length > 0 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.2rem' }}>
              Also: {connectedNames.filter(n => n !== deviceName.current).join(', ') || 'None'}
            </div>
          )}
        </div>
      </header>

      <div className="app-container">
        
        <div className="main-section">
          
          <section className="panel">
            <h2>Secure File Upload</h2>
            
            <div 
              className={`upload-drop-area ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              Drag & drop files here (Optional)
            </div>

            {/* Transfer Security Settings */}
            <div className="security-settings" style={{ background: '#f9f9f9', padding: '1rem', border: '1px solid var(--gov-border)', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
              <strong>Transfer Settings:</strong>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <select 
                  className="form-control" 
                  style={{ width: '100%' }}
                  value={transferMode}
                  onChange={(e) => setTransferMode(e.target.value)}
                >
                  <option value="permanent">Permanent Storage</option>
                  <option value="1h">Auto-Delete (1 Hour)</option>
                  <option value="24h">Auto-Delete (24 Hours)</option>
                  <option value="onetime">One-Time (Burn on Download)</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                  <input 
                    type="checkbox" 
                    id="requirePin" 
                    checked={requirePin} 
                    onChange={e => setRequirePin(e.target.checked)} 
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <label htmlFor="requirePin">Require PIN</label>
                  {requirePin && (
                    <input 
                      type="password" 
                      placeholder="Enter 4+ digit PIN" 
                      className="form-control"
                      style={{ flex: 1, minWidth: '120px' }}
                      value={pinValue}
                      onChange={e => setPinValue(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="upload-controls">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="form-control"
              />
              <button 
                className="btn"
                onClick={() => {
                  if (fileInputRef.current && fileInputRef.current.files.length > 0) {
                    uploadFiles(fileInputRef.current.files);
                  } else {
                    alert('Please choose a file first.');
                  }
                }}
              >
                Upload File(s)
              </button>
            </div>

            {uploading && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                  {Math.round(uploadProgress)}%
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Shared Clipboard</h2>
            <p style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>Directly copy & paste text to transfer across devices instantly.</p>
            
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea 
                  className="form-control" 
                  style={{ resize: 'vertical', minHeight: '60px' }}
                  placeholder="Type or paste text to share..." 
                  value={clipboardText}
                  onChange={e => setClipboardText(e.target.value)}
                ></textarea>
                <button className="btn" style={{ whiteSpace: 'nowrap' }} onClick={updateClipboard}>
                  Send Text
                </button>
              </div>

              {sharedClipboard && sharedClipboard.text && (
                <div style={{ background: '#f0f4c3', padding: '1rem', border: '1px solid #cddc39', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#827717' }}>
                      <strong>Latest Snippet</strong> (from {sharedClipboard.updatedBy})
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-sm" 
                        style={{ background: '#9e9d24' }}
                        onClick={() => copyToClipboard(sharedClipboard.text)}
                      >
                        Copy
                      </button>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={async () => {
                          await fetch('/api/clipboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '', deviceName: deviceName.current }) });
                          fetchClipboard();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', color: '#333' }}>
                    {sharedClipboard.text}
                  </pre>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>File Management</h2>
            
            <div className="filters-bar">
              <input
                type="text"
                className="form-control"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 2 }}
              />
              <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ flex: 1 }}>
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="document">PDF / Documents</option>
                <option value="video">Videos</option>
              </select>
              <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ flex: 1 }}>
                <option value="date">Sort: Date</option>
                <option value="size">Sort: Size</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th>Preview</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedFiles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-table">No records found.</td>
                  </tr>
                ) : (
                  displayedFiles.map(file => (
                    <tr key={file.name}>
                      <td title={file.displayName}>
                        {file.isLocked && <span style={{ marginRight: '5px' }}>🔒</span>}
                        {file.displayName}
                        <div style={{ marginTop: '4px' }}>{getExpiryText(file)}</div>
                      </td>
                      <td>{getTypeString(file.category)}</td>
                      <td>{formatSize(file.size)}</td>
                      <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          style={{ backgroundColor: 'var(--gov-accent)' }}
                          onClick={() => handleAction(file, 'preview')}
                        >
                          View
                        </button>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-sm"
                            onClick={() => handleAction(file, 'download')}
                          >
                            Download
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteFile(file.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

        </div>

        <div className="sidebar-section">
          <section className="panel qr-section">
            <h3>Scan to Connect</h3>
            
            {pairingRequest && (
              <div style={{ background: '#d32f2f', color: 'white', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', animation: 'fadeIn 0.3s ease' }}>
                <strong style={{ fontSize: '1.1rem' }}>Connection Request!</strong>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Device IP: {pairingRequest.ip}</p>
                <div style={{ fontSize: '2.5rem', letterSpacing: '5px', fontWeight: 'bold', margin: '0.5rem 0' }}>
                  {pairingRequest.pin}
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Enter this PIN on the connecting device.</p>
              </div>
            )}

            {serverInfo?.qrCode ? (
              <img src={serverInfo.qrCode} alt="Server QR Code" />
            ) : (
              <p>Loading QR...</p>
            )}
            <p>Access URL:</p>
            <div className="server-url">
              {serverInfo?.url || 'Loading...'}
            </div>
          </section>

          <section className="panel">
            <h3>Activity Log</h3>
            <table className="log-table">
              <tbody>
                {activityLogs.length === 0 ? (
                  <tr>
                    <td style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>No recent activity.</td>
                  </tr>
                ) : (
                  activityLogs.slice(0, 8).map((log, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{log.action}</strong> by {log.deviceName}<br/>
                        <span style={{ color: '#666' }}>{log.file}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </>
  );
}
