import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReport } from './reports';

const mockInsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === 'reports') {
    return {
      insert: mockInsert,
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitReport', () => {
  it('submits a report with correct payload and resolves', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const args = {
      userId: 'user-123',
      termId: 'term-456',
      reason: 'wrong' as const,
      quizMode: 'mc' as const,
    };

    await expect(submitReport(args)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('reports');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      term_id: 'term-456',
      reason: 'wrong',
      quiz_mode: 'mc',
    });
  });

  it('submits a report with null quizMode and resolves', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const args = {
      userId: 'user-123',
      termId: 'term-456',
      reason: 'unclear' as const,
      quizMode: null,
    };

    await expect(submitReport(args)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('reports');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      term_id: 'term-456',
      reason: 'unclear',
      quiz_mode: null,
    });
  });

  it('throws a DataLayerError if insert fails', async () => {
    const mockError = new Error('Database insert failed');
    mockInsert.mockResolvedValueOnce({ error: mockError });

    const args = {
      userId: 'user-123',
      termId: 'term-456',
      reason: 'too-obvious' as const,
      quizMode: 'sentence' as const,
    };

    await expect(submitReport(args)).rejects.toThrowError(
      expect.objectContaining({
        code: 'DATABASE_ERROR',
        message: expect.stringContaining('Database error in submitReport: Database insert failed')
      })
    );

    expect(mockFrom).toHaveBeenCalledWith('reports');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      term_id: 'term-456',
      reason: 'too-obvious',
      quiz_mode: 'sentence',
    });
  });

  describe('validation checks', () => {
    it('throws validation error if args is missing or not an object', async () => {
      await expect(submitReport(null as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'args must be a non-null object' })
      );
      await expect(submitReport('invalid' as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'args must be a non-null object' })
      );
    });

    it('throws validation error if userId is missing or empty', async () => {
      const args = {
        userId: '',
        termId: 'term-456',
        reason: 'wrong' as const,
        quizMode: 'mc' as const,
      };
      await expect(submitReport(args)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'userId must be a non-empty string' })
      );
    });

    it('throws validation error if termId is missing or empty', async () => {
      const args = {
        userId: 'user-123',
        termId: '   ',
        reason: 'wrong' as const,
        quizMode: 'mc' as const,
      };
      await expect(submitReport(args)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'termId must be a non-empty string' })
      );
    });

    it('throws validation error if reason is invalid', async () => {
      const args = {
        userId: 'user-123',
        termId: 'term-456',
        reason: 'not-a-valid-reason' as any,
        quizMode: 'mc' as const,
      };
      await expect(submitReport(args)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Invalid reason value' })
      );
    });

    it('throws validation error if quizMode is invalid', async () => {
      const args = {
        userId: 'user-123',
        termId: 'term-456',
        reason: 'wrong' as const,
        quizMode: 'not-a-valid-quiz-mode' as any,
      };
      await expect(submitReport(args)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Invalid quizMode value' })
      );
    });
  });
});
