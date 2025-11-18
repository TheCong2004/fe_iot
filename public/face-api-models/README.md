Download cac model cua face-api.js vao thu muc nay de frontend co the load.

1. Tai cac file model tu repository chinh: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
Hoac tu CDN:
 - https://github.com/justadudewhohacks/face-api.js-models

2. Copy cac file sau vao `public/face-api-models/`:
 - face_recognition_model-weights_manifest.json
 - face_recognition_model-shard1
 - face_landmark_68_model-weights_manifest.json
 - face_landmark_68_model-shard1
 - ssd_mobilenetv1_model-weights_manifest.json
 - ssd_mobilenetv1_model-shard1

3. Khi da co trong `public/face-api-models`, frontend se load tu `/face-api-models`.

Ghi chu: neu dung CDN thay vi public, thay doi duong dan load tren frontend.
