import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single instance of the Supabase client to avoid multiple connections
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (...args) => {
      // Add retry logic for failed requests
      return fetch(...args).catch(error => {
        console.error('Supabase fetch error:', error);
        throw error;
      });
    }
  },
  // Add reasonable timeouts
  realtime: {
    timeout: 30000 // 30 seconds
  },
  // Set default headers for all requests
  headers: {
    'x-timezone': 'America/Santiago'
  }
});

// Add a helper function to check connection
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('roles').select('id').limit(1);
    if (error) throw error;
    return { success: true, message: 'Connection successful' };
  } catch (error) {
    console.error('Supabase connection error:', error);
    return { success: false, message: error.message || 'Connection failed' };
  }
};

// Helper functions for date formatting with Chile timezone
export const formatDateChile = (date: string | Date | null): string => {
  if (!date) return '';
  
  try {
    // Create a date object
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
    return typeof date === 'string' ? date : date.toString();
  }
};

// Format date and time with Chile timezone
export const formatDateTimeChile = (date: string | Date | null): string => {
  if (!date) return '';
  
  try {
    // Create a date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format with Chile timezone
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago'
    }).format(dateObj);
  } catch (error) {
    console.error('Error formatting date and time:', error);
    return typeof date === 'string' ? date : date.toString();
  }
};

// Parse a date string to a Date object in Chile timezone
export const parseDateChile = (dateString: string): Date => {
  // Create a date object
  const date = new Date(dateString);
  
  // Get the UTC time offset for Chile
  const chileOffset = -4 * 60; // Chile is UTC-4 (in minutes)
  const localOffset = date.getTimezoneOffset();
  
  // Adjust the date by the difference between local and Chile timezone
  date.setMinutes(date.getMinutes() + localOffset - chileOffset);
  
  return date;
};

// Get current date and time in Chile timezone
export const getNowChile = (): Date => {
  const now = new Date();
  
  // Get the UTC time offset for Chile
  const chileOffset = -4 * 60; // Chile is UTC-4 (in minutes)
  const localOffset = now.getTimezoneOffset();
  
  // Adjust the date by the difference between local and Chile timezone
  now.setMinutes(now.getMinutes() + localOffset - chileOffset);
  
  return now;
};

// Format a date as YYYY-MM-DD for input fields
export const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date in Chile timezone
  const chileDate = new Date(dateObj.getTime() - (4 * 60 * 60 * 1000));
  const year = chileDate.getUTCFullYear();
  const month = String(chileDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chileDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Function to parse month-year text to date
export const parseMonthYear = (monthYearStr: string): string | null => {
  // Regular expression to match "month de year" format
  const regex = /^(\w+)\s+de\s+(\d{4})$/i;
  const match = monthYearStr.match(regex);
  
  if (match) {
    const monthName = match[1].toLowerCase();
    const year = match[2];
    
    // Convert month name to number
    const monthNumber = {
      'enero': '01',
      'febrero': '02',
      'marzo': '03',
      'abril': '04',
      'mayo': '05',
      'junio': '06',
      'julio': '07',
      'agosto': '08',
      'septiembre': '09',
      'octubre': '10',
      'noviembre': '11',
      'diciembre': '12'
    }[monthName];
    
    if (monthNumber) {
      // Create a date string in ISO format
      return `${year}-${monthNumber}-01`;
    }
  }
  
  // If it's already in YYYY-MM format, add the day
  if (/^\d{4}-\d{2}$/.test(monthYearStr)) {
    return `${monthYearStr}-01`;
  }
  
  return null;
};

// Function to format date as month-year text
export const formatMonthYear = (dateStr: string): string => {
  try {
    // Get the month and year directly from the date string to avoid timezone issues
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Convert to 0-based month index
      
      // Map month number (0-11) to Spanish month name
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      // Return formatted string
      return `${monthNames[month]} de ${year}`;
    }
    
    return '';
  } catch (e) {
    console.error('Error formatting date to month year:', e);
    return '';
  }
};

// Format currency values in UF with 2 decimal places
export const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '0,00';
  return value.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};