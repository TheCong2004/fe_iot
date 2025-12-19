# Multi-stage Dockerfile for both Frontend (Next.js) and Backend (Python Flask)

# ----------- FRONTEND BUILD (Next.js) -----------
FROM node:20 AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ----------- BACKEND BUILD (Python Flask) -----------
FROM python:3.11 AS backend-build
WORKDIR /backend
COPY backend_python/ ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ----------- FINAL STAGE: COMBINED -----------
FROM node:20 AS final

# Copy frontend build
WORKDIR /app
COPY --from=frontend-build /app/.next .next
COPY --from=frontend-build /app/public public
COPY --from=frontend-build /app/package.json package.json
COPY --from=frontend-build /app/next.config.* ./
COPY --from=frontend-build /app/node_modules node_modules
COPY --from=frontend-build /app/.env.local .env.local

# Copy backend
WORKDIR /app/backend_python
COPY --from=backend-build /backend .

# Install Python in final image (Debian/Ubuntu base)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    python3 -m venv /venv && \
    . /venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r requirements.txt
ENV PATH="/venv/bin:$PATH"

# Expose ports
EXPOSE 3000 4000

# Start both FE and BE using a simple process manager
WORKDIR /app
CMD ["sh", "-c", "(cd backend_python && python app.py &) && npm run start"]
