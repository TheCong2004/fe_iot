# Dockerfile for backend_python (Flask + MongoDB)
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install system dependencies
# Đã sửa: thay libgl1-mesa-glx bằng libgl1 và thêm libglib2.0-0
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose Flask port
EXPOSE 5000

# Set environment variables (can be overridden by Render dashboard)
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

# Run Flask app
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]