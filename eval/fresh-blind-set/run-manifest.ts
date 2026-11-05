import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Verify an existing run before creating or replacing its request manifest. */
export function ensureRunManifest(outDir: string, runFingerprint: string, manifest: string): void {
  const stateFile = join(outDir, 'state.json');
  const manifestFile = join(outDir, 'requests-manifest.json');
  const stateExists = existsSync(stateFile);
  if (stateExists) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { runFingerprint?: unknown };
    if (state.runFingerprint !== runFingerprint) {
      throw new Error('the saved state does not match the request fingerprint');
    }
  }

  if (existsSync(manifestFile)) {
    if (readFileSync(manifestFile, 'utf8') !== manifest) {
      throw new Error('the saved request manifest does not match the request fingerprint');
    }
    return;
  }
  if (stateExists) throw new Error('the saved state has no matching request manifest');

  mkdirSync(outDir, { recursive: true });
  try {
    writeFileSync(manifestFile, manifest, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (readFileSync(manifestFile, 'utf8') !== manifest) {
      throw new Error('the saved request manifest does not match the request fingerprint');
    }
  }
}
