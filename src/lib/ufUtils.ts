import { supabase } from './supabase';

/**
 * Fetches the latest UF value from the database
 * @returns The latest UF value or null if not found
 */
export const fetchLatestUFValue = async (): Promise<number | null> => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    // First check if we already have today's UF value in the database
    const { data: todayData, error: todayError } = await supabase
      .from('valores_financieros')
      .select('valor, fecha')
      .eq('nombre', 'UF')
      .eq('fecha', formattedDate)
      .maybeSingle();

    if (todayError) {
      console.error('Error fetching today\'s UF value:', todayError);
    } else if (todayData?.valor) {
      console.log('Found today\'s UF value in database:', todayData.valor);
      return todayData.valor;
    }

    // If we don't have today's value, fetch from external API
    console.log('Today\'s UF value not found in database, fetching from API...');
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
    // Try the primary API first (mindicador.cl)
    const response = await fetch('https://mindicador.cl/api/uf');
    
    if (!response.ok) {
      console.log('Primary API failed, trying backup API...');
      return await fetchUFValueFromBackupAPI();
    }
    
    const data = await response.json();
    
    if (data && data.serie && data.serie.length > 0) {
      const ufValue = data.serie[0].valor;
      
      if (!isNaN(ufValue)) {
        console.log('UF value fetched from primary API:', ufValue);
        // Store the UF value in the database
        await storeUFValue(ufValue);
        return ufValue;
      }
    }
    
    // If primary API doesn't return valid data, try backup API
    console.log('Primary API returned invalid data, trying backup API...');
    return await fetchUFValueFromBackupAPI();
  } catch (err) {
    console.error('Error fetching UF value from primary API:', err);
    return await fetchUFValueFromBackupAPI();
  }
};

/**
 * Fallback function to fetch UF value from a backup API
 * @returns The current UF value or null if not found
 */
export const fetchUFValueFromBackupAPI = async (): Promise<number | null> => {
  try {
    // Using CMF API as a backup
    const apiKey = 'e078e0a4a72f28b70d1f937f3e5917b2e9e6b6e8'; // This is a public key
    const response = await fetch(`https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=${apiKey}&formato=json`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from backup API');
    }
    
    const data = await response.json();
    
    if (data && data.UFs && data.UFs.length > 0) {
      // Convert the UF value from string to number
      // The format is typically "12.345,67" which needs to be converted to 12345.67
      const ufValueStr = data.UFs[0].Valor;
      const ufValue = parseFloat(ufValueStr.replace('.', '').replace(',', '.'));
      
      if (!isNaN(ufValue)) {
        console.log('UF value fetched from backup API:', ufValue);
        // Store the UF value in the database
        await storeUFValue(ufValue);
        return ufValue;
      }
    }
    
    console.error('Backup API returned invalid data');
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
      console.log('Updating existing UF value for today:', value);
      const { error: updateError } = await supabase
        .from('valores_financieros')
        .update({ valor: value })
        .eq('id', existingData.id);
        
      if (updateError) {
        console.error('Error updating UF value:', updateError);
      }
    } else {
      // Insert new value
      console.log('Inserting new UF value for today:', value);
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