import React, { useEffect, useRef, useState } from "react";
import { Camera, AlertCircle } from "lucide-react";

/** Camera QR scanner for public themes */
export function QrScanner({ onScan, className = "" }: { onScan: (text: string) => void; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let intervalId: any = null;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access is not supported by your browser.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
          intervalId = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && active) {
                  const val = barcodes[0].rawValue;
                  if (val) {
                    onScan(val);
                  }
                }
              } catch {}
            }
          }, 350);
        }
      } catch (err) {
        setError("Camera permission was denied or camera is unavailable. Enter the code manually below.");
      }
    };

    start();

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className={`overflow-hidden rounded-2xl bg-black/90 p-4 relative ${className}`}>
      <div className="relative aspect-square max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-primary/40 flex items-center justify-center">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
        {/* Viewfinder Overlay */}
        <div className="absolute inset-8 pointer-events-none border-2 border-primary/60 rounded-xl" />
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 justify-center">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/** Pull a badge code out of a scanned value (a verify URL or the bare code). */
export function extractBadgeCode(text: string) {
  try {
    const match = text.match(/\/badges\/([^/?#]+)/i) ||
                  text.match(/\/participants\/([^/?#]+)/i) ||
                  text.match(/\/badge\/([^/?#]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    const u = new URL(text);
    return u.searchParams.get("code") ?? text;
  } catch {
    return text.trim();
  }
}

