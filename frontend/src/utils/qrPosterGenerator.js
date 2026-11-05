/**
 * Minimal & Professional Event QR Poster Generator (PNG)
 * Matches the exact clean aesthetic requested:
 * - Official Eventloo logo on pure white background (no dark container, like login page)
 * - Indigo brand accent bar
 * - Bold event title & spaced uppercase subtitle
 * - Rounded QR code container with camera focus corner brackets in brand color (#4F46E5)
 * - Large crisp QR code
 * - Two-line sentence: "Scan to view results, schedule & points table."
 * - Subtle organic corner waves (top-right and bottom-left)
 * - Nothing more.
 */

import { publicEventAPI } from '../services/api';

// Official Eventloo vector logo on pure white background (no dark container)
const EVENTLOO_WHITE_BG_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 70" width="280" height="70">
  <defs>
    <linearGradient id="looGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="50%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>
    <linearGradient id="looGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="looTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>
  </defs>
  <g transform="translate(6, 4) scale(0.62)">
    <path
      d="M30 50 C15 50 15 28 32 28 C45 28 55 72 68 72 C85 72 85 50 70 50 C55 50 45 28 32 28 C15 28 15 50 30 50 Z"
      fill="none"
      stroke="url(#looGrad1)"
      stroke-width="9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M70 50 C85 50 85 28 68 28 C55 28 45 72 32 72 C15 72 15 50 30 50"
      fill="none"
      stroke="url(#looGrad2)"
      stroke-width="9"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.85"
    />
    <circle cx="32" cy="28" r="4" fill="#06B6D4" />
    <circle cx="68" cy="72" r="4" fill="#8B5CF6" />
  </g>
  <text x="76" y="47" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="36" fill="#0F172A" letter-spacing="-0.5">
    Event<tspan fill="url(#looTextGrad)">loo</tspan>
  </text>
</svg>`;

// Helper to draw rounded rectangle
function roundRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
  let r = radius;
  if (typeof r === 'number') {
    r = { tl: r, tr: r, br: r, bl: r };
  } else {
    r = { tl: 0, tr: r, br: r, bl: r, ...r };
  }
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Helper to load an image from SVG string or URL
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generate a high-resolution PNG Blob of the Event QR Poster Card
 * Clean, minimal, and professional design matching the reference:
 * - Eventloo logo on pure white background
 * - Event Title & Subtitle
 * - Rounded QR code container with corner brackets in Eventloo brand color (#4F46E5)
 * - "Scan to view results, schedule & points table."
 * - Nothing more.
 */
export async function generateEventQrPosterBlob({ event, portalData, publicUrl, eventId }) {
  const width = 750;
  const height = 940;
  const scale = 2; // Retina 2x rendering (1500 x 1880 px output)

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Pure White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle Organic Corner Waves (Top-Right and Bottom-Left)
  ctx.save();
  const gradTR = ctx.createLinearGradient(480, 0, 750, 240);
  gradTR.addColorStop(0, 'rgba(79, 70, 229, 0.04)');
  gradTR.addColorStop(1, 'rgba(6, 182, 212, 0.08)');
  ctx.fillStyle = gradTR;
  ctx.beginPath();
  ctx.moveTo(480, 0);
  ctx.bezierCurveTo(540, 90, 620, 150, 750, 170);
  ctx.lineTo(750, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  const gradBL = ctx.createLinearGradient(0, 750, 260, 940);
  gradBL.addColorStop(0, 'rgba(6, 182, 212, 0.07)');
  gradBL.addColorStop(1, 'rgba(79, 70, 229, 0.04)');
  ctx.fillStyle = gradBL;
  ctx.beginPath();
  ctx.moveTo(0, 750);
  ctx.bezierCurveTo(70, 780, 160, 840, 180, 940);
  ctx.lineTo(0, 940);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // =========================================================================
  // 1. TOP HEADER: Official Eventloo Logo on White Background (No black box)
  // =========================================================================
  const logoSvgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(EVENTLOO_WHITE_BG_LOGO_SVG)}`;
  const logoImg = await loadImage(logoSvgDataUrl);

  const logoW = 210;
  const logoH = 52.5;
  const logoX = (width - logoW) / 2;
  const logoY = 66;

  if (logoImg) {
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  }

  // Small Accent Bar Under Logo (in Eventloo Indigo #4F46E5)
  const lineY = logoY + logoH + 20;
  const lineW = 36;
  const lineH = 3.5;
  const lineX = (width - lineW) / 2;

  const lineGrad = ctx.createLinearGradient(lineX, lineY, lineX + lineW, lineY);
  lineGrad.addColorStop(0, '#2563EB');
  lineGrad.addColorStop(1, '#4F46E5');
  ctx.fillStyle = lineGrad;
  roundRect(ctx, lineX, lineY, lineW, lineH, 2, true, false);

  // =========================================================================
  // 2. EVENT TITLE & SUBTITLE
  // =========================================================================
  const rawTitle = (event?.title || portalData?.event?.title || 'Gravitas').trim();
  const eventTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const titleY = lineY + 54;
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 44px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Scale down title if very long
  if (ctx.measureText(eventTitle).width > width - 120) {
    ctx.font = '800 32px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  ctx.fillText(eventTitle, width / 2, titleY);

  // Subtitle: e.g. CAMPUS FESTIVAL or venue in spaced uppercase
  const subY = titleY + 34;
  const rawSubtitle = (event?.venue || portalData?.event?.venue || 'CAMPUS FESTIVAL').toUpperCase();
  const spacedSubtitle = rawSubtitle.split('').join(' ');

  ctx.fillStyle = '#475569';
  ctx.font = '700 13px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spacedSubtitle, width / 2, subY);

  // =========================================================================
  // 3. QR CODE CONTAINER & ROUNDED CAMERA FOCUS BRACKETS
  // =========================================================================
  const qrBoxSize = 430;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = subY + 44;
  const qrBoxR = 28;

  // Soft Card Container
  ctx.save();
  ctx.shadowColor = 'rgba(79, 70, 229, 0.06)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrBoxR, true, false);
  ctx.restore();

  // Subtle Border
  ctx.strokeStyle = 'rgba(79, 70, 229, 0.16)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrBoxR, false, true);

  // Rounded Corner Camera Focus Brackets (Eventloo Brand Color #4F46E5)
  const cornerLen = 32;
  const cornerPad = 18;
  const cornerRadius = 10;
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Top-Left ⌜
  ctx.beginPath();
  ctx.moveTo(qrBoxX + cornerPad, qrBoxY + cornerPad + cornerLen);
  ctx.arcTo(
    qrBoxX + cornerPad,
    qrBoxY + cornerPad,
    qrBoxX + cornerPad + cornerLen,
    qrBoxY + cornerPad,
    cornerRadius
  );
  ctx.lineTo(qrBoxX + cornerPad + cornerLen, qrBoxY + cornerPad);
  ctx.stroke();

  // Top-Right ⌝
  ctx.beginPath();
  ctx.moveTo(qrBoxX + qrBoxSize - cornerPad - cornerLen, qrBoxY + cornerPad);
  ctx.arcTo(
    qrBoxX + qrBoxSize - cornerPad,
    qrBoxY + cornerPad,
    qrBoxX + qrBoxSize - cornerPad,
    qrBoxY + cornerPad + cornerLen,
    cornerRadius
  );
  ctx.lineTo(qrBoxX + qrBoxSize - cornerPad, qrBoxY + cornerPad + cornerLen);
  ctx.stroke();

  // Bottom-Left ⌞
  ctx.beginPath();
  ctx.moveTo(qrBoxX + cornerPad, qrBoxY + qrBoxSize - cornerPad - cornerLen);
  ctx.arcTo(
    qrBoxX + cornerPad,
    qrBoxY + qrBoxSize - cornerPad,
    qrBoxX + cornerPad + cornerLen,
    qrBoxY + qrBoxSize - cornerPad,
    cornerRadius
  );
  ctx.lineTo(qrBoxX + cornerPad + cornerLen, qrBoxY + qrBoxSize - cornerPad);
  ctx.stroke();

  // Bottom-Right ⌟
  ctx.beginPath();
  ctx.moveTo(qrBoxX + qrBoxSize - cornerPad - cornerLen, qrBoxY + qrBoxSize - cornerPad);
  ctx.arcTo(
    qrBoxX + qrBoxSize - cornerPad,
    qrBoxY + qrBoxSize - cornerPad,
    qrBoxX + qrBoxSize - cornerPad,
    qrBoxY + qrBoxSize - cornerPad - cornerLen,
    cornerRadius
  );
  ctx.lineTo(qrBoxX + qrBoxSize - cornerPad, qrBoxY + qrBoxSize - cornerPad - cornerLen);
  ctx.stroke();

  // Render Crisp Inner QR Code
  const qrSvgString = portalData?.qr_code_svg;
  if (qrSvgString) {
    try {
      const svgBlob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);
      const qrImg = await loadImage(blobURL);

      if (qrImg) {
        const qrInnerSize = 345;
        const qrInnerX = qrBoxX + (qrBoxSize - qrInnerSize) / 2;
        const qrInnerY = qrBoxY + (qrBoxSize - qrInnerSize) / 2;

        ctx.drawImage(qrImg, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);
      }
      URLObj.revokeObjectURL(blobURL);
    } catch (err) {
      console.warn('Failed to draw QR SVG to canvas:', err);
    }
  }

  // =========================================================================
  // 4. CLEAN TWO-LINE SENTENCE: "Scan to view results, schedule & points table."
  // =========================================================================
  const textY = qrBoxY + qrBoxSize + 54;
  ctx.fillStyle = '#334155';
  ctx.font = '600 20px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('Scan to view results,', width / 2, textY);
  ctx.fillText('schedule & points table.', width / 2, textY + 28);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Trigger immediate PNG download of the Event QR Poster Card
 */
export async function downloadEventQrPoster({ event, portalData, publicUrl, eventId, filename }) {
  let effectivePortalData = portalData;
  if (!effectivePortalData?.qr_code_svg && eventId) {
    try {
      const res = await publicEventAPI.getPublicPortal(eventId);
      if (res?.data) effectivePortalData = res.data;
    } catch (e) {
      console.warn('Could not fetch portal data for QR SVG:', e);
    }
  }

  const blob = await generateEventQrPosterBlob({
    event,
    portalData: effectivePortalData,
    publicUrl: effectivePortalData?.public_url || publicUrl,
    eventId
  });

  if (!blob) {
    throw new Error('Could not generate QR poster graphic');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanTitle = (event?.title || effectivePortalData?.event?.title || 'Festival').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = filename || `${cleanTitle}_QR_Poster.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
