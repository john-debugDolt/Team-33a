/**
 * Date utility functions for consistent time formatting across admin panel
 * Converts UTC timestamps to local timezone
 */

/**
 * Format a date string to local date and time
 * @param {string|Date} dateString - ISO date string or Date object
 * @param {boolean} includeTime - Whether to include time (default: true)
 * @returns {string} Formatted date string in local timezone
 */
export const formatDateTime = (dateString, includeTime = true) => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return '-';

    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(includeTime && {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };

    return date.toLocaleString(undefined, options);
  } catch {
    return '-';
  }
};

/**
 * Format a date string to local date only (no time)
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
  return formatDateTime(dateString, false);
};

/**
 * Format a date string to local time only
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Formatted time string
 */
export const formatTime = (dateString) => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '-';
  }
};

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    const now = new Date();

    if (isNaN(date.getTime())) return '-';

    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return formatDateTime(dateString, false);
  } catch {
    return '-';
  }
};

/**
 * Get current date in YYYY-MM-DD format for date inputs
 * @returns {string} Current date string
 */
export const getCurrentDateString = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get date N days ago in YYYY-MM-DD format
 * @param {number} days - Number of days ago
 * @returns {string} Date string
 */
export const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

export default {
  formatDateTime,
  formatDate,
  formatTime,
  formatRelativeTime,
  getCurrentDateString,
  getDateDaysAgo
};
