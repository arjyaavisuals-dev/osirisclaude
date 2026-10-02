'use client';

import { useEffect, useState } from 'react';

interface HudOverlayProps {
  /** Current map zoom — drives the lock-on bracket spacing (wide when
      pulled back, tight when zoomed onto a target). */
  zoom: number;
  /** Map centre, for the live LAT/LNG readout and the scrolling bearing tick. */
  centerLat: number;
  centerLng: number;
  activeLayerCount: number;
  totalLayerCount: number;
  backendStatus: 'connecting' | 'connected' | 'error';
  mapProjection: 'globe' | 'mercator';
  mapStyle: 'dark' | 'satellite';
  /** Bumped by the caller (a fly-to, a layer toggle) to trigger one
      lock-reacquire flourish across the reticle and screen corners — the
      HUD visibly reacting to something happening, rather than animating on
      a timer for its own sake. */
  pulseKey: number;
  isMobile?: boolean;
}

/**
 * OSIRIS — Tactical HUD Overlay
 *
 * A heads-up instrument layer over the map: a multi-ring targeting reticle
 * with lock-on brackets and a radar sweep, a layer-load readout, a
 * link-status readout, and a bearing scale — all driven by real state
 * (zoom, pan, active layers, backend health) rather than decorative loops
 * with no meaning behind them. Purely visual: pointer-events are disabled
 * throughout so it never intercepts a click the map or its panels need.
 */
export default function HudOverlay({
  zoom,
  centerLat,
  centerLng,
  activeLayerCount,
  totalLayerCount,
  backendStatus,
  mapProjection,
  mapStyle,
  pulseKey,
  isMobile = false,
}: HudOverlayProps) {
  // Lock-on brackets pull in as you zoom toward a target, widen as you pull
  // back — a "locking on" read rather than a fixed decoration. Clamped so it
  // stays legible at the globe's min zoom and the deepest street-level zoom.
  const bracketHalf = Math.max(26, Math.min(74, 80 - zoom * 4.2));
  const lat = Number.isFinite(centerLat) ? centerLat : 0;
  const lng = Number.isFinite(centerLng) ? centerLng : 0;
  const latStr = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;

  // The bearing scale's lit tick scrolls with longitude — panning the map
  // east/west visibly drives it, like a compass tape.
  const bearingPct = ((lng % 360) + 360) % 360 / 360;
  const litBearingIndex = Math.round(bearingPct * 10);

  // Re-keying an element on pulseKey restarts its CSS animation every time,
  // with no extra state or timers needed — this is what plays the
  // lock-reacquire flourish once per fly-to or layer toggle.
  const [mountedPulse, setMountedPulse] = useState(0);
  useEffect(() => { setMountedPulse(p => p + 1); }, [pulseKey]);

  const layerFraction = totalLayerCount > 0 ? activeLayerCount / totalLayerCount : 0;
  const BARGRAPH_SEGMENTS = 6;
  const litSegments = Math.max(activeLayerCount > 0 ? 1 : 0, Math.round(layerFraction * BARGRAPH_SEGMENTS));

  const statusColor = backendStatus === 'connected'
    ? 'var(--alert-green)'
    : backendStatus === 'connecting'
      ? 'var(--gold-primary)'
      : 'var(--alert-red)';
  const statusLabel = backendStatus === 'connected' ? 'LIVE' : backendStatus === 'connecting' ? 'SYNC' : 'LOST';
  const SIGNAL_BARS = 4;
  const litSignalBars = backendStatus === 'error' ? 1 : backendStatus === 'connecting' ? 2 : 4;

  return (
    <div className="absolute inset-0 pointer-events-none z-[140] overflow-hidden" aria-hidden="true">
      {/* ── CENTER RETICLE — present at every breakpoint ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="220" height="220" viewBox="0 0 220 220" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible">
          <defs>
            <radialGradient id="hud-sweep-fade" cx="0" cy="0" r="1">
              <stop offset="0%" stopColor="var(--cyan-primary)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--cyan-primary)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer sensor ring — slow clockwise, with 8 cardinal ticks like a sensor array */}
          <g className="hud-ring-cw" style={{ transformOrigin: '110px 110px' }}>
            <circle cx="110" cy="110" r="92" fill="none" stroke="var(--cyan-primary)" strokeWidth="1" opacity="0.18" />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * 45 * Math.PI) / 180;
              const x1 = 110 + Math.cos(a) * 86, y1 = 110 + Math.sin(a) * 86;
              const x2 = 110 + Math.cos(a) * 96, y2 = 110 + Math.sin(a) * 96;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--cyan-primary)" strokeWidth="1" opacity="0.4" />;
            })}
          </g>

          {/* Mid ring — dashed, counter-rotating, with three diamond markers */}
          <g className="hud-ring-ccw" style={{ transformOrigin: '110px 110px' }}>
            <circle cx="110" cy="110" r="68" fill="none" stroke="var(--gold-primary)" strokeWidth="1" strokeDasharray="1 7" opacity="0.5" />
            {[0, 130, 250].map((deg, i) => {
              const a = (deg * Math.PI) / 180;
              const x = 110 + Math.cos(a) * 68, y = 110 + Math.sin(a) * 68;
              return <rect key={i} x={x - 2} y={y - 2} width="4" height="4" fill="var(--gold-primary)" opacity="0.8" transform={`rotate(45 ${x} ${y})`} />;
            })}
          </g>

          {/* Radar sweep — thin radial wedge, continuous rotation */}
          <g className="hud-sweep" style={{ transformOrigin: '110px 110px' }}>
            <path d="M 110 110 L 110 22 A 88 88 0 0 1 172 48 Z" fill="url(#hud-sweep-fade)" opacity="0.35" />
          </g>

          {/* Lock-on brackets — four L-shaped corners, spacing breathes with zoom,
              flare outward and snap back once per pulseKey ("re-acquiring lock") */}
          <g key={mountedPulse} className="hud-lock-flare" style={{ transformOrigin: '110px 110px' }}>
            {[
              { x: 110 - bracketHalf, y: 110 - bracketHalf, dx: 1, dy: 1 },
              { x: 110 + bracketHalf, y: 110 - bracketHalf, dx: -1, dy: 1 },
              { x: 110 - bracketHalf, y: 110 + bracketHalf, dx: 1, dy: -1 },
              { x: 110 + bracketHalf, y: 110 + bracketHalf, dx: -1, dy: -1 },
            ].map((c, i) => (
              <path
                key={i}
                d={`M ${c.x + c.dx * 16} ${c.y} L ${c.x} ${c.y} L ${c.x} ${c.y + c.dy * 16}`}
                fill="none"
                stroke="var(--gold-primary)"
                strokeWidth="1.75"
                strokeLinecap="square"
                style={{ transition: 'd 0.5s cubic-bezier(0.2,0.7,0.3,1)' }}
              />
            ))}
          </g>

          {/* Core — hexagon + breathing dot */}
          <polygon
            points="110,101 117.8,105.5 117.8,114.5 110,119 102.2,114.5 102.2,105.5"
            fill="none" stroke="var(--gold-primary)" strokeWidth="1" opacity="0.6"
          />
          <circle cx="110" cy="110" r="2.2" fill="var(--gold-primary)" className="hud-core-breathe" style={{ transformOrigin: '110px 110px' }} />

          {/* Center crosshair ticks */}
          <line x1="110" y1="80" x2="110" y2="88" stroke="var(--gold-primary)" strokeWidth="1" opacity="0.45" />
          <line x1="110" y1="132" x2="110" y2="140" stroke="var(--gold-primary)" strokeWidth="1" opacity="0.45" />
        </svg>

        {/* LAT / LNG data plates flanking the reticle — hidden on mobile for clarity */}
        {!isMobile && (
          <>
            <div
              className="absolute top-1/2 -translate-y-1/2 hud-plate hud-plate-r transition-[right] duration-500 ease-out"
              style={{ right: `calc(50% + ${bracketHalf + 46}px)`, width: 92 }}
            >
              <div className="text-[8px] font-mono tracking-[0.25em] text-[var(--text-muted)] opacity-60">LAT</div>
              <div className="text-[10px] font-mono font-bold tabular-nums text-[var(--gold-primary)] hud-flicker">{latStr}</div>
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 hud-plate hud-plate-l transition-[left] duration-500 ease-out"
              style={{ left: `calc(50% + ${bracketHalf + 46}px)`, width: 92 }}
            >
              <div className="text-[8px] font-mono tracking-[0.25em] text-[var(--text-muted)] opacity-60">LNG</div>
              <div className="text-[10px] font-mono font-bold tabular-nums text-[var(--cyan-primary)] hud-flicker">{lngStr}</div>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop-only ornamental clusters ── */}
      {!isMobile && (
        <>
          {/* Top-left: layer load — angled armor-plate segments */}
          <div className="absolute top-14 left-16 flex flex-col gap-1.5">
            <div className="flex gap-[3px]">
              {Array.from({ length: BARGRAPH_SEGMENTS }).map((_, i) => (
                <div
                  key={i}
                  className="w-[10px] h-[4px] transition-all duration-500"
                  style={{
                    clipPath: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)',
                    background: i < litSegments ? 'var(--gold-primary)' : 'var(--border-secondary)',
                    boxShadow: i < litSegments ? '0 0 5px var(--gold-primary)' : 'none',
                    opacity: i < litSegments ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-50">
              LAYERS {activeLayerCount}/{totalLayerCount}
            </span>
          </div>

          {/* Top-right: link status — rising signal bars */}
          <div className="absolute top-14 right-16 flex flex-col items-end gap-1.5">
            <div className="flex items-end gap-[3px] h-[10px]">
              {Array.from({ length: SIGNAL_BARS }).map((_, i) => (
                <div
                  key={i}
                  className="w-[4px] transition-all duration-500"
                  style={{
                    height: `${4 + i * 2}px`,
                    background: i < litSignalBars ? statusColor : 'var(--border-secondary)',
                    boxShadow: i < litSignalBars ? `0 0 4px ${statusColor}` : 'none',
                    opacity: i < litSignalBars ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] font-mono tracking-[0.2em] opacity-70" style={{ color: statusColor }}>
              LINK {statusLabel}
            </span>
          </div>

          {/* Side bearing scale — lit tick scrolls with longitude; a small
              triangular pointer marks the active position */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-[7px]">
            {Array.from({ length: 11 }).map((_, i) => {
              const lit = i === litBearingIndex;
              return (
                <div key={i} className="relative h-[1px] transition-all duration-700 ease-out" style={{
                  width: lit ? 18 : 8,
                  background: lit ? 'var(--cyan-primary)' : 'var(--border-secondary)',
                  boxShadow: lit ? '0 0 5px var(--cyan-primary)' : 'none',
                }}>
                  {lit && (
                    <div className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
                      style={{ borderTop: '3px solid transparent', borderBottom: '3px solid transparent', borderLeft: '4px solid var(--cyan-primary)' }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-[7px] items-end">
            {Array.from({ length: 11 }).map((_, i) => {
              const lit = i === litBearingIndex;
              return (
                <div key={i} className="relative h-[1px] transition-all duration-700 ease-out" style={{
                  width: lit ? 18 : 8,
                  background: lit ? 'var(--cyan-primary)' : 'var(--border-secondary)',
                  boxShadow: lit ? '0 0 5px var(--cyan-primary)' : 'none',
                }}>
                  {lit && (
                    <div className="absolute -left-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
                      style={{ borderTop: '3px solid transparent', borderBottom: '3px solid transparent', borderRight: '4px solid var(--cyan-primary)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom-left: projection + view mode */}
          <div className="absolute bottom-16 left-16 flex flex-col gap-0.5 hud-plate hud-plate-bl">
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              PROJ <span className="text-[var(--gold-primary)] opacity-100">{mapProjection === 'globe' ? '3D' : '2D'}</span>
            </span>
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              VIEW <span className="text-[var(--gold-primary)] opacity-100">{mapStyle === 'dark' ? 'MAP' : 'SAT'}</span>
            </span>
          </div>

          {/* Bottom-right: zoom readout */}
          <div className="absolute bottom-16 right-16 flex flex-col items-end gap-0.5 hud-plate hud-plate-br">
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              ZOOM <span className="text-[var(--cyan-primary)] opacity-100 tabular-nums">{zoom.toFixed(1)}</span>
            </span>
          </div>
        </>
      )}

      {/* ── Armor-plate corner brackets — flash on pulseKey, distinct from the
          static gradient corners already in the page ── */}
      {[
        { pos: 'top-3 left-3', rot: 0 },
        { pos: 'top-3 right-3', rot: 90 },
        { pos: 'bottom-3 right-3', rot: 180 },
        { pos: 'bottom-3 left-3', rot: 270 },
      ].map((c, i) => (
        <svg
          key={`${i}-${mountedPulse}`}
          width="30" height="30" viewBox="0 0 30 30"
          className={`absolute ${c.pos} hud-corner-flash`}
          style={{ transform: `rotate(${c.rot}deg)` }}
        >
          <path d="M 2 14 L 2 4 A 2 2 0 0 1 4 2 L 14 2" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" />
          <path d="M 2 19 L 2 24" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" opacity="0.5" />
          <path d="M 19 2 L 24 2" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" opacity="0.5" />
        </svg>
      ))}

      <style jsx>{`
        .hud-plate {
          padding: 2px 6px;
          border-left: 1px solid rgba(212, 175, 55, 0.25);
        }
        .hud-plate-r { text-align: right; border-left: none; border-right: 1px solid rgba(212, 175, 55, 0.25); padding-right: 8px; }
        .hud-plate-l { padding-left: 8px; }
        .hud-plate-bl { border-left: 1px solid rgba(212, 175, 55, 0.3); padding-left: 8px; }
        .hud-plate-br { border-right: 1px solid rgba(212, 175, 55, 0.3); padding-right: 8px; text-align: right; }

        @keyframes hud-ring-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hud-ring-cw { animation: hud-ring-cw 50s linear infinite; }

        @keyframes hud-ring-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .hud-ring-ccw { animation: hud-ring-ccw 34s linear infinite; }

        @keyframes hud-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hud-sweep { animation: hud-sweep 4s linear infinite; }

        @keyframes hud-core-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.5; }
        }
        .hud-core-breathe { animation: hud-core-breathe 2.4s ease-in-out infinite; }

        @keyframes hud-lock-flare {
          0% { transform: scale(1.35); opacity: 0.3; }
          40% { transform: scale(0.94); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .hud-lock-flare { animation: hud-lock-flare 0.6s cubic-bezier(0.2, 0.7, 0.3, 1) both; }

        @keyframes hud-corner-flash {
          0% { opacity: 0.35; filter: drop-shadow(0 0 0px var(--cyan-primary)); }
          30% { opacity: 1; filter: drop-shadow(0 0 6px var(--cyan-primary)); }
          100% { opacity: 0.35; filter: drop-shadow(0 0 0px var(--cyan-primary)); }
        }
        .hud-corner-flash { animation: hud-corner-flash 1.4s ease-out both; }

        @keyframes hud-flicker {
          0%, 92%, 100% { opacity: 1; }
          94% { opacity: 0.55; }
          96% { opacity: 1; }
        }
        .hud-flicker { animation: hud-flicker 6s linear infinite; }
      `}</style>
    </div>
  );
}
