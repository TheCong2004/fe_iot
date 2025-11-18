"use client";
import React, { useRef, useEffect } from 'react';

// Component camera: hien thi video va chup anh khi can
type Props = {
  onCapture: (dataUrl: string) => void;
  facingMode?: 'user' | 'environment';
};

export default function CameraCapture({ onCapture, facingMode = 'user' }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error('Cannot access camera', e);
      }
    }
    start();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    onCapture(dataUrl);
  }

  return (
    <div>
      <video ref={videoRef} style={{ width: '100%', maxWidth: 640 }} playsInline />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleCapture} style={{ padding: '8px 12px' }}>Chup anh</button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
