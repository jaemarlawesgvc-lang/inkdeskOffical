import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  generateSlotTimes,
  rangesOverlap,
  isTimeSlotAvailable,
  formatSlotLabel,
} from '../lib/booking/consultation-slots'

describe('lib/booking/consultation-slots (pure helpers)', () => {
  describe('timeToMinutes', () => {
    it('parses HH:MM and HH:MM:SS identically (DB "time" round-trips with seconds)', () => {
      expect(timeToMinutes('09:00')).toBe(540)
      expect(timeToMinutes('09:00:00')).toBe(540)
      expect(timeToMinutes('13:30')).toBe(810)
    })
  })

  describe('minutesToTime', () => {
    it('zero-pads back to HH:MM', () => {
      expect(minutesToTime(540)).toBe('09:00')
      expect(minutesToTime(810)).toBe('13:30')
      expect(minutesToTime(5)).toBe('00:05')
    })
  })

  describe('generateSlotTimes', () => {
    it('emits 30-min-spaced starts that fully fit a 0.5h consultation before end', () => {
      // 09:00–10:00, interval 30, duration 0.5h → 09:00, 09:30 (10:00 start would end 10:30 > 10:00)
      expect(generateSlotTimes('09:00', '10:00', 30, 0.5)).toEqual(['09:00', '09:30'])
    })

    it('excludes a start whose duration would overrun the end time', () => {
      // 1h duration in a 1h window → only 09:00 fits
      expect(generateSlotTimes('09:00', '10:00', 30, 1)).toEqual(['09:00'])
    })
  })

  describe('rangesOverlap', () => {
    it('treats adjacent half-open ranges as non-overlapping', () => {
      // [540,570) and [570,600) touch but do not overlap
      expect(rangesOverlap(540, 570, 570, 600)).toBe(false)
    })

    it('detects a genuine overlap', () => {
      expect(rangesOverlap(540, 600, 570, 630)).toBe(true)
    })
  })

  describe('isTimeSlotAvailable', () => {
    it('is false when the requested slot overlaps an occupied range', () => {
      const occupied = [{ startMinutes: 540, endMinutes: 570 }]
      expect(isTimeSlotAvailable('09:00', 0.5, occupied)).toBe(false)
    })

    it('is true for an adjacent, non-overlapping slot', () => {
      const occupied = [{ startMinutes: 540, endMinutes: 570 }]
      expect(isTimeSlotAvailable('09:30', 0.5, occupied)).toBe(true)
    })
  })

  describe('formatSlotLabel', () => {
    it('renders a 30-min consultation label', () => {
      expect(formatSlotLabel('09:00', 0.5)).toBe('9am – 9:30am (30 min)')
    })
  })
})
