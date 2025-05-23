import { supabase } from './supabase';

/**
 * Fetches the latest UF value from the database
 * @returns The latest UF value or null if not found
 */
export const fetchLatestUFValue = async (): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('valores_financieros')
      .select('valor, fecha')
      .eq('nombre', 'UF')
      .order('fecha', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching UF value:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0].valor;
    }

    return null;
  } catch (err) {
    console.error('Error in fetchLatestUFValue:', err);
    return null;
  }
};

/**
 * Formats a number as currency in Chilean Pesos
 * @param amount The amount to format
 * @returns Formatted string
 */
export const formatCLP = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formats a number as UF with 2 decimal places
 * @param amount The amount to format
 * @returns Formatted string
 */
export const formatUF = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};