/**
 * Solar 24h Analog Clock Card
 * Home Assistant Lovelace Custom Card
 *
 * Installation:
 *   1. Copy to /config/www/solar-24h-clock-card.js
 *   2. Add resource in Lovelace: /local/solar-24h-clock-card.js (type: module)
 *   3. Use in dashboard:
 *
 *   type: custom:solar-24h-clock-card
 *   title: Solar Clock          # optional
 *   sun_entity: sun.sun         # optional, default: sun.sun
 *   size: 300                   # optional, canvas size in px (default: 300)
 *
 * Data from sun.sun attributes:
 *   next_noon       → solar noon time (rotates dial so noon is at top)
 *   next_rising     → sunrise marker
 *   next_setting    → sunset marker
 *   azimuth         → sun position indicator on dial
 *   elevation       → shown as text + arc
 */

class Solar24hClockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._animFrame = null;
    this._lastNoon = null;
    this._lastRising = null;
    this._lastSetting = null;
    this._solarNoonOffsetHours = 0; // hours from midnight to solar noon
    this._sunriseHours = 6;
    this._sunsetHours = 18;
    this._azimuth = 180;
    this._elevation = 0;
    this._built = false;
  }

  static getConfigElement() {
    return document.createElement('solar-24h-clock-card-editor');
  }

  static getStubConfig() {
    return { sun_entity: 'sun.sun' };
  }

  setConfig(config) {
    this._config = {
      sun_entity: 'sun.sun',
      title: '',
      size: 300,
      ...config,
    };
    if (!this._built) {
      this._build();
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._updateFromHass();
  }

  _build() {
    this._built = true;
    const size = this._config.size || 300;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--primary-font-family, sans-serif);
        }
        ha-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: var(--card-background-color, #1c1c1e);
        }
        .card-title {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--secondary-text-color, #888);
          align-self: flex-start;
        }
        canvas {
          display: block;
          max-width: 100%;
        }
        .sun-info {
          display: flex;
          gap: 24px;
          align-items: center;
          font-size: 12px;
          color: var(--secondary-text-color, #888);
          letter-spacing: 0.04em;
        }
        .sun-info .item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .sun-info .label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.6;
        }
        .sun-info .value {
          font-size: 13px;
          font-weight: 500;
          color: var(--primary-text-color, #e0e0e0);
          font-family: var(--code-font-family, monospace);
        }
        .elevation-bar-wrap {
          width: 100%;
          max-width: ${size}px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .elevation-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--secondary-text-color, #888);
          opacity: 0.6;
        }
        .elevation-bar-bg {
          height: 4px;
          border-radius: 2px;
          background: var(--divider-color, rgba(255,255,255,0.08));
          position: relative;
          overflow: visible;
        }
        .elevation-bar-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(to right, #f59e0b, #fde68a);
          transition: width 0.5s ease;
          min-width: 4px;
        }
        .elevation-bar-neg {
          position: absolute;
          top: 0; right: 0;
          height: 100%;
          border-radius: 2px;
          background: var(--divider-color, rgba(255,255,255,0.08));
        }
      </style>
      <ha-card>
        ${this._config.title ? `<div class="card-title">${this._config.title}</div>` : ''}
        <canvas id="clk" width="${size}" height="${size}"></canvas>
        <div class="sun-info">
          <div class="item">
            <span class="label">Aufgang</span>
            <span class="value" id="sunrise-val">--:--</span>
          </div>
          <div class="item">
            <span class="label">Elevation</span>
            <span class="value" id="elev-val">--°</span>
          </div>
          <div class="item">
            <span class="label">Azimut</span>
            <span class="value" id="azim-val">---°</span>
          </div>
          <div class="item">
            <span class="label">Untergang</span>
            <span class="value" id="sunset-val">--:--</span>
          </div>
        </div>
        <div class="elevation-bar-wrap">
          <span class="elevation-label">Sonnenhöhe</span>
          <div class="elevation-bar-bg">
            <div class="elevation-bar-fill" id="elev-bar" style="width:0%"></div>
          </div>
        </div>
      </ha-card>
    `;

    this._canvas = this.shadowRoot.getElementById('clk');
    this._ctx = this._canvas.getContext('2d');
    this._startLoop();
  }

  _updateFromHass() {
    if (!this._hass) return;
    const entity = this._hass.states[this._config.sun_entity || 'sun.sun'];
    if (!entity) return;

    const attr = entity.attributes;

    // Solar noon: use next_noon attribute
    // next_noon is ISO string; we parse time-of-day in local time
    const noonStr = attr.next_noon;
    if (noonStr && noonStr !== this._lastNoon) {
      this._lastNoon = noonStr;
      const noonDate = new Date(noonStr);
      // Convert to local hours (fractional)
      this._solarNoonOffsetHours = noonDate.getHours() + noonDate.getMinutes() / 60 + noonDate.getSeconds() / 3600;
    }

    // Sunrise
    const risingStr = attr.next_rising;
    if (risingStr && risingStr !== this._lastRising) {
      this._lastRising = risingStr;
      const r = new Date(risingStr);
      this._sunriseHours = r.getHours() + r.getMinutes() / 60 + r.getSeconds() / 3600;
      this.shadowRoot.getElementById('sunrise-val').textContent =
        String(r.getHours()).padStart(2,'0') + ':' + String(r.getMinutes()).padStart(2,'0');
    }

    // Sunset
    const settingStr = attr.next_setting;
    if (settingStr && settingStr !== this._lastSetting) {
      this._lastSetting = settingStr;
      const s = new Date(settingStr);
      this._sunsetHours = s.getHours() + s.getMinutes() / 60 + s.getSeconds() / 3600;
      this.shadowRoot.getElementById('sunset-val').textContent =
        String(s.getHours()).padStart(2,'0') + ':' + String(s.getMinutes()).padStart(2,'0');
    }

    // Azimuth & elevation (live)
    if (attr.azimuth !== undefined) {
      this._azimuth = attr.azimuth;
      this.shadowRoot.getElementById('azim-val').textContent = Math.round(attr.azimuth) + '°';
    }
    if (attr.elevation !== undefined) {
      this._elevation = attr.elevation;
      this.shadowRoot.getElementById('elev-val').textContent = attr.elevation.toFixed(1) + '°';
      // Bar: elevation range roughly -18° (astronomical twilight) to ~70° (max summer)
      const pct = Math.max(0, Math.min(100, (attr.elevation / 70) * 100));
      this.shadowRoot.getElementById('elev-bar').style.width = pct + '%';
    }
  }

  _startLoop() {
    const loop = () => {
      this._draw();
      this._animFrame = requestAnimationFrame(loop);
    };
    this._animFrame = requestAnimationFrame(loop);
  }

  disconnectedCallback() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  _draw() {
    const canvas = this._canvas;
    const ctx = this._ctx;
    if (!canvas || !ctx) return;

    const size = canvas.width;
    const CX = size / 2;
    const CY = size / 2;
    const R = size * 0.46;

    // Detect dark/light mode via HA card background
    const bgColor = getComputedStyle(this).getPropertyValue('--card-background-color').trim() || '#1c1c1e';
    const isDark = this._isDarkColor(bgColor);

    const col = {
      face:      isDark ? '#1a1a1c' : '#f6f4ee',
      rimOuter:  isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
      rimInner:  isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)',
      tickMaj:   isDark ? '#d4d2c8' : '#1e1e1c',
      tickMid:   isDark ? '#888780' : '#5f5e5a',
      tickMin:   isDark ? '#444441' : '#cccac0',
      textMaj:   isDark ? '#d4d2c8' : '#1e1e1c',
      textMid:   isDark ? '#666460' : '#888780',
      nightArc:  isDark ? 'rgba(59,139,212,0.13)' : 'rgba(59,139,212,0.10)',
      dayArc:    isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)',
      sunRise:   '#f59e0b',
      sunSet:    '#f97316',
      sunDot:    '#fde68a',
      hrHand:    isDark ? '#e0ddd4' : '#1e1e1c',
      azimLine:  isDark ? 'rgba(253,230,138,0.55)' : 'rgba(180,120,0,0.45)',
      noonLine:  isDark ? 'rgba(253,230,138,0.25)' : 'rgba(180,120,0,0.15)',
    };

    ctx.clearRect(0, 0, size, size);

    // Solar noon offset in radians (noon goes to top = -π/2)
    // Dial rotates so that solarNoonOffsetHours aligns with top
    const noonH = this._solarNoonOffsetHours; // e.g. 13.25 for 13:15
    // The angle that "top" represents on a normal 24h clock
    // Top = -π/2, each hour = 2π/24
    // We want noonH to be at top, so we rotate dial by -(noonH/24 * 2π - π/2) ... wait:
    // Normal: hour h → angle = (h/24)*2π - π/2
    // We want noonH → -π/2 (top)
    // So we add offset: dialOffset = -π/2 - (noonH/24)*2π - (-π/2) = -(noonH/24)*2π
    // Net: angle for hour h = (h/24)*2π - π/2 + dialOffset
    //                       = (h/24)*2π - π/2 - (noonH/24)*2π
    //                       = ((h - noonH)/24)*2π - π/2
    const dialOffset = -(noonH / 24) * Math.PI * 2;

    const hourToAngle = (h) => (h / 24) * Math.PI * 2 - Math.PI / 2 + dialOffset;

    // ── Face ──────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(CX, CY, R + 6, 0, Math.PI * 2);
    ctx.fillStyle = col.rimOuter;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, R + 3, 0, Math.PI * 2);
    ctx.fillStyle = col.rimInner;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = col.face;
    ctx.fill();

    // ── Night arc (below horizon) ─────────────────────────────────────────
    const riseAng = hourToAngle(this._sunriseHours);
    const setAng  = hourToAngle(this._sunsetHours);

    // Night = from sunset clockwise to sunrise (going through midnight)
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R - 1, setAng, riseAng + Math.PI * 2, false);
    ctx.closePath();
    ctx.fillStyle = col.nightArc;
    ctx.fill();

    // Day arc
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R - 1, riseAng, setAng, false);
    ctx.closePath();
    ctx.fillStyle = col.dayArc;
    ctx.fill();

    // ── Solar noon radial guide line (faint) ─────────────────────────────
    const noonAng = -Math.PI / 2; // always at top
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(noonAng) * (R - 2), CY + Math.sin(noonAng) * (R - 2));
    ctx.strokeStyle = col.noonLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Ticks & hour labels ───────────────────────────────────────────────
    for (let h = 0; h < 24; h++) {
      const ang = hourToAngle(h);
      const isMaj = h % 6 === 0;
      const isMid = h % 3 === 0;
      const tickLen = isMaj ? R * 0.13 : isMid ? R * 0.09 : R * 0.04;
      const r0 = R - tickLen;
      const r1 = R - 1;

      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(ang) * r0, CY + Math.sin(ang) * r0);
      ctx.lineTo(CX + Math.cos(ang) * r1, CY + Math.sin(ang) * r1);
      ctx.strokeStyle = isMaj ? col.tickMaj : isMid ? col.tickMid : col.tickMin;
      ctx.lineWidth = isMaj ? 1.5 : isMid ? 1 : 0.5;
      ctx.stroke();

      if (isMid) {
        const lr = R * 0.78;
        ctx.fillStyle = isMaj ? col.textMaj : col.textMid;
        ctx.font = `${isMaj ? '500' : '400'} ${isMaj ? Math.round(size*0.042) : Math.round(size*0.036)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(h).padStart(2, '0'), CX + Math.cos(ang) * lr, CY + Math.sin(ang) * lr);
      }
    }

    // Minute ticks
    for (let m = 0; m < 60; m++) {
      if (m % (60 / 24) < 1) continue;
      const ang = hourToAngle(m / 60 * 24);
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(ang) * (R - R * 0.025), CY + Math.sin(ang) * (R - R * 0.025));
      ctx.lineTo(CX + Math.cos(ang) * (R - 1), CY + Math.sin(ang) * (R - 1));
      ctx.strokeStyle = col.tickMin;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Sunrise / Sunset markers ──────────────────────────────────────────
    this._drawSunMarker(ctx, CX, CY, R, riseAng, col.sunRise, '↑');
    this._drawSunMarker(ctx, CX, CY, R, setAng,  col.sunSet,  '↓');

    // ── Azimuth indicator ─────────────────────────────────────────────────
    // Azimuth: 0=N, 90=E, 180=S, 270=W
    // Map to clock angle: azimuth 180 (south) = solar noon = top of dial
    // So: azimuthAngle = hourToAngle(noonH + (azimuth - 180) / 15)
    // (360°/day = 15°/hour)
    const azHour = noonH + (this._azimuth - 180) / 15;
    const azAng = hourToAngle(azHour);
    const azR = R * 0.88;

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(azAng) * azR, CY + Math.sin(azAng) * azR);
    ctx.strokeStyle = col.azimLine;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Sun dot on azimuth position (only if elevation > -6°)
    if (this._elevation > -6) {
      const sunR = R * 0.70 + (this._elevation / 90) * R * 0.18;
      const sunX = CX + Math.cos(azAng) * sunR;
      const sunY = CY + Math.sin(azAng) * sunR;
      const sunRadius = Math.max(3, R * 0.038);

      // Glow
      const grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 3);
      grad.addColorStop(0, 'rgba(253,230,138,0.4)');
      grad.addColorStop(1, 'rgba(253,230,138,0)');
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fillStyle = col.sunDot;
      ctx.fill();
    }

    // ── Hands ─────────────────────────────────────────────────────────────
    const now = new Date();

    // Hour hand only (24h) — smooth, includes minutes
    const hrAng = hourToAngle(now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600);
    this._drawHand(ctx, CX, CY, hrAng, R * 0.54, R * 0.10, 2.5, col.hrHand);

    // Center cap (small, neutral — no red dot without second hand)
    ctx.beginPath();
    ctx.arc(CX, CY, R * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = col.hrHand;
    ctx.fill();

    // ── Digital time in dial centre ───────────────────────────────────────
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = hh + ':' + mm;

    // Pill background
    const fontSize = Math.round(size * 0.075);
    ctx.font = `500 ${fontSize}px var(--primary-font-family, sans-serif)`;
    const tw = ctx.measureText(timeStr).width;
    const ph = fontSize * 1.1;
    const pw = tw + fontSize * 0.9;
    const px = CX - pw / 2;
    const py = CY + R * 0.22;

    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph / 2);
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.70)';
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = isDark ? '#d4d2c8' : '#1e1e1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, CX, py + ph / 2);

    // ── Noon symbol at top ────────────────────────────────────────────────
    const symY = CY - R * 0.90;
    ctx.font = `${Math.round(size * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? 'rgba(253,230,138,0.7)' : 'rgba(180,120,0,0.7)';
    ctx.fillText('☀', CX, symY);
  }

  _drawSunMarker(ctx, CX, CY, R, ang, color, arrow) {
    const mr = R - 1;
    const mx = CX + Math.cos(ang) * mr;
    const my = CY + Math.sin(ang) * mr;

    // Outer dot
    ctx.beginPath();
    ctx.arc(mx, my, R * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Tick line inward
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(CX + Math.cos(ang) * (R * 0.80), CY + Math.sin(ang) * (R * 0.80));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _drawHand(ctx, CX, CY, ang, len, tailLen, width, color) {
    ctx.beginPath();
    ctx.moveTo(CX - Math.cos(ang) * tailLen, CY - Math.sin(ang) * tailLen);
    ctx.lineTo(CX + Math.cos(ang) * len, CY + Math.sin(ang) * len);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  _isDarkColor(colorStr) {
    // Simple heuristic: try to parse and check luminance
    try {
      const tmp = document.createElement('div');
      tmp.style.color = colorStr;
      document.body.appendChild(tmp);
      const computed = getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
      const match = computed.match(/\d+/g);
      if (match && match.length >= 3) {
        const [r, g, b] = match.map(Number);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return lum < 0.5;
      }
    } catch(e) {}
    return true; // default dark
  }
}

customElements.define('solar-24h-clock-card', Solar24hClockCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'solar-24h-clock-card',
  name: 'Solar 24h Clock',
  description: 'Analoge 24-Stunden-Uhr mit Solar-Noon als Zenit, Tag/Nacht-Bogen, Sonnenauf-/-untergang und Azimut-Anzeige.',
  preview: false,
});
