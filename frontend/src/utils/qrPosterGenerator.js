/**
 * Minimal & Professional Event QR Poster Generator (PNG)
 * Features:
 * - Event logo at the TOP
 * - Bold event title & spaced uppercase subtitle
 * - Rounded QR code container with camera focus corner brackets in brand color (#4F46E5)
 * - Large crisp QR code
 * - Two-line sentence: "Scan to view results, schedule & points table."
 * - Eventloo logo placed at the BOTTOM ("Powered by Eventloo")
 * - Subtle organic corner waves (top-right and bottom-left)
 */

import { publicEventAPI } from '../services/api';
import eventlooColorLogo from '../assets/eventloo-logo-color.png';

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

// Helper to load an image from URL or data URL
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generate a high-resolution PNG Blob of the Event QR Poster Card
 * - Event Logo at the TOP
 * - Event Title & Subtitle
 * - Rounded QR code container with corner brackets
 * - "Scan to view results, schedule & points table."
 * - Eventloo logo at the BOTTOM
 */
export async function generateEventQrPosterBlob({ event, portalData, publicUrl, eventId, eventLogoUrl }) {
  const width = 750;
  const height = 980;
  const scale = 2; // Retina 2x rendering (1500 x 1960 px output)

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
  const gradBL = ctx.createLinearGradient(0, 750, 260, 980);
  gradBL.addColorStop(0, 'rgba(6, 182, 212, 0.07)');
  gradBL.addColorStop(1, 'rgba(79, 70, 229, 0.04)');
  ctx.fillStyle = gradBL;
  ctx.beginPath();
  ctx.moveTo(0, 750);
  ctx.bezierCurveTo(70, 810, 160, 870, 180, 980);
  ctx.lineTo(0, 980);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // =========================================================================
  // 1. TOP HEADER: EVENT LOGO (AT TOP)
  // =========================================================================
  const effectiveEventLogo =
    eventLogoUrl ||
    event?.logo ||
    event?.event_logo ||
    portalData?.event?.logo ||
    portalData?.event?.event_logo;

  let eventLogoImg = null;
  if (effectiveEventLogo) {
    try {
      eventLogoImg = await loadImage(effectiveEventLogo);
    } catch (e) {
      console.warn('Could not load event logo image for QR poster:', e);
    }
  }

  const logoBoxSize = 90;
  const logoBoxX = (width - logoBoxSize) / 2;
  const logoBoxY = 46;

  if (eventLogoImg) {
    // Soft card backing with subtle shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 20, true, false);
    ctx.restore();

    // Subtle border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    roundRect(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 20, false, true);

    // Draw Event Logo clipped to rounded rectangle
    ctx.save();
    roundRect(ctx, logoBoxX + 6, logoBoxY + 6, logoBoxSize - 12, logoBoxSize - 12, 14, false, false);
    ctx.clip();
    ctx.drawImage(eventLogoImg, logoBoxX + 6, logoBoxY + 6, logoBoxSize - 12, logoBoxSize - 12);
    ctx.restore();
  } else {
    // Clean initial emblem if event has no uploaded logo
    const initial = ((event?.title || portalData?.event?.title || 'E').trim().charAt(0) || 'E').toUpperCase();
    ctx.save();
    const emblemGrad = ctx.createLinearGradient(logoBoxX, logoBoxY, logoBoxX + logoBoxSize, logoBoxY + logoBoxSize);
    emblemGrad.addColorStop(0, '#4F46E5');
    emblemGrad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = emblemGrad;
    roundRect(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 20, true, false);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 42px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, width / 2, logoBoxY + logoBoxSize / 2);
    ctx.restore();
  }

  // =========================================================================
  // 2. EVENT TITLE & SUBTITLE
  // =========================================================================
  const rawTitle = (event?.title || portalData?.event?.title || 'Gravitas').trim();
  const eventTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const titleY = logoBoxY + logoBoxSize + 36;
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 38px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Scale down title if long
  if (ctx.measureText(eventTitle).width > width - 120) {
    ctx.font = '800 28px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  ctx.fillText(eventTitle, width / 2, titleY);

  // Subtitle: e.g. CAMPUS FESTIVAL or venue in spaced uppercase
  const subY = titleY + 30;
  const rawSubtitle = (event?.venue || portalData?.event?.venue || 'CAMPUS FESTIVAL').toUpperCase();
  const spacedSubtitle = rawSubtitle.split('').join(' ');

  ctx.fillStyle = '#64748B';
  ctx.font = '700 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spacedSubtitle, width / 2, subY);

  // Small Accent Bar in Eventloo Indigo (#4F46E5)
  const lineY = subY + 16;
  const lineW = 34;
  const lineH = 3.5;
  const lineX = (width - lineW) / 2;
  const lineGrad = ctx.createLinearGradient(lineX, lineY, lineX + lineW, lineY);
  lineGrad.addColorStop(0, '#2563EB');
  lineGrad.addColorStop(1, '#4F46E5');
  ctx.fillStyle = lineGrad;
  roundRect(ctx, lineX, lineY, lineW, lineH, 2, true, false);

  // =========================================================================
  // 3. QR CODE CONTAINER & ROUNDED CAMERA FOCUS BRACKETS
  // =========================================================================
  const qrBoxSize = 410;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = lineY + 28;
  const qrBoxR = 26;

  // Soft Card Container
  ctx.save();
  ctx.shadowColor = 'rgba(79, 70, 229, 0.07)';
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
  const cornerLen = 30;
  const cornerPad = 16;
  const cornerRadius = 10;
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Top-Left ⌜
  ctx.beginPath();
  ctx.moveTo(qrBoxX + cornerPad, qrBoxY + cornerPad + cornerLen);
  ctx.arcTo(qrBoxX + cornerPad, qrBoxY + cornerPad, qrBoxX + cornerPad + cornerLen, qrBoxY + cornerPad, cornerRadius);
  ctx.lineTo(qrBoxX + cornerPad + cornerLen, qrBoxY + cornerPad);
  ctx.stroke();

  // Top-Right ⌝
  ctx.beginPath();
  ctx.moveTo(qrBoxX + qrBoxSize - cornerPad - cornerLen, qrBoxY + cornerPad);
  ctx.arcTo(qrBoxX + qrBoxSize - cornerPad, qrBoxY + cornerPad, qrBoxX + qrBoxSize - cornerPad, qrBoxY + cornerPad + cornerLen, cornerRadius);
  ctx.lineTo(qrBoxX + qrBoxSize - cornerPad, qrBoxY + cornerPad + cornerLen);
  ctx.stroke();

  // Bottom-Left ⌞
  ctx.beginPath();
  ctx.moveTo(qrBoxX + cornerPad, qrBoxY + qrBoxSize - cornerPad - cornerLen);
  ctx.arcTo(qrBoxX + cornerPad, qrBoxY + qrBoxSize - cornerPad, qrBoxX + cornerPad + cornerLen, qrBoxY + qrBoxSize - cornerPad, cornerRadius);
  ctx.lineTo(qrBoxX + cornerPad + cornerLen, qrBoxY + qrBoxSize - cornerPad);
  ctx.stroke();

  // Bottom-Right ⌟
  ctx.beginPath();
  ctx.moveTo(qrBoxX + qrBoxSize - cornerPad - cornerLen, qrBoxY + qrBoxSize - cornerPad);
  ctx.arcTo(qrBoxX + qrBoxSize - cornerPad, qrBoxY + qrBoxSize - cornerPad, qrBoxX + qrBoxSize - cornerPad, qrBoxY + qrBoxSize - cornerPad - cornerLen, cornerRadius);
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
        const qrInnerSize = 330;
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
  const textY = qrBoxY + qrBoxSize + 42;
  ctx.fillStyle = '#334155';
  ctx.font = '600 18px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('Scan to view results,', width / 2, textY);
  ctx.fillText('schedule & points table.', width / 2, textY + 25);

  // =========================================================================
  // 5. BOTTOM FOOTER: EVENTLOO LOGO (PLACED AT DOWN)
  // =========================================================================
  const footerY = 915;
  const eventlooLogoImg = await loadImage(eventlooColorLogo);

  // Subtle separator line
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((width - 240) / 2, footerY - 32);
  ctx.lineTo((width + 240) / 2, footerY - 32);
  ctx.stroke();

  // Draw "POWERED BY" + [Eventloo Logo Icon] + "Eventloo"
  ctx.font = '700 10.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const poweredText = 'POWERED BY';
  const poweredWidth = ctx.measureText(poweredText).width;

  const iconW = 24;
  const iconH = 24;
  ctx.font = '800 20px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const eventTextWidth = ctx.measureText('Event').width;
  const looTextWidth = ctx.measureText('loo').width;

  const spacing = 10;
  const totalFooterWidth = poweredWidth + spacing + iconW + 6 + eventTextWidth + looTextWidth;
  const footerStartX = (width - totalFooterWidth) / 2;

  // 1. "POWERED BY"
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 10.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(poweredText, footerStartX, footerY);

  // 2. Eventloo Icon
  const iconX = footerStartX + poweredWidth + spacing;
  if (eventlooLogoImg) {
    ctx.drawImage(eventlooLogoImg, iconX, footerY - iconH / 2, iconW, iconH);
  }

  // 3. "Eventloo"
  const textX = iconX + iconW + 6;
  ctx.font = '800 20px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('Event', textX, footerY);
  ctx.fillStyle = '#4F46E5';
  ctx.fillText('loo', textX + eventTextWidth, footerY);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Trigger immediate PNG download of the Event QR Poster Card
 */
export async function downloadEventQrPoster({ event, portalData, publicUrl, eventId, eventLogoUrl, filename }) {
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
    eventId,
    eventLogoUrl,
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
