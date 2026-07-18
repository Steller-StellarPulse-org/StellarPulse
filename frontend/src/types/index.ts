// frontend/src/utils/date.ts

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago").
 * Normalizes timestamps to user's local timezone automatically.
 * Handles Unix timestamps (seconds and milliseconds), ISO strings, and Date objects.
 */
export function formatTimeAgo(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'Never';
  
  const now = new Date();
  let past: Date;

  // Handle different timestamp formats
  if (typeof dateInput === 'number') {
    // Unix timestamp in seconds (e.g., 1704067200)
    if (dateInput < 100000000000) {
      past = new Date(dateInput * 1000);
    } 
    // Unix timestamp in milliseconds (e.g., 1704067200000)
    else {
      past = new Date(dateInput);
    }
  } else if (typeof dateInput === 'string') {
    // ISO string or other date string
    past = new Date(dateInput);
  } else {
    // Date object
    past = dateInput;
  }

  // Validate the date
  if (isNaN(past.getTime())) {
    return 'Never';
  }

  const msElapsed = now.getTime() - past.getTime();
  
  // Handle future dates
  if (msElapsed < 0) {
    return 'Just now';
  }
  
  const seconds = Math.floor(msElapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return `${days}d ago`;
  }
}
