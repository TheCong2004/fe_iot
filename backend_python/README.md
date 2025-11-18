# Backend Python (Flask) for Face Attendance

This folder contains a minimal Flask backend using OpenCV (Haarcascade + LBPH) to detect and recognize faces and to store employees and attendance in MongoDB. This implementation avoids compiling dlib and uses OpenCV contrib LBPH recognizer.

Quick start (Windows PowerShell):

```powershell
cd D:\fe_iot\backend_python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
# create .env with MONGODB_URI if needed
python app.py
```

Endpoints:
- `POST /api/upload-image`  { dataUrl } -> save image
- `POST /api/register`      { name, department, dataUrl } -> enroll
- `POST /api/scan-and-mark` { dataUrl } -> detect & match -> save attendance
- `GET  /api/employees` -> list employees (no descriptors by default)
- `GET  /uploads/<file>` -> serve uploaded images

- Notes:
- This backend uses OpenCV Haarcascade for face detection and LBPH for recognition. LBPH is lightweight and works without dlib but typically requires multiple enrollment images per person for reasonable accuracy.
- To improve results: collect several face samples per user, train by enrolling multiple images, and adjust `LBPH_THRESHOLD` environment variable in `.env` if needed.
- This folder is created as a separate backend so your existing Node backend remains intact. If you want me to remove the Node backend, tell me and I'll do it.
