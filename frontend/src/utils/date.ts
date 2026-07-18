/**
 * Converts a timestamp or date string into a localized relative "time ago" format.
 */
export function formatTimeAgo(dateInput: string | number | Date): string {
  const now = new Date();
  const past = new Date(dateInput);
  
  // Calculate difference in milliseconds
  const msElapsed = now.getTime() - past.getTime();
  
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

/**
 * Alternative approach: Displays the absolute date and time 
 * localized automatically to the user's specific browser timezone.
 */
export function formatLocalTimestamp(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  return date.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }); // Automatically outputs matching the user's device preferences (e.g., MM/DD/YYYY, hh:mm AM/PM)
}
