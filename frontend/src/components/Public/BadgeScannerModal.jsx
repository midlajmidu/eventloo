import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Camera, 
  Image as ImageIcon, 
  Search, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  QrCode,
  ArrowRight
} from 'lucide-react';

const BadgeScannerModal = ({ isOpen, onClose, eventId, eventTitle }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [manualInput, setManualInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Start Camera Stream
  const startCamera = async (mode = facingMode) => {
    setCameraError('');
    setScanMessage('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. You can enter the chest number manually below.');
      } else {
        setCameraError('Unable to access camera on this device. Use manual search or photo upload below.');
      }
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Auto-scan using native BarcodeDetector if available
  useEffect(() => {
    let intervalId = null;
    if (isOpen && cameraActive && videoRef.current && window.BarcodeDetector) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
        intervalId = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue;
                handleCodeDetected(rawVal);
              }
            } catch {
              // ignore detection frame errors
            }
          }
        }, 300);
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, cameraActive]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode]);

  // Parse QR Code URL or Raw Value
  const handleCodeDetected = (rawText) => {
    if (!rawText) return;
    setScanMessage(`Detected: ${rawText}`);

    // Check if it's a full URL containing /badge/ or /badges/ or /participants/
    let targetIdentifier = rawText.trim();

    try {
      if (rawText.includes('/badge/') || rawText.includes('/badges/') || rawText.includes('/participants/')) {
        const urlObj = new URL(rawText, window.location.origin);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          targetIdentifier = lastPart;
        }
      }
    } catch {
      // not a standard URL, use rawText
    }

    // Clean up
    targetIdentifier = targetIdentifier.replace(/[^a-zA-Z0-9_-]/g, '');
    if (targetIdentifier) {
      stopCamera();
      onClose();
      navigate(`/events/${eventId}/badge/${targetIdentifier}`);
    }
  };

  // Submit manual chest number or student ID
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const cleanId = manualInput.trim();
    if (!cleanId) return;

    setSearching(true);
    stopCamera();
    onClose();
    navigate(`/events/${eventId}/badge/${cleanId}`);
  };

  // Scan from photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanMessage('Analyzing photo...');
    try {
      if (window.BarcodeDetector) {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const barcodes = await barcodeDetector.detect(img);
            if (barcodes && barcodes.length > 0) {
              handleCodeDetected(barcodes[0].rawValue);
            } else {
              setCameraError('No QR code detected in this photo. Please try another or enter ID manually.');
            }
          } catch {
            setCameraError('Could not process this image format. Please enter chest number manually.');
          }
        };
      } else {
        setCameraError('Photo QR reading requires browser BarcodeDetector. Please type the chest number below.');
      }
    } catch (err) {
      console.error(err);
      setCameraError('Error reading photo. Please enter chest number manually.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Modal Card - Styled like Image 7 with artistic vibe */}
      <div className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-rose-600 via-pink-600 to-indigo-900 text-white shadow-2xl border border-white/20">
        {/* Close Button (Orange Circular Pill like Reference Image) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Close scanner"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Modal Header */}
        <div className="px-6 pt-7 pb-4 text-center">
          <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-sm font-sans">
            Scan the QR
          </h2>
          <p className="mt-1 text-xs font-semibold text-amber-200">
            Hold the Camera Over the QR on the Candidate / Badge Card
          </p>
        </div>

        {/* Viewfinder Area */}
        <div className="px-6 pb-4">
          <div className="relative aspect-square w-full max-w-[280px] sm:max-w-[320px] mx-auto overflow-hidden rounded-2xl bg-slate-900 border-2 border-white/30 shadow-inner flex items-center justify-center">
            {/* Real Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Viewfinder Focus Corners (Yellow Brackets like Reference Image 7) */}
            <div className="pointer-events-none absolute inset-5 flex flex-col justify-between z-10">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-xs" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-xs" />
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-xs" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-xs" />
              </div>
            </div>

            {/* Animated Laser Scanning Line */}
            {cameraActive && (
              <div className="pointer-events-none absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_15px_#f43f5e] animate-scan-laser z-10" />
            )}

            {/* Fallback / Loading State */}
            {!cameraActive && (
              <div className="p-4 text-center space-y-2 z-0">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white/70" />
                </div>
                <p className="text-xs text-white/80 font-medium">
                  {cameraError ? cameraError : 'Starting camera viewfinder...'}
                </p>
                {cameraError && (
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-[11px] font-bold transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry Camera
                  </button>
                )}
              </div>
            )}

            {/* Camera Switcher Icon (Flip Camera) */}
            {cameraActive && (
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                className="absolute bottom-3 right-3 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md transition-all cursor-pointer"
                title="Switch camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Feedback message */}
          {scanMessage && (
            <p className="mt-2 text-center text-xs font-bold text-amber-300 animate-pulse">
              {scanMessage}
            </p>
          )}
        </div>

        {/* Scan from Photo & Manual ID Option */}
        <div className="px-6 pb-6 pt-1 space-y-4 text-center">
          {/* Scan from a Photo Button (Pill Button like Reference Image 7) */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white text-rose-600 hover:bg-rose-50 text-xs font-black shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer font-sans"
            >
              <ImageIcon className="w-4 h-4 text-rose-600" />
              <span>Scan from a Photo</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-white/50 text-[11px] font-bold uppercase tracking-wider">
            <div className="flex-1 h-px bg-white/20" />
            <span>or enter ID / Chest Number</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Chest # (e.g. 101) or ID"
                className="w-full px-4 py-2.5 text-xs font-bold text-slate-900 bg-white/95 rounded-xl border border-white/40 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim() || searching}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 text-xs font-black shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <span>{searching ? 'Finding...' : 'View Badge'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <p className="text-[10px] text-white/60">
            Instantly opens the digital badge with verified programs, chest number, and results for {eventTitle || 'this event'}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BadgeScannerModal;

