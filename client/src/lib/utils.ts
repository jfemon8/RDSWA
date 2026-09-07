import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Title-cases a slug for display, so `event-based` reads as `Event-Based` while the stored value stays untouched. */
export function titleCase(value: string): string {
  return value.replace(/[a-z]+/gi, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
