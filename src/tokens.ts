/**
 * FairPoint Design System Tokens
 * Mapped 1:1 from Figma Local Variables & Core Tokens
 */

export const tokens = {
  colors: {
    user1: '#2563EB', // Cobalt Blue
    user2: '#E11D48', // Rose Red
    user3: '#059669', // Emerald Green
    user4: '#7C3AED', // Violet Purple
    intersection: '#F59E0B', // Amber
    fairpoint: '#F59E0B',    // Amber
  },
  semantics: {
    surfaceOverlay: '#ffffffe5',
    surfaceCard: '#ffffff',
    borderDefault: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radii: {
    control: 8,
    card: 16,
    pill: 9999,
  },
} as const;

export type UserThemeId = 1 | 2 | 3 | 4;

export const userThemeMap = {
  1: {
    name: 'User 1',
    label: 'Cobalt Blue',
    color: tokens.colors.user1,
    bgClass: 'user-1-bg',
    borderClass: 'user-1-border',
    textClass: 'user-1-text',
    ringClass: 'user-1-ring',
  },
  2: {
    name: 'User 2',
    label: 'Rose Red',
    color: tokens.colors.user2,
    bgClass: 'user-2-bg',
    borderClass: 'user-2-border',
    textClass: 'user-2-text',
    ringClass: 'user-2-ring',
  },
  3: {
    name: 'User 3',
    label: 'Emerald Green',
    color: tokens.colors.user3,
    bgClass: 'user-3-bg',
    borderClass: 'user-3-border',
    textClass: 'user-3-text',
    ringClass: 'user-3-ring',
  },
  4: {
    name: 'User 4',
    label: 'Violet Purple',
    color: tokens.colors.user4,
    bgClass: 'user-4-bg',
    borderClass: 'user-4-border',
    textClass: 'user-4-text',
    ringClass: 'user-4-ring',
  },
} as const;
