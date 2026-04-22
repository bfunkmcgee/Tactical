import type { LogEntry } from '../types';
import { nextLogId } from './runtimeIds';

/** Combat log is capped at 60 entries — the HUD only shows the last ~20. */
const LOG_MAX = 60;

/**
 * Append a single log entry with a fresh id. Kept as an engine helper so
 * multiple modules (turn, mission, shotPipeline, utilities) emit
 * structurally identical entries without duplicating the `{ id, text, kind }`
 * shape everywhere.
 */
export function pushLog(
  log: LogEntry[],
  text: string,
  kind: LogEntry['kind'] = 'info',
): LogEntry[] {
  return [...log, { id: nextLogId(), text, kind }].slice(-LOG_MAX);
}
