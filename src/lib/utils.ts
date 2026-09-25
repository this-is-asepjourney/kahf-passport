import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format currency to IDR */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format date to Indonesian locale */
export function formatDate(date: string | Date, fmt = 'd MMMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: localeId });
}

/** Format datetime */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'd MMM yyyy, HH:mm');
}

/** Mask phone number: 0812****5678 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  const visible = 4;
  return phone.slice(0, visible) + '****' + phone.slice(-4);
}

/** Mask name: "Elsa N***" */
export function maskName(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].slice(0, 1) + '***';
  }
  return parts[0] + ' ' + parts[1].slice(0, 1) + '***';
}

/** Normalize phone to +62 format */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return '+' + digits;
  if (digits.startsWith('0')) return '+62' + digits.slice(1);
  return '+62' + digits;
}

/** Generate today's summary document ID */
export function summaryDocId(date: string, entityId: string): string {
  return `${date}_${entityId}`;
}

/** Format large numbers with K/M suffix */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(n);
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}
