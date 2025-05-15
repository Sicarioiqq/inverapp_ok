/**
 * Utility functions for handling dates in the application
 */

/**
 * Checks if a date string is empty and returns null if it is
 * @param dateString The date string to check
 * @returns null if the date string is empty, otherwise the original string
 */
export const normalizeDate = (dateString: string | null | undefined): string | null => {
  if (dateString === undefined || dateString === null || dateString.trim() === '') {
    return null;
  }
  return dateString;
};

/**
 * Formats a date as YYYY-MM-DD
 * @param date The date to format
 * @returns The formatted date string
 */
export const formatDateForInput = (date: Date | null): string => {
  if (!date) return '';
  
  // Use Chile timezone (UTC-4)
  const chileDateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];
  
  return chileDateString;
};

/**
 * Formats a date as YYYY-MM-DDTHH:MM
 * @param date The date to format
 * @returns The formatted date string
 */
export const formatDateTimeForInput = (date: Date | string | null): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Use Chile timezone (UTC-4)
  const chileDateString = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000))
    .toISOString()
    .slice(0, 16);
  
  return chileDateString;
};

/**
 * Parses a date string to a Date object
 * @param dateString The date string to parse
 * @returns The parsed Date object or null if the date string is invalid
 */
export const parseDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  
  try {
    // Create date with Chile timezone (UTC-4)
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    // Adjust for Chile timezone
    const chileDate = new Date(date.getTime() - (4 * 60 * 60 * 1000));
    return chileDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Formats a date for display with Chile timezone
 * @param date The date to format
 * @returns The formatted date string
 */
export const formatDateChile = (date: Date | string | null): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format with Chile timezone
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Santiago'
    }).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Gets the current date in Chile timezone
 * @returns The current date in Chile timezone
 */
export const getNowChile = (): Date => {
  const now = new Date();
  // Adjust for Chile timezone (UTC-4)
  return new Date(now.getTime() - (4 * 60 * 60 * 1000));
};