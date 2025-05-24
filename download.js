(async () => {
  const API_BASE = 'https://secure-file-share-auxk.onrender.com';
  const statusEl = document.getElementById('status');

  if (!location.hash) {
    statusEl.textContent = 'Invalid link: missing parameters.';
    return;
  }

  const parts = location.hash.substring(1).split(':');
  if (parts.length !== 3) {
    statusEl.textContent = 'Invalid link format.';
    return;
  }
  const [id, keyB64, ivB64] = parts;

  // Helper to convert base64 -> ArrayBuffer
  function b64ToBuf(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  try {
    statusEl.textContent = 'Fetching encrypted file…';
    const response = await fetch(`${API_BASE}/api/file/${id}`);
    if (!response.ok) {
      statusEl.textContent = 'Link expired or file no longer available.';
      return;
    }
    const cipherBuf = await response.arrayBuffer();

    statusEl.textContent = 'Decrypting…';

    const keyBuf = b64ToBuf(keyB64);
    const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'AES-GCM' }, false, ['decrypt']);
    const ivBuf = new Uint8Array(b64ToBuf(ivB64));

    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, cipherBuf);

    const fileName = decodeURIComponent(response.headers.get('X-Filename') || 'file');

    // Download
    const blob = new Blob([plainBuf]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);

    statusEl.textContent = 'File downloaded and decrypted successfully!';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Decryption failed. Perhaps the link is corrupted.';
  }
})(); 