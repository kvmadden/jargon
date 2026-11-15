import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAndRefillStreakFreezes } from './streak-freeze'

const zone = vi.hoisted(() => ({ value: 'America/Los_Angeles' }))
vi.mock('./streak-engine', async importOriginal => {
  const original = await importOriginal<typeof import('./streak-engine')>()
  return {
    ...original,
    todayLocalDate: (date: Date) => original.todayLocalDate(date, zone.value),
  }
})

afterEach(() => vi.useRealTimers())

describe('monthly freeze refill at UTC month boundaries', () => {
  it.each([
    ['America/Los_Angeles', '2026-11-01T02:00:00Z'],
    ['Asia/Tokyo', '2026-10-31T23:00:00Z'],
  ])('does not refill twice in the same local month in %s', async (timeZone, instant) => {
    zone.value = timeZone
    vi.useFakeTimers()
    vi.setSystemTime(new Date(instant))
    localStorage.clear()
    const persist = vi.fn().mockResolvedValue(undefined)
    const settings = { streak_freezes_available: 0 }

    expect(await checkAndRefillStreakFreezes('synthetic-user', settings, persist)).toBe(true)
    expect(await checkAndRefillStreakFreezes('synthetic-user', settings, persist)).toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('refills when the local month changes before the UTC month', async () => {
    zone.value = 'Asia/Tokyo'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T14:00:00Z'))
    localStorage.clear()
    const persist = vi.fn().mockResolvedValue(undefined)
    const settings = { streak_freezes_available: 0 }
    expect(await checkAndRefillStreakFreezes('synthetic-user', settings, persist)).toBe(true)
    vi.setSystemTime(new Date('2026-10-31T16:00:00Z'))
    expect(await checkAndRefillStreakFreezes('synthetic-user', settings, persist)).toBe(true)
    expect(persist).toHaveBeenCalledTimes(2)
  })
})
