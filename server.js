const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const cors = require('cors');

// Basic configuration ---------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS if you want to host frontend separately
app.use(cors({ exposedHeaders: ['X-Filename', 'Content-Disposition'] }));

// Serve static files from /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Storage for uploaded encrypted files ----------------------
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 3 GB max
});

// In-memory metadata store: { [id]: { path, filename, mime, expiresAt, maxDownloads, downloads } }
const files = Object.create(null);

// Utility to delete physical file and metadata
function cleanup(id) {
  const meta = files[id];
  if (!meta) return;
  fs.unlink(meta.path, () => {}); // ignore errors
  delete files[id];
}

// Periodic cleanup (run every minute)
setInterval(() => {
  const now = Date.now();
  for (const id of Object.keys(files)) {
    const meta = files[id];
    const expiredByTime = meta.expiresAt !== null && now > meta.expiresAt;
    const expiredByCount = meta.maxDownloads !== null && meta.downloads >= meta.maxDownloads;
    if (expiredByTime || expiredByCount) {
      cleanup(id);
    }
  }
}, 60 * 1000);

// -----------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------

// POST /api/upload — save encrypted blob and return ID
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file field' });
  }

  const { expiresMinutes, maxDownloads, filename } = req.body;

  const id = uuidv4();
  const expiresAt = expiresMinutes ? Date.now() + parseInt(expiresMinutes, 10) * 60 * 1000 : null;
  const maxDL = maxDownloads ? parseInt(maxDownloads, 10) : null;
  files[id] = {
    path: req.file.path,
    filename: filename || 'file',
    mime: req.file.mimetype,
    expiresAt,
    maxDownloads: maxDL,
    downloads: 0,
  };

  res.json({ id });
});

// GET /api/file/:id — stream encrypted blob if still valid
app.get('/api/file/:id', (req, res) => {
  const { id } = req.params;
  const meta = files[id];
  if (!meta) {
    return res.sendStatus(404);
  }

  const now = Date.now();
  const expiredByTime = meta.expiresAt !== null && now > meta.expiresAt;
  const expiredByCount = meta.maxDownloads !== null && meta.downloads >= meta.maxDownloads;

  if (expiredByTime || expiredByCount) {
    cleanup(id);
    return res.sendStatus(410); // Gone
  }

  meta.downloads += 1;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.filename)}"`);
  res.setHeader('X-Filename', encodeURIComponent(meta.filename));

  const stream = fs.createReadStream(meta.path);
  stream.pipe(res);

  // When streaming finished, evaluate if we need to delete by count
  stream.on('close', () => {
    if (meta.maxDownloads !== null && meta.downloads >= meta.maxDownloads) {
      cleanup(id);
    }
  });
});

// -----------------------------------------------------------
// Start server
// -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Secure File Share server running on http://localhost:${PORT}`);
}); 