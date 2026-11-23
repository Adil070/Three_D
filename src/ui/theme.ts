import type { UnitStatus } from '../config/schema';

/**
 * Status colours. Red is deliberately avoided (brand rule): "sold" uses slate grey,
 * which also reads naturally as "unavailable".
 */
export const STATUS_COLORS: Record<UnitStatus, string> = {
  available: '#3CB371',
  'on-hold': '#D9952B',
  sold: '#8A94A6',
};

export const STATUS_LABELS: Record<UnitStatus, string> = {
  available: 'Available',
  'on-hold': 'On hold',
  sold: 'Sold',
};

export const formatArea = (sqft: number) => `${sqft.toLocaleString('en-US')} sq ft`;
