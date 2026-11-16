import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  QrCode,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { ExploreBadgeArt, TwinklingStar } from './PublicArtwork';

const PublicVerifyPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  // Scanner state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [verifiedCandidate, setVerifiedCandidate] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    fetchEventPortal();
    return () => {
      stopCamera();
    };
  }, [eventId]);

  const fetchEventPortal = async () => {
    try {
      setLoadingEvent(true);
      const res = await publicEventAPI.getPublicPortal(eventId);
      setEventData(res.data?.event || null);
    } catch (err) {
      console.error('Error fetching event data:', err);
    } finally {
      setLoadingEvent(false);
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError('');
    setVerifyError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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
        setCameraError('Camera permission was denied. Please allow camera access or search by chest number below.');
      } else {
        setCameraError('Unable to access camera on this device. Use photo upload or enter chest number.');
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

  // Native BarcodeDetector auto-scan
  useEffect(() => {
    let intervalId = null;
    if (cameraActive && videoRef.current && window.BarcodeDetector) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128'] });
        intervalId = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue;
                handleCodeDetected(rawVal);
              }
            } catch {
              // Ignore frame errors
            }
          }
        }, 350);
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraActive]);

  // Extract ID / chest number from QR text
  const extractIdentifier = (rawVal) => {
    if (!rawVal) return null;
    const trimmed = rawVal.trim();

    // Check if it's a URL like /events/2/badge/12 or /participants/12/
    const match = trimmed.match(/\/badges\/([^/?#]+)/i) ||
                  trimmed.match(/\/participants\/([^/?#]+)/i) ||
                  trimmed.match(/\/badge\/([^/?#]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleCodeDetected = (rawVal) => {
    const id = extractIdentifier(rawVal);
    if (id) {
      stopCamera();
      lookupCandidate(id);
    }
  };

  // Search candidate by identifier (chest number or ID)
  const lookupCandidate = async (identifier) => {
    if (!identifier) return;
    setSearching(true);
    setVerifyError('');
    setVerifiedCandidate(null);

    try {
      const res = await publicEventAPI.getParticipantBadge(eventId, identifier);
      setVerifiedCandidate(res.data);
      stopCamera();
    } catch (err) {
      console.error('Candidate verification error:', err);
      setVerifyError(
        err?.response?.data?.error ||
        `No verified candidate badge found for "${identifier}". Please check the chest number or QR code.`
      );
    } finally {
      setSearching(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      lookupCandidate(manualInput.trim());
    }
  };

  // Handle file photo upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.BarcodeDetector) {
      try {
        setSearching(true);
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const imageBitmap = await createImageBitmap(file);
        const barcodes = await barcodeDetector.detect(imageBitmap);
        if (barcodes && barcodes.length > 0) {
          handleCodeDetected(barcodes[0].rawValue);
        } else {
          setVerifyError('No scannable QR code found in the uploaded image.');
        }
      } catch (err) {
        console.warn('Barcode detection from image failed:', err);
        setVerifyError('Could not read QR code from photo. Please enter chest number manually.');
      } finally {
        setSearching(false);
      }
    } else {
      setVerifyError('Photo QR scanning requires a modern browser. Please enter the chest number manually.');
    }
  };

  const handleReset = () => {
    setVerifiedCandidate(null);
    setVerifyError('');
    setManualInput('');
    startCamera();
  };

  return (
    <div className="min-h-screen bg-[#090817] text-white selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between overflow-x-hidden">
      {/* 1. Global Navigation Bar */}
      <PublicNavbar eventId={eventId} eventData={eventData} />

      {/* 2. Main Verification Experience */}
      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header Vignette */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-amber-400">
            <Sparkles className="w-4 h-4 animate-twinkle" />
            <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
              Digital Credential Verification
            </span>
            <Sparkles className="w-4 h-4 animate-twinkle" />
          </div>

          <h1 className="font-cinzel-dec text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
            Candidate Badge & QR Scanner
          </h1>

          <p className="text-xs sm:text-sm text-amber-200/80 max-w-lg mx-auto font-sans leading-relaxed">
            Verify official participant badges, check registered programs, and inspect real-time digital credentials.
          </p>
        </div>

        {/* 3. Verified Candidate Result Card (When Found) */}
        {verifiedCandidate ? (
          <div className="bg-gradient-to-b from-[#1C1738] via-[#16113A] to-[#120E28] border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(245,158,11,0.25)] space-y-6 animate-fade-in">
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-amber-400/20">
              <div className="flex items-center space-x-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-cinzel text-xs uppercase tracking-widest font-bold">
                  Verified Candidate Badge
                </span>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-amber-400/30 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Scan Another</span>
              </button>
            </div>

            {/* Candidate Identity Profile Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo / Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 p-[2px] shadow-lg shrink-0">
                <div className="w-full h-full bg-[#120F2B] rounded-[14px] overflow-hidden flex items-center justify-center">
                  {verifiedCandidate.student?.profile_picture ? (
                    <img
                      src={verifiedCandidate.student.profile_picture}
                      alt={verifiedCandidate.student?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-amber-300/80" />
                  )}
                </div>
              </div>

              {/* Name & Credentials */}
              <div className="text-center sm:text-left space-y-2 flex-1">
                <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold">
                  Chest #{verifiedCandidate.student?.chest_number || 'N/A'}
                </div>

                <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {verifiedCandidate.student?.name || verifiedCandidate.student?.full_name || 'Candidate'}
                </h3>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300">
                  {verifiedCandidate.team?.name && (
                    <span className="font-semibold text-amber-300">
                      Team: {verifiedCandidate.team.name}
                    </span>
                  )}
                  {verifiedCandidate.student?.class_name && (
                    <>
                      <span>•</span>
                      <span>Class: {verifiedCandidate.student.class_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Registered Programs */}
            {verifiedCandidate.programs && verifiedCandidate.programs.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="font-cinzel text-xs uppercase tracking-wider text-amber-300 font-bold block">
                  Registered Programs ({verifiedCandidate.programs.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {verifiedCandidate.programs.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{p.name || p.program_name}</p>
                        <p className="text-[11px] text-slate-400">{p.stage_name || p.venue || 'Stage TBA'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 ml-2 shrink-0">
                        {p.category || 'Event'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Full Digital Badge Link Button */}
            <div className="pt-2 flex justify-center sm:justify-end">
              <Link
                to={`/events/${eventId}/badge/${verifiedCandidate.student?.id || verifiedCandidate.student?.chest_number}`}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-[#090817] font-bold text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all"
              >
                <span>View Full Digital Badge</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* 4. Scanner Viewfinder Card (Inspired by Reference Images 6 & 7) */
          <div className="bg-gradient-to-b from-[#1C1738] to-[#120E28] border-2 border-amber-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Camera Viewport or Start Trigger */}
            <div className="relative w-full max-w-md mx-auto aspect-square rounded-3xl overflow-hidden bg-[#0A071A] border-2 border-amber-400/40 shadow-inner flex flex-col items-center justify-center">
              
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />

                  {/* Yellow Focus Brackets (Inspired by Reference Image 7) */}
                  <div className="absolute inset-8 sm:inset-12 pointer-events-none border-2 border-transparent">
                    {/* Top Left Bracket */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                    {/* Top Right Bracket */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                    {/* Bottom Left Bracket */}
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                    {/* Bottom Right Bracket */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

                    {/* Animated Red / Rose Laser Scanning Line */}
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500 rounded-full shadow-[0_0_12px_#F43F5E] animate-scan-laser" />
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-300 flex items-center justify-center">
                    <QrCode className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-cinzel text-base font-bold text-white">
                      Hold Camera Over the QR Code
                    </h3>
                    <p className="text-xs text-amber-200/70 pt-1">
                      Position the candidate badge QR code inside the viewfinder
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-[#090817] font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Camera Scanner</span>
                  </button>
                </div>
              )}

              {/* Stop camera floating button when active */}
              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute bottom-4 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 transition-all"
                >
                  Pause Camera
                </button>
              )}
            </div>

            {/* Error Message if any */}
            {(cameraError || verifyError) && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{verifyError || cameraError}</span>
              </div>
            )}

            {/* Alternative Scan: Scan from a Photo Button (From Image 7) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={searching}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-amber-400/40 text-amber-200 text-xs font-bold uppercase tracking-wider transition-all"
              >
                <ImageIcon className="w-4 h-4 text-amber-300" />
                <span>Scan from a Photo</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-center space-x-4 py-2 text-slate-500">
              <span className="w-20 h-[1px] bg-white/10" />
              <span className="font-cinzel text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                or enter chest number
              </span>
              <span className="w-20 h-[1px] bg-white/10" />
            </div>

            {/* Manual Chest Number / Student ID Search Form */}
            <form onSubmit={handleManualSearch} className="max-w-md mx-auto flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-amber-400/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter Chest # (e.g. 101, 204)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#161138] border border-amber-500/30 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !manualInput.trim()}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-[#090817] font-bold text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all shrink-0 flex items-center space-x-1"
              >
                {searching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Verify</span>
                )}
              </button>
            </form>

          </div>
        )}

      </main>

      {/* 5. Global Footer */}
      <PublicFooter event={eventData} eventId={eventId} />
    </div>
  );
};

export default PublicVerifyPage;

