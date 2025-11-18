#!/usr/bin/env node
/*
  Script tải model weights của face-api.js từ CDN vào thư mục public/face-api-models
  Usage: node ./scripts/download-faceapi-models.js

  Ghi chú:
  - Yêu cầu Node 18+ (có global fetch). Nếu máy bạn chưa có Node 18, cài hoặc chạy thủ công.
  - Script sẽ tải manifest cho từng model sau đó tải các file .bin được manifest tham chiếu.
  - Nếu CDN unreachable, script sẽ báo lỗi.
*/

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'face-api-models');
// List of CDN bases to try (some hosts use different paths)
const CDN_BASES = [
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
];

const manifests = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-weights_manifest.json'
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchArrayBufferToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(ab));
}

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const manifestName of manifests) {
      let manifest = null;
      let usedBase = null;
      // try each CDN base until one returns the manifest
      for (const base of CDN_BASES) {
        const manifestUrl = `${base}/${manifestName}`;
        try {
          console.log('Trying manifest at', manifestUrl);
          manifest = await fetchJson(manifestUrl);
          usedBase = base;
          console.log('Fetched manifest from', manifestUrl);
          break;
        } catch (e) {
          console.warn('Manifest fetch failed at', manifestUrl, e.message || e);
          // try next base
        }
      }
      if (!manifest) throw new Error('Could not fetch manifest for ' + manifestName + ' from any CDN base');

      const outManifestPath = path.join(OUT_DIR, manifestName);
      fs.writeFileSync(outManifestPath, JSON.stringify(manifest, null, 2));
      console.log('Saved manifest ->', outManifestPath);

      // find referenced weight files inside manifest
      const weightPaths = new Set();
      if (Array.isArray(manifest)) {
        for (const item of manifest) {
          if (item && Array.isArray(item.weights)) {
            for (const w of item.weights) {
              if (w && w.path) weightPaths.add(w.path);
            }
          }
        }
      }

      // download each weight file using the usedBase
      for (const rel of weightPaths) {
        const fileUrl = `${usedBase}/${rel}`;
        const outFile = path.join(OUT_DIR, path.basename(rel));
        if (fs.existsSync(outFile)) {
          console.log('Already exists, skip', outFile);
          continue;
        }
        console.log('Downloading', fileUrl);
        await fetchArrayBufferToFile(fileUrl, outFile);
        console.log('Saved ->', outFile);
      }
    }

    console.log('\nAll models downloaded into', OUT_DIR);
    console.log('Restart your dev server and retry the capture.');
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
