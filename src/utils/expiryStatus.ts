export const EXPIRY_THRESHOLDS = {
  warningDays: 60, // còn ≤ 60 ngày -> Vàng
  urgentDays: 30,  // còn ≤ 30 ngày -> Cam
};

export type ExpiryLevel = 'ok' | 'warning' | 'urgent' | 'expired' | 'unknown';

export interface ExpiryStatus {
  level: ExpiryLevel;
  label: string;
  daysLeft: number | null;
  colorClass: string;
}

export function getExpiryStatus(expiryDate: string | null | undefined): ExpiryStatus {
  if (!expiryDate) {
    return { level: 'unknown', label: 'Chưa xác định', daysLeft: null, colorClass: 'bg-gray-100 text-gray-500 border border-gray-300' };
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(expiryDate); target.setHours(0,0,0,0);
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (daysLeft < 0) {
    return { level: 'expired', label: `Quá hạn ${Math.abs(daysLeft)} ngày`, daysLeft, colorClass: 'bg-red-100 text-red-700 border border-red-300' };
  }
  if (daysLeft <= EXPIRY_THRESHOLDS.urgentDays) {
    return { level: 'urgent', label: `Còn ${daysLeft} ngày`, daysLeft, colorClass: 'bg-orange-100 text-orange-700 border border-orange-300' };
  }
  if (daysLeft <= EXPIRY_THRESHOLDS.warningDays) {
    return { level: 'warning', label: `Còn ${daysLeft} ngày`, daysLeft, colorClass: 'bg-lime-100 text-lime-850 border border-lime-300' };
  }
  return { level: 'ok', label: `Còn ${daysLeft} ngày`, daysLeft, colorClass: 'bg-green-100 text-green-700 border border-green-300' };
}
