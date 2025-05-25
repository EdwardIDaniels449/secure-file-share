const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const uploadBtn = document.getElementById('uploadBtn');
const linkContainer = document.getElementById('linkContainer');
const progressContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');

// Base URL of backend API (Render deployment)
const API_BASE = 'https://secure-file-share-auxk.onrender.com';

// Helpers ----------------------------------------------------
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// -----------------------------------------------------------

function setProgress(pct) {
  progressContainer.style.display = 'block';
  progressBar.style.width = pct + '%';
}

uploadBtn.addEventListener('click', async () => {
  const files = fileInput.files.length ? fileInput.files : folderInput.files;
  if (files.length === 0) {
    alert('Please select a file first.');
    return;
  }

  // Read user settings
  const expiresMinutes = document.getElementById('expires').value || 60;
  const maxDownloads = document.getElementById('maxDownloads').value || 5;

  try {
    // 0. Prepare data (zip if multiple files or directory selected)
    let dataBuffer;
    let plainFilename;
    if (files.length === 1) {
      const file = files[0];
      dataBuffer = await file.arrayBuffer();
      plainFilename = file.name;
    } else {
      const zip = new JSZip();
      for (const f of files) {
        const relative = f.webkitRelativePath || f.name;
        zip.file(relative, f);
      }
      linkContainer.textContent = 'Compressing folder…';
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      dataBuffer = await zipBlob.arrayBuffer();
      plainFilename = 'archive.zip';
    }

    // 1. Generate AES-GCM key
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = await crypto.subtle.exportKey('raw', key);

    // 2. Encrypt buffer with random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBuffer);

    // 3. Upload encrypted blob
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, 'cipher.bin');
    form.append('expiresMinutes', expiresMinutes);
    form.append('maxDownloads', maxDownloads);
    form.append('filename', plainFilename);

    linkContainer.textContent = 'Uploading…';
    setProgress(0);

    const id = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
        }
      };
      xhr.onload = () => {
        try {
          if (xhr.status === 200) {
            const json = JSON.parse(xhr.responseText);
            setProgress(100);
            resolve(json.id);
          } else {
            reject(new Error('Upload failed'));
          }
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });

    // 4. Create shareable link with key & IV in URL fragment (hash)
    const keyB64 = arrayBufferToBase64(rawKey);
    const ivB64 = arrayBufferToBase64(iv);
    const base = location.origin + location.pathname.replace(/\/[^/]*$/, '');
    const shareURL = `${base}/download.html#${id}:${keyB64}:${ivB64}`;

    linkContainer.innerHTML = `Share this link: <a href="${shareURL}" target="_blank">${shareURL}</a>`;

    const qrDiv = document.getElementById('qrContainer');
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, { text: shareURL, width: 128, height: 128 });

    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 1500);
  } catch (err) {
    alert('An error occurred while uploading the file.');
    console.error(err);
  }
});