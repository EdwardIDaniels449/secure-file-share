# Secure File Share

A minimal demo web application that lets you share files via **end-to-end encryption** and **auto-expiring links**.

## Features

* Files are encrypted in-browser with AES-256-GCM.
* **Upload entire folders** – the web app zips directories client-side before encryption, letting you share complex project structures effortlessly.
* Supports files up to **3 GB** per upload (increaseable in `server.js`).
* The decryption key never leaves the browser — it is embedded in the link fragment (`#...`), which is *not* sent to the server.
* Configure **expiry time** (minutes) and **maximum download count** when uploading.
* Files are automatically deleted on the server once expired or downloaded the specified number of times.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open your browser at <http://localhost:3000> and begin sharing securely!

## Security Notes

This is a lightweight demo. For production use, consider:

* Persisting metadata in a database rather than in-memory.
* Serving over **HTTPS**.
* Implementing authentication / rate limiting.
* Using a secure temporary storage service like Amazon S3 with presigned URLs. 