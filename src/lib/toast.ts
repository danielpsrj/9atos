'use client';

import { toast } from 'sonner';

// Toast helpers (issue #48, NFR-07). A thin, typed wrapper over Sonner so
// feature code never calls the raw `toast()` API directly. Each helper maps a
// semantic outcome to a Sonner type, which the `.cn-toast` CSS in globals.css
// colors: errors render with the dark-red --error accent, success and warning
// render with the gold --accent accent. The message is always a translated
// string (the caller passes `t('key')`), so no user-facing text is hardcoded
// here.

/** Surface an API or runtime failure. Red accent. */
export function toastError(message: string): void {
  toast.error(message);
}

/** Surface a non-fatal warning (e.g. a distractor shortage on import). Gold accent. */
export function toastWarning(message: string): void {
  toast.warning(message);
}

/** Confirm a successful action (e.g. a notebook created). Gold accent. */
export function toastSuccess(message: string): void {
  toast.success(message);
}

/** Neutral informational message (sapphire/default accent). */
export function toastInfo(message: string): void {
  toast(message);
}
