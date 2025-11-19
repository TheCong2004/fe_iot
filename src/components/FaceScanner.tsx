"use client";
import React, { useEffect, useRef, useState } from 'react';

type Detected = { dataUrl: string; bbox?: { x:number,y:number,w:number,h:number } };

export default function FaceScanner({ onDetected, onError, onCancel }:{ onDetected: (d:Detected)=>void; onError?: (e:Error)=>void; onCancel?: ()=>void }){
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [msg, setMsg] = useState('');
  const [running, setRunning] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    if (!running) {
      setMsg('');
      // cleanup if stopping
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      try {
        const v = videoRef.current;
        if (v && v.srcObject) {
          const st = v.srcObject as MediaStream;
          st.getTracks().forEach(t=>t.stop());
          v.srcObject = null;
        }
        if (canvasRef.current && canvasRef.current.parentElement) canvasRef.current.remove();
      } catch (e) {}
      return;
    }

    async function start() {
      setMsg('Yêu cầu quyền camera...');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setMsg('Camera đã bật. Đang tìm khuôn mặt...');

        // Prepare canvas for overlay
        if (!canvasRef.current) {
          const c = document.createElement('canvas');
          c.style.position = 'absolute';
          c.style.left = '0';
          c.style.top = '0';
          c.style.pointerEvents = 'none';
          canvasRef.current = c;
        }

        // Detection strategy: 1) Browser FaceDetector API (fast if available),
        // 2) face-api.js (tiny model, loaded once from local `/face-api-models`),
        // 3) server-side detect fallback.
        const useNative = 'FaceDetector' in window;
        let faceapi: any = null;

        if (!(window as any).faceapi) {
          try {
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
              s.async = true;
              s.onload = () => resolve();
              s.onerror = () => reject(new Error('Cannot load face-api.js'));
              document.head.appendChild(s);
            });
          } catch (e) {
            console.warn('face-api.js load failed, will fallback to server detect', e);
          }
        }
        faceapi = (window as any).faceapi || null;

        if (faceapi) {
          try {
            if (!(window as any)._faceApiModelsLoaded) {
              setMsg('Đang tải mô hình nhẹ (tiny) của face-api...');
              const MODEL_ROOT = '/face-api-models';
              await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_ROOT);
              await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_ROOT);
              (window as any)._faceApiModelsLoaded = true;
            }
            setMsg('Mô hình ready, quét...');
          } catch (e) {
            console.warn('face-api models load failed', e);
            faceapi = null;
          }
        }

        const nativeDetector = useNative ? new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;

        async function tick() {
          try {
            const v = videoRef.current;
            if (!v || v.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }

            const vw = v.videoWidth;
            const vh = v.videoHeight;

            // overlay canvas sizing
            if (canvasRef.current && canvasRef.current.width !== vw) {
              canvasRef.current.width = vw; canvasRef.current.height = vh;
              if (v.parentElement && !v.parentElement.querySelector('canvas')) {
                v.parentElement.style.position = 'relative';
                v.parentElement.appendChild(canvasRef.current);
              }
            }

            let detected: any = null;

            if (nativeDetector) {
              try {
                const faces = await nativeDetector.detect(v);
                if (faces && faces.length > 0) detected = faces[0].boundingBox; // {x,y,width,height}
              } catch (e) {}
            }

            if (!detected && faceapi) {
              try {
                const now = Date.now();
                if (!(window as any)._lastFaceApiDetect) (window as any)._lastFaceApiDetect = 0;
                if (now - (window as any)._lastFaceApiDetect > 250) {
                  (window as any)._lastFaceApiDetect = now;
                  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
                  const det = await faceapi.detectSingleFace(v, opts).withFaceLandmarks();
                  if (det && det.detection && det.detection.box) {
                    const b = det.detection.box;
                    detected = { x: b.x, y: b.y, width: b.width, height: b.height };
                  }
                }
              } catch (e) {}
            }

            if (!detected) {
              if ((window as any)._lastServerDetect && Date.now() - (window as any)._lastServerDetect < 800) {
                // skip
              } else {
                (window as any)._lastServerDetect = Date.now();
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = vw; canvas.height = vh;
                  const ctx = canvas.getContext('2d'); if (ctx) ctx.drawImage(v, 0, 0, vw, vh);
                  const dataUrl = canvas.toDataURL('image/jpeg');
                  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
                  const res = await fetch(`${backend}/api/detect-face`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ dataUrl }) });
                  const j = await res.json();
                  if (j && j.success && j.bbox) {
                    detected = { x: j.bbox.x, y: j.bbox.y, width: j.bbox.w, height: j.bbox.h };
                  }
                } catch (e) {}
              }
            }

            // draw overlay
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
                if (detected) {
                  ctx.strokeStyle = '#10B981'; ctx.lineWidth = 3; ctx.strokeRect(detected.x, detected.y, detected.width, detected.height);
                }
              }
            }

            if (detected) {
              const area = (detected.width * detected.height) / (vw * vh);
              if (area >= 0.02) {
                const c = document.createElement('canvas'); c.width = vw; c.height = vh; const ctx = c.getContext('2d'); if (ctx) ctx.drawImage(v,0,0);
                const dataUrl = c.toDataURL('image/jpeg');
                try { const st = v.srcObject as MediaStream; st.getTracks().forEach((t:any)=>t.stop()); } catch(e){}
                if (mounted) {
                  setRunning(false);
                  onDetected({ dataUrl, bbox: { x: Math.round(detected.x), y: Math.round(detected.y), w: Math.round(detected.width), h: Math.round(detected.height) } });
                }
                return;
              }
            }
          } catch (e:any) {
            console.error('FaceScanner tick error', e);
            if (onError) onError(e);
          }
          rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
      } catch (e:any) {
        console.error('FaceScanner start error', e);
        setMsg('Lỗi khi truy cập camera: ' + (e.message || e));
        if (onError) onError(e);
      }
    }

    start();

    return () => {
      mounted = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      try {
        if (stream) stream.getTracks().forEach(t=>t.stop());
        const v = videoRef.current;
        if (v && v.srcObject) {
          const st = v.srcObject as MediaStream;
          st.getTracks().forEach(t=>t.stop());
        }
        if (canvasRef.current && canvasRef.current.parentElement) canvasRef.current.remove();
      } catch (e) {}
    };
  }, [running, onDetected, onError]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: 8 }}>{msg}</div>
      <video ref={videoRef} style={{ width: '100%', maxWidth: 480, borderRadius: 6 }} playsInline muted />
      <div style={{ marginTop: 8 }}>
        {!running ? (
          <button onClick={() => setRunning(true)} style={{ marginRight: 8 }}>Bắt đầu quét</button>
        ) : (
          <button onClick={() => setRunning(false)} style={{ marginRight: 8 }}>Dừng quét</button>
        )}
        <button onClick={() => { if (onCancel) onCancel(); else { /* nothing */ } }}>Hủy quét</button>
      </div>
    </div>
  );
}
