// The supported learner fields (Kevin's ruling, 2026-11-03) and the copy of
// the module the Edge Function uses.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_FIELDS, learnerFieldFor, learnerFieldLabel } from './learner-fields';

describe('learner-fields copies', () => {
  it('the client and server copies are identical', () => {
    const client = readFileSync(resolve(__dirname, 'learner-fields.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../../supabase/functions/_shared/learner-fields.ts'), 'utf8');
    expect(server).toBe(client);
  });
});

describe('SUPPORTED_FIELDS', () => {
  it('offers nurse, pharmacist, pharmacy technician and teacher', () => {
    expect(SUPPORTED_FIELDS.map((f) => f.id).sort()).toEqual(['nurse', 'pharmacist', 'pharmacy_technician', 'teacher']);
    for (const f of SUPPORTED_FIELDS) expect(f.label[0]).toBe(f.label[0].toUpperCase());
  });
});

describe('learnerFieldFor', () => {
  it.each([
    [{ job: 'registered nurse on a medical-surgical unit' }, 'nurse'],
    [{ job: 'RN, night shift' }, 'nurse'],
    [{ job: 'staff pharmacist at a retail pharmacy', roles: ['trains new pharmacy technicians'] }, 'pharmacist'],
    [{ job: 'PharmD, clinical role' }, 'pharmacist'],
    [{ job: 'certified pharmacy technician' }, 'pharmacy_technician'],
    [{ job: 'CPhT at a hospital' }, 'pharmacy_technician'],
    [{ job: 'high-school biology teacher' }, 'teacher'],
    [{ job: 'instructional coach', roles: ['former teacher'] }, 'teacher'],
  ])('%j -> %s', (profile, expected) => {
    expect(learnerFieldFor(profile)).toBe(expected);
  });

  it.each([[{ job: 'accountant' }], [{ job: 'software engineer' }], [{}], [null]])('%j -> no supported field', (profile) => {
    expect(learnerFieldFor(profile as any)).toBeNull();
  });

  it('gives a label for a field id', () => {
    expect(learnerFieldLabel('pharmacy_technician')).toBe('Pharmacy technician');
    expect(learnerFieldLabel('accountant')).toBeNull();
  });
});
