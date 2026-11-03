import React, { useState } from 'react';
import { QrCode, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { publicAPI } from '../../services/api';

/**
 * Robust, high-fidelity QR Code SVG renderer component.
 * Supports:
 *  1. Raw SVG string (svgString) from backend ReportLab generator
 *  2. Direct SVG image URL via API endpoint (eventId + studentId)
 *  3. Fallback placeholder / copy link integration
 */
export const QRCodeSVG = ({
  svgString = '',
  eventId = null,
  studentId = null,
  value = '',
  size = 180,
  className = '',
  showActions = false,
  title = 'Participant Badge QR'
}) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // If a raw SVG string is provided, clean and render it directly
  if (svgString && svgString.trim().startsWith('<svg') || svgString.includes('<svg')) {
    // Strip XML headers if present
    const cleanSvg = svgString.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!DOCTYPE[\s\S]*?>/i, '');
    return (
      <div className={`relative flex flex-col items-center justify-center ${className}`}>
        <div 
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
        {showActions && value && (
          <div className="mt-2 flex items-center space-x-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // If eventId and studentId are present, stream the server-rendered SVG
  const qrUrl = (eventId && studentId)
    ? publicAPI.getParticipantQrUrl(eventId, studentId, value, size)
    : '';

  if (qrUrl && !imgError) {
    return (
      <div className={`relative flex flex-col items-center justify-center ${className}`}>
        <img
          src={qrUrl}
          alt={title}
          width={size}
          height={size}
          onError={() => setImgError(true)}
          className="max-w-full max-h-full object-contain"
        />
        {showActions && value && (
          <div className="mt-2.5 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{copied ? 'Copied Link' : 'Copy Pass Link'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Graceful fallback display
  return (
    <div className={`flex flex-col items-center justify-center p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl ${className}`}>
      <QrCode className="w-12 h-12 text-gray-400 mb-1" />
      <span className="text-[11px] text-gray-500 text-center font-medium">Digital Pass QR</span>
      {value && (
        <span className="text-[10px] text-gray-400 truncate max-w-full mt-1 font-mono">{value}</span>
      )}
    </div>
  );
};

export default QRCodeSVG;
