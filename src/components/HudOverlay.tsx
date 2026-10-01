'use client';

import { useEffect, useState } from 'react';

interface HudOverlayProps {
  /** Current map zoom — drives the reticle's bracket width (wide when
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
  /** Bumped by the caller (a fly-to, a layer toggle) to trigger one ping
      sweep across the reticle — the HUD visibly reacting to something
      happening, rather than animating on a timer for its own sake. */
  pulseKey: number;
  isMobile?: boolean;
}

/**
 * OSIRIS — Tactical HUD Overlay
 *
 * A flight-HUD-style instrument layer over the map: a center targeting
 * reticle, a layer-load bargraph, a link-status readout, and a bearing
 * scale — all driven by real state (zoom, pan, active layers, backend
 * health) rather than decorative loops. Purely visual: pointer-events are
 * disabled throughout so it never intercepts a click the map or its panels
 * need.
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
  // Reticle brackets pull in as you zoom toward a target, widen as you pull
  // back — a "locking on" read rather than a fixed decoration. Clamped so it
  // stays legible at the globe's min zoom and the deepest street-level zoom.
  const bracketGap = Math.max(34, Math.min(120, 128 - zoom * 6.5));
  const lat = Number.isFinite(centerLat) ? centerLat : 0;
  const lng = Number.isFinite(centerLng) ? centerLng : 0;
  const latStr = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;

  // The bearing scale's lit tick scrolls with longitude — panning the map
  // east/west visibly drives it, like a compass tape.
  const bearingPct = ((lng % 360) + 360) % 360 / 360;

  // A tiny ping sweep plays once per pulseKey change. Re-keying the element
  // on the value itself restarts the CSS animation every time, with no extra
  // state or timers needed.
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

  return (
    <div className="absolute inset-0 pointer-events-none z-[140] overflow-hidden" aria-hidden="true">
      {/* ── CENTER RETICLE — present at every breakpoint ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {/* Slow outer scan ring — ambient, not tied to any single event */}
        <svg
          width="150" height="150" viewBox="0 0 150 150"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.22] hud-scan-rotate"
        >
          <circle cx="75" cy="75" r="68" fill="none" stroke="var(--cyan-primary)" strokeWidth="1" strokeDasharray="2 10" />
        </svg>

        {/* Ping sweep — plays once per pulseKey change: the HUD reacting to a nav/layer event */}
        <svg
          key={mountedPulse}
          width="150" height="150" viewBox="0 0 150 150"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hud-ping"
        >
          <circle cx="75" cy="75" r="20" fill="none" stroke="var(--gold-primary)" strokeWidth="1.5" />
        </svg>

        {/* Static semi-arcs, like a lock-on bracket pair */}
        <svg width="56" height="56" viewBox="0 0 56 56" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70">
          <path d="M 4 20 A 24 24 0 0 1 20 4" fill="none" stroke="var(--gold-primary)" strokeWidth="1.5" />
          <path d="M 36 52 A 24 24 0 0 1 52 36" fill="none" stroke="var(--gold-primary)" strokeWidth="1.5" />
        </svg>

        {/* Horizontal guide lines — gap breathes with zoom */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[1px] bg-[var(--gold-primary)]/60 transition-[width,left] duration-500 ease-out"
          style={{ width: 46, left: -(bracketGap / 2) - 46 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[1px] bg-[var(--gold-primary)]/60 transition-[width,left] duration-500 ease-out"
          style={{ width: 46, left: bracketGap / 2 }}
        />
        {/* End caps */}
        <div className="absolute top-1/2 -translate-y-1/2 w-[1px] h-2 bg-[var(--gold-primary)] transition-[left] duration-500 ease-out" style={{ left: -(bracketGap / 2) - 46 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-[1px] h-2 bg-[var(--gold-primary)] transition-[left] duration-500 ease-out" style={{ left: bracketGap / 2 + 46 }} />

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[var(--gold-primary)] shadow-[0_0_6px_var(--gold-primary)]" />

        {/* Vertical tick, center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[1px] h-3 bg-[var(--gold-primary)]/50" style={{ marginTop: -26 }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[1px] h-3 bg-[var(--gold-primary)]/50" style={{ marginTop: 14 }} />

        {/* LAT / LNG readouts flanking the reticle — hidden on mobile for clarity */}
        {!isMobile && (
          <>
            <div
              className="absolute top-1/2 -translate-y-1/2 text-right transition-[right] duration-500 ease-out"
              style={{ right: `calc(50% + ${bracketGap / 2 + 52}px)`, width: 90 }}
            >
              <div className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">LAT</div>
              <div className="text-[10px] font-mono font-bold tabular-nums text-[var(--gold-primary)]">{latStr}</div>
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 text-left transition-[left] duration-500 ease-out"
              style={{ left: `calc(50% + ${bracketGap / 2 + 52}px)`, width: 90 }}
            >
              <div className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">LNG</div>
              <div className="text-[10px] font-mono font-bold tabular-nums text-[var(--cyan-primary)]">{lngStr}</div>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop-only ornamental clusters ── */}
      {!isMobile && (
        <>
          {/* Top-left: layer load bargraph — ticks light up with active/total layers */}
          <div className="absolute top-14 left-16 flex flex-col gap-1">
            <div className="flex gap-[3px]">
              {Array.from({ length: BARGRAPH_SEGMENTS }).map((_, i) => (
                <div
                  key={i}
                  className="w-[9px] h-[3px] rounded-[1px] transition-colors duration-500"
                  style={{
                    background: i < litSegments ? 'var(--gold-primary)' : 'var(--border-secondary)',
                    boxShadow: i < litSegments ? '0 0 4px var(--gold-primary)' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-50">
              LAYERS {activeLayerCount}/{totalLayerCount}
            </span>
          </div>

          {/* Top-right: link status */}
          <div className="absolute top-14 right-16 flex flex-col items-end gap-1">
            <div className="flex gap-[3px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[9px] h-[3px] rounded-[1px]"
                  style={{
                    background: statusColor,
                    opacity: backendStatus === 'error' ? (i === 0 ? 1 : 0.2) : 0.35 + (i * 0.2),
                    boxShadow: `0 0 4px ${statusColor}`,
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] font-mono tracking-[0.2em] opacity-70" style={{ color: statusColor }}>
              LINK {statusLabel}
            </span>
          </div>

          {/* Side bearing scale — lit tick scrolls with longitude as you pan */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-[7px]">
            {Array.from({ length: 11 }).map((_, i) => {
              const litIndex = Math.round(bearingPct * 10);
              const lit = i === litIndex;
              return (
                <div
                  key={i}
                  className="h-[1px] transition-all duration-700 ease-out"
                  style={{
                    width: lit ? 16 : 8,
                    background: lit ? 'var(--cyan-primary)' : 'var(--border-secondary)',
                    boxShadow: lit ? '0 0 5px var(--cyan-primary)' : 'none',
                  }}
                />
              );
            })}
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-[7px] items-end">
            {Array.from({ length: 11 }).map((_, i) => {
              const litIndex = Math.round(bearingPct * 10);
              const lit = i === litIndex;
              return (
                <div
                  key={i}
                  className="h-[1px] transition-all duration-700 ease-out"
                  style={{
                    width: lit ? 16 : 8,
                    background: lit ? 'var(--cyan-primary)' : 'var(--border-secondary)',
                    boxShadow: lit ? '0 0 5px var(--cyan-primary)' : 'none',
                  }}
                />
              );
            })}
          </div>

          {/* Bottom-left: projection + view mode */}
          <div className="absolute bottom-16 left-16 flex flex-col gap-0.5">
            <div className="w-10 h-[1px] bg-[var(--gold-primary)]/40 mb-1" />
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              PROJ <span className="text-[var(--gold-primary)] opacity-100">{mapProjection === 'globe' ? '3D' : '2D'}</span>
            </span>
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              VIEW <span className="text-[var(--gold-primary)] opacity-100">{mapStyle === 'dark' ? 'MAP' : 'SAT'}</span>
            </span>
          </div>

          {/* Bottom-right: zoom readout */}
          <div className="absolute bottom-16 right-16 flex flex-col items-end gap-0.5">
            <div className="w-10 h-[1px] bg-[var(--gold-primary)]/40 mb-1" />
            <span className="text-[8px] font-mono tracking-[0.2em] text-[var(--text-muted)] opacity-60">
              ZOOM <span className="text-[var(--cyan-primary)] opacity-100 tabular-nums">{zoom.toFixed(1)}</span>
            </span>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes hud-scan-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .hud-scan-rotate {
          animation: hud-scan-rotate 24s linear infinite;
        }
        @keyframes hud-ping {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; }
          70% { opacity: 0.25; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        .hud-ping {
          animation: hud-ping 1.1s cubic-bezier(0.2, 0.6, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
}
