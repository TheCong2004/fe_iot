"use client";
import React, { useEffect, useRef, useState } from 'react';

type Detected = { dataUrl: string; bbox?: { x: number; y: number; w: number; h: number } };

interface FaceScannerProps {
  onDetected: (d: Detected) => void;
  onError?: (e: Error) => void;
  onCancel?: () => void;
}

export default function FaceScanner({ onDetected, onError, onCancel }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera luôn bật
  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      setMsg('Yêu cầu quyền camera...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return; }
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        setCameraReady(true);
        setMsg('Camera sẵn sàng. Nhấn "Bắt đầu quét" để bắt đầu.');
      } catch (e) {
        const err = e as Error;
        console.error('Camera error', err);
        setMsg('Lỗi khi truy cập camera: ' + (err.message || String(e)));
        if (onError) onError(err);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t=>t.stop());
      }
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.remove();
      }
    };
  }, [onError]);

  // Quét khuôn mặt khi scanning = true
  useEffect(() => {
    if (!scanning || !cameraReady) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    let mounted = true;
    let faceapi: any = null;
    let nativeDetector: any = null;

    async function initDetectors() {
      setMsg('Đang tải mô hình phát hiện...');
      
      const useNative = 'FaceDetector' in window;
      
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
          console.warn('face-api.js load failed', e);
        }
      }
      
      faceapi = (window as any).faceapi || null;

      if (faceapi) {
        try {
          if (!(window as any)._faceApiModelsLoaded) {
            const MODEL_ROOT = '/face-api-models';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_ROOT);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_ROOT);
            (window as any)._faceApiModelsLoaded = true;
          }
        } catch (e) {
          console.warn('face-api models load failed', e);
          faceapi = null;
        }
      }

      if (useNative) {
        nativeDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      }

      setMsg('Đang quét khuôn mặt...');

      // Prepare canvas for overlay
      if (!canvasRef.current) {
        const c = document.createElement('canvas');
        c.style.position = 'absolute';
        c.style.left = '0';
        c.style.top = '0';
        c.style.pointerEvents = 'none';
        canvasRef.current = c;
      }
    }

    async function tick() {
      try {
        const v = videoRef.current;
        if (!v || v.readyState < 2) { 
          rafRef.current = requestAnimationFrame(tick); 
          return; 
        }

        const vw = v.videoWidth;
        const vh = v.videoHeight;

        // overlay canvas sizing
        if (canvasRef.current && canvasRef.current.width !== vw) {
          canvasRef.current.width = vw; 
          canvasRef.current.height = vh;
          if (v.parentElement && !v.parentElement.querySelector('canvas')) {
            v.parentElement.style.position = 'relative';
            v.parentElement.appendChild(canvasRef.current);
          }
        }

        let detected: { x: number; y: number; width: number; height: number } | null = null;

        if (nativeDetector) {
          try {
            const faces = await nativeDetector.detect(v);
            if (faces && faces.length > 0) detected = faces[0].boundingBox;
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
              const ctx = canvas.getContext('2d'); 
              if (ctx) ctx.drawImage(v, 0, 0, vw, vh);
              const dataUrl = canvas.toDataURL('image/jpeg');
              const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
              const res = await fetch(`${backend}/api/detect-face`, { 
                method: 'POST', 
                headers: { 'Content-Type':'application/json' }, 
                body: JSON.stringify({ dataUrl }) 
              });
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
              ctx.strokeStyle = '#10B981'; 
              ctx.lineWidth = 3; 
              ctx.strokeRect(detected.x, detected.y, detected.width, detected.height);
            }
          }
        }

        if (detected) {
          const area = (detected.width * detected.height) / (vw * vh);
          if (area >= 0.02) {
            const c = document.createElement('canvas'); 
            c.width = vw; 
            c.height = vh; 
            const ctx = c.getContext('2d'); 
            if (ctx) ctx.drawImage(v,0,0);
            const dataUrl = c.toDataURL('image/jpeg');
            
            if (mounted) {
              setScanning(false);
              setMsg('Đã phát hiện khuôn mặt!');
              onDetected({ 
                dataUrl, 
                bbox: { 
                  x: Math.round(detected.x), 
                  y: Math.round(detected.y), 
                  w: Math.round(detected.width), 
                  h: Math.round(detected.height) 
                } 
              });
            }
            return;
          }
        }
      } catch (e) {
        const err = e as Error;
        console.error('FaceScanner tick error', err);
        if (onError) onError(err);
      }
      
      rafRef.current = requestAnimationFrame(tick);
    }

    initDetectors().then(() => {
      if (mounted && scanning) {
        rafRef.current = requestAnimationFrame(tick);
      }
    });

    return () => {
      mounted = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scanning, cameraReady, onDetected, onError]);

  return (
    <div className="relative">
      {/* Status Message */}
      {msg && (
        <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
          <p className="text-sm font-medium text-blue-700">{msg}</p>
        </div>
      )}

      {/* Video Container */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-gray-100 bg-black">
        <video 
          ref={videoRef} 
          className="w-full max-w-2xl mx-auto"
          style={{ maxWidth: 480 }}
          playsInline 
          muted 
        />
        
        {/* Overlay scanning effect when running */}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-4 border-green-400 rounded-2xl animate-pulse"></div>
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan"></div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          {scanning ? (
            <div className="flex items-center space-x-2 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold">Đang quét</span>
            </div>
          ) : cameraReady ? (
            <div className="flex items-center space-x-2 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xs font-semibold">Sẵn sàng</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-gray-500 text-white px-3 py-2 rounded-full shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xs font-semibold">Đang khởi động</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 mt-6">
        {!scanning ? (
          <button 
            onClick={() => setScanning(true)}
            disabled={!cameraReady}
            className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-200 transform transition-all hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Bắt đầu quét</span>
          </button>
        ) : (
          <button 
            onClick={() => setScanning(false)}
            className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-4 focus:ring-orange-200 transform transition-all hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            <span>Dừng quét</span>
          </button>
        )}
        
        <button 
          onClick={() => { if (onCancel) onCancel(); }}
          className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transform transition-all hover:scale-[1.02] active:scale-95 border-2 border-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Hủy</span>
        </button>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100vh);
          }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}