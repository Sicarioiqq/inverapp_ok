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

    // If no UF value is found in the database, fetch it from an external API
    return await fetchUFValueFromAPI();
  } catch (err) {
    console.error('Error in fetchLatestUFValue:', err);
    return null;
  }
};

/**
 * Fetches the current UF value from an external API and stores it in the database
 * @returns The current UF value or null if not found
 */
export const fetchUFValueFromAPI = async (): Promise<number | null> => {
  try {
    // Fetch UF value from CMF API (Chilean Financial Market Commission)
    const response = await fetch('https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=e078e0a4a72f28b70d1f937f3e5917b2e9e6b6e8&formato=json');
    
    if (!response.ok) {
      // Fallback to another API if CMF API fails
      return await fetchUFValueFromBackupAPI();
    }
    
    const data = await response.json();
    
    if (data && data.UFs && data.UFs.length > 0) {
      const ufValue = parseFloat(data.UFs[0].Valor.replace('.', '').replace(',', '.'));
      
      // Store the UF value in the database
      await storeUFValue(ufValue);
      
      return ufValue;
    }
    
    // If CMF API doesn't return valid data, try backup API
    return await fetchUFValueFromBackupAPI();
  } catch (err) {
    console.error('Error fetching UF value from API:', err);
    return await fetchUFValueFromBackupAPI();
  }
};

/**
 * Fallback function to fetch UF value from a backup API
 * @returns The current UF value or null if not found
 */
export const fetchUFValueFromBackupAPI = async (): Promise<number | null> => {
  try {
    // Using mindicador.cl as a backup API
    const response = await fetch('https://mindicador.cl/api/uf');
    
    if (!response.ok) {
      throw new Error('Failed to fetch from backup API');
    }
    
    const data = await response.json();
    
    if (data && data.serie && data.serie.length > 0) {
      const ufValue = data.serie[0].valor;
      
      // Store the UF value in the database
      await storeUFValue(ufValue);
      
      return ufValue;
    }
    
    return null;
  } catch (err) {
    console.error('Error fetching UF value from backup API:', err);
    return null;
  }
};

/**
 * Stores a UF value in the database
 * @param value The UF value to store
 */
export const storeUFValue = async (value: number): Promise<void> => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we already have a value for today
    const { data: existingData, error: checkError } = await supabase
      .from('valores_financieros')
      .select('id')
      .eq('nombre', 'UF')
      .eq('fecha', formattedDate)
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking existing UF value:', checkError);
      return;
    }
    
    if (existingData) {
      // Update existing value
      const { error: updateError } = await supabase
        .from('valores_financieros')
        .update({ valor: value })
        .eq('id', existingData.id);
        
      if (updateError) {
        console.error('Error updating UF value:', updateError);
      }
    } else {
      // Insert new value
      const { error: insertError } = await supabase
        .from('valores_financieros')
        .insert([
          { 
            valor: value, 
            nombre: 'UF', 
            fecha: formattedDate 
          }
        ]);
        
      if (insertError) {
        console.error('Error inserting UF value:', insertError);
      }
    }
  } catch (err) {
    console.error('Error storing UF value:', err);
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