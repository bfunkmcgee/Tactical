import { Howl } from 'howler';

/**
 * Thin wrapper around Howler that gives the rest of the game a tiny,
 * string-keyed API for combat + UI sounds.
 *
 * Design choices:
 *  - Clips load on first `play()` — startup stays snappy even if the
 *    audio directory is large.
 *  - Missing files are silently swallowed so the game still plays
 *    when an OGG is absent (dev builds, offline-first, content
 *    packs shipping without audio).
 *  - Master volume + mute persist to localStorage so the player's
 *    preference survives a reload.
 *  - No music bed yet — that's a future addition, the engine just
 *    exposes `setMaster` which will apply to music when it lands.
 */

export type SoundKey =
  // Combat
  | 'shot.rifle' | 'shot.heavy' | 'shot.shotgun' | 'shot.sniper'
  | 'shot.pistol' | 'shot.smg'
  | 'hit' | 'crit' | 'miss' | 'kill' | 'grenade'
  // Character
  | 'reload' | 'move' | 'ability'
  // UI
  | 'ui.tap' | 'ui.primary' | 'ui.cancel'
  // Turn structure
  | 'round.start' | 'victory' | 'defeat';

const SOURCES: Record<SoundKey, string> = {
  'shot.rifle':   '/audio/shot-rifle.ogg',
  'shot.heavy':   '/audio/shot-heavy.ogg',
  'shot.shotgun': '/audio/shot-shotgun.ogg',
  'shot.sniper':  '/audio/shot-sniper.ogg',
  'shot.pistol':  '/audio/shot-pistol.ogg',
  'shot.smg':     '/audio/shot-smg.ogg',
  'hit':          '/audio/hit.ogg',
  'crit':         '/audio/crit.ogg',
  'miss':         '/audio/miss.ogg',
  'kill':         '/audio/kill.ogg',
  'grenade':      '/audio/grenade.ogg',
  'reload':       '/audio/reload.ogg',
  'move':         '/audio/move.ogg',
  'ability':      '/audio/ability.ogg',
  'ui.tap':       '/audio/ui-tap.ogg',
  'ui.primary':   '/audio/ui-primary.ogg',
  'ui.cancel':    '/audio/ui-cancel.ogg',
  'round.start':  '/audio/round-start.ogg',
  'victory':      '/audio/victory.ogg',
  'defeat':       '/audio/defeat.ogg',
};

/** Per-key relative volume (0..1). Tuned so muzzle flashes and UI
 *  taps don't blow out against the quieter stingers. */
const VOLUME: Partial<Record<SoundKey, number>> = {
  'shot.rifle':   0.55,
  'shot.heavy':   0.75,
  'shot.shotgun': 0.70,
  'shot.sniper':  0.65,
  'shot.pistol':  0.50,
  'shot.smg':     0.45,
  'hit':          0.60,
  'crit':         0.70,
  'miss':         0.35,
  'kill':         0.70,
  'grenade':      0.85,
  'reload':       0.50,
  'move':         0.30,
  'ability':      0.55,
  'ui.tap':       0.30,
  'ui.primary':   0.45,
  'ui.cancel':    0.30,
  'round.start':  0.50,
  'victory':      0.70,
  'defeat':       0.65,
};

const LS_VOLUME = 'tactical.audio.master.v1';
const LS_MUTED  = 'tactical.audio.muted.v1';

let master = 0.8;
let muted = false;

function loadPrefs() {
  try {
    const v = Number(localStorage.getItem(LS_VOLUME));
    if (!Number.isNaN(v) && v >= 0 && v <= 1) master = v;
    muted = localStorage.getItem(LS_MUTED) === '1';
  } catch {
    // Node / SSR / private mode — defaults are fine.
  }
}

function savePrefs() {
  try {
    localStorage.setItem(LS_VOLUME, String(master));
    localStorage.setItem(LS_MUTED, muted ? '1' : '0');
  } catch { /* no-op in Node */ }
}

loadPrefs();

// Lazy Howl cache. First play loads; subsequent plays reuse.
const cache = new Map<SoundKey, Howl>();

function getHowl(key: SoundKey): Howl | null {
  if (cache.has(key)) return cache.get(key)!;
  const src = SOURCES[key];
  if (!src) return null;
  try {
    const h = new Howl({
      src: [src],
      volume: (VOLUME[key] ?? 0.6) * master,
      preload: false,
      // Missing files should fail silently — the game keeps playing.
      onloaderror: () => { /* swallow */ },
    });
    cache.set(key, h);
    return h;
  } catch {
    return null;
  }
}

export const soundEngine = {
  /** Play a clip by key. No-op when muted, when audio isn't available
   *  (Node tests), or when the asset is missing. */
  play(key: SoundKey): void {
    if (muted) return;
    const h = getHowl(key);
    if (!h) return;
    try { h.play(); } catch { /* no-op */ }
  },

  /** 0..1. Persists across reload. Applies to all currently-cached
   *  clips immediately. */
  setMaster(vol: number): void {
    master = Math.max(0, Math.min(1, vol));
    for (const [key, h] of cache) {
      h.volume((VOLUME[key] ?? 0.6) * master);
    }
    savePrefs();
  },

  getMaster(): number {
    return master;
  },

  setMuted(m: boolean): void {
    muted = m;
    savePrefs();
  },

  isMuted(): boolean {
    return muted;
  },

  /** Toggle and return the new state. Convenience for a HUD button. */
  toggleMute(): boolean {
    muted = !muted;
    savePrefs();
    return muted;
  },
};
