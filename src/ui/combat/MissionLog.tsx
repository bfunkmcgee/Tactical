import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../../game/types';

/**
 * Collapsible mission log. Default state is a 44px pill anchored
 * top-right; an unread badge surfaces "something happened" without
 * forcing the full panel to occlude a third of the map. Tap the
 * pill to expand into the legacy 220×200 scroll panel; tap the
 * close glyph to collapse again.
 *
 * Outside-tap does NOT close (avoids accidentally dismissing the
 * log mid-tap on a fire button just below it).
 */
export interface MissionLogProps {
  entries: LogEntry[];
}

function logColor(k: LogEntry['kind']): string {
  switch (k) {
    case 'hit': return 'var(--fg-0)';
    case 'crit': return 'var(--accent-2)';
    case 'miss': return 'var(--fg-2)';
    case 'kill': return 'var(--danger)';
    case 'heal': return 'var(--success)';
    default: return 'var(--fg-1)';
  }
}

export default function MissionLog({ entries }: MissionLogProps) {
  const [expanded, setExpanded] = useState(false);
  // Track the highest entry id we've shown the user. When the panel
  // is open, every new entry counts as "seen". When it's closed, new
  // entries accumulate and surface as the unread badge count.
  const lastSeenIdRef = useRef<number>(entries[entries.length - 1]?.id ?? -1);
  // Seed lastSeen on first mount so an existing log doesn't flash a
  // stale unread count.
  useEffect(() => {
    if (expanded) {
      lastSeenIdRef.current = entries[entries.length - 1]?.id ?? lastSeenIdRef.current;
    }
  }, [expanded, entries]);

  const unread = entries.filter((e) => e.id > lastSeenIdRef.current).length;

  if (!expanded) {
    const hasUnread = unread > 0;
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={hasUnread ? `Open mission log (${unread} new)` : 'Open mission log'}
        style={{
          position: 'fixed',
          right: 'var(--s-2)',
          top: 'calc(var(--safe-top) + 72px)',
          minHeight: 44, padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(11,15,20,0.85)',
          border: `1px solid ${hasUnread ? 'var(--accent-2)' : 'var(--bg-3)'}`,
          borderRadius: 'var(--r-md)',
          backdropFilter: 'blur(6px)',
          fontSize: 12,
          pointerEvents: 'auto',
          zIndex: 10,
        }}
      >
        <span style={{ color: 'var(--fg-1)' }}>Log</span>
        {hasUnread && (
          <span
            aria-hidden="true"
            style={{
              minWidth: 18, height: 18, padding: '0 5px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              color: '#0b0f14',
              background: 'var(--accent-2)',
              borderRadius: 9,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  }

  // Expanded
  return (
    <div
      role="log"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 'var(--s-2)',
        top: 'calc(var(--safe-top) + 72px)',
        width: 220, maxHeight: 200,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(11,15,20,0.85)',
        border: '1px solid var(--bg-3)',
        borderRadius: 'var(--r-md)',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      <div
        className="row"
        style={{
          justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 8px', borderBottom: '1px solid var(--bg-2)',
        }}
      >
        <strong style={{ fontSize: 12, color: 'var(--fg-1)' }}>Log</strong>
        <button
          type="button"
          onClick={() => {
            lastSeenIdRef.current = entries[entries.length - 1]?.id ?? lastSeenIdRef.current;
            setExpanded(false);
          }}
          aria-label="Close mission log"
          style={{
            width: 44, height: 32, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-2)', fontSize: 18,
          }}
        >
          ×
        </button>
      </div>
      <div
        className="scroll-y"
        style={{
          flex: 1, padding: 8, fontSize: 12,
          display: 'flex', flexDirection: 'column-reverse',
        }}
      >
        <div>
          {entries.slice(-10).map((l) => (
            <div key={l.id} style={{ color: logColor(l.kind), marginBottom: 2 }}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
