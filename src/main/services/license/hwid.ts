// HWID derivation for license binding. The isipanel contract expects a
// 64-char lowercase hex SHA-256 string. On Windows, `node-machine-id` reads
// the MachineGuid from HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid via
// the OS — survives app reinstall, regenerates only on Windows reinstall or
// disk clone.
//
// We hash the raw machine id ourselves with SHA-256 to:
//   (a) match the contract's exact output format (64 hex chars)
//   (b) avoid exposing the raw MachineGuid to the network even indirectly
//
// Cached per-process — calling more than once never re-reads the registry.

import { machineId } from 'node-machine-id';
import { createHash } from 'node:crypto';

let cached: string | null = null;

export async function getHwid(): Promise<string> {
  if (cached) return cached;
  // machineId(true) returns the raw MachineGuid; pass false to get the
  // package's pre-hashed (MD5) version. We re-hash with SHA-256 either way to
  // produce the 64-char hex string the panel expects, so the input choice
  // only affects collision resistance against another isi* product. Using
  // the raw GUID gives us the best signal.
  const raw = await machineId(true);
  cached = createHash('sha256').update(raw).digest('hex');
  return cached;
}

/** Test-only — drop the cached value so the next call re-reads. */
export function resetHwidCache(): void {
  cached = null;
}
