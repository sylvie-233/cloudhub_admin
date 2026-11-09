import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind 类名，后传入的类覆盖先前的冲突类。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
