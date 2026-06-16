import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  toStripeAmount,
  fromStripeAmount,
  slugify,
  truncate,
  capitalise
} from '../lib/utils'

describe('lib/utils', () => {
  describe('formatCurrency', () => {
    it('formats numbers to GBP currency strings by default', () => {
      expect(formatCurrency(19)).toBe('£19.00')
      expect(formatCurrency(10.5)).toBe('£10.50')
    })
  })

  describe('toStripeAmount', () => {
    it('converts major units to minor units safely', () => {
      expect(toStripeAmount(19.00)).toBe(1900)
      expect(toStripeAmount(10.50)).toBe(1050)
      expect(toStripeAmount(0.99)).toBe(99)
    })
  })

  describe('fromStripeAmount', () => {
    it('converts minor units back to major units', () => {
      expect(fromStripeAmount(1900)).toBe(19)
      expect(fromStripeAmount(1050)).toBe(10.5)
      expect(fromStripeAmount(99)).toBe(0.99)
    })
  })

  describe('slugify', () => {
    it('creates URL-safe slugs from strings', () => {
      expect(slugify('Neo-Traditional!')).toBe('neo-traditional')
      expect(slugify('John Doe Studio')).toBe('john-doe-studio')
      expect(slugify('Café & Tattoo')).toBe('cafe-tattoo')
    })
  })

  describe('truncate', () => {
    it('truncates text and appends ellipsis if over max length', () => {
      expect(truncate('Hello world', 5)).toBe('Hell…')
      expect(truncate('Hi', 5)).toBe('Hi')
    })
  })

  describe('capitalise', () => {
    it('capitalises the first letter of a string', () => {
      expect(capitalise('hello')).toBe('Hello')
      expect(capitalise('HELLO')).toBe('HELLO')
      expect(capitalise('')).toBe('')
    })
  })
})
