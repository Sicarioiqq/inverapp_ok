// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard'; // Asumiendo que está en src/pages/settings/components/
import { supabase } from '../../lib/supabase'; // Ajustada la ruta de importación

// Función auxiliar para convertir strings con coma (o sin ella) a números
const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (stringValue === '') return null;

  // Reemplaza la coma por un punto para el separador decimal
  const normalizedStringValue = stringValue.replace(',', '.');
  const numberValue = parseFloat(normalizedStringValue);

  return isNaN(numberValue) ? null : numberValue;
};

// Función auxiliar para normalizar strings y manejar 'EMPTY'
const getSafeString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return (str === 'EMPTY' || str === '') ? null : str;
};

const CotizadorSettings: React.FC = () => {
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseSuccess, setSupabaseSuccess] = useState<string | null>(null);

  const handleStockDataUploaded = async (dataFromExcel: any[]) => {
    console.log('Datos crudos del Excel recibidos:', dataFromExcel);
    setSupabaseError(null);
    setSupabaseSuccess(null);

    if (!dataFromExcel || dataFromExcel.length === 0) {
      setSupabaseError('No hay datos para cargar desde el archivo Excel.');
      return;
    }

    setIsUploadingToSupabase(true);

    try {
      // Mapear los datos del Excel a la estructura de la tabla stock_unidades
      const mappedData = dataFromExcel.map(row => {
        // Mapeo: Columna Supabase : row['Encabezado EXACTO del Excel']
        const item = {
          proyecto_nombre: getSafeString(row['Nombre del Proyecto']),
          unidad: getSafeString(row['N° Bien']),
          tipologia: getSafeString(row['Tipo']),
          piso: getSafeString(row['Piso']),
          orientacion: getSafeString(row['Orientación']),
          etapa: toNumber(row['Etapa']),
          tipoBien   = getSafeString(row['Tipo Bien']);
          valor_lista: toNumber(row['Valor lista']),
          descuento: toNumber(row['Descuento']),
          sup_interior: toNumber(row['Sup. Interior']),
          sup_util: toNumber(row['Sup. Útil']),
          sup_terraza: toNumber(row['Sup. Terraza']),
          sup_ponderada: toNumber(row['Sup. Ponderada']),
          sup_terreno: toNumber(row['Sup. Terreno']),
          sup_jardin: toNumber(row['Sup. Jardín']),
          sup_total: toNumber(row['Sup. Total']),
          sup_logia: toNumber(row['Sup. Logia']),
          m2_utiles: toNumber(row['Sup. Útil']),
          m2_terraza: toNumber(row['Sup. Terraza']),
          m2_totales: toNumber(row['Sup. Total']),
          precio_uf: toNumber(row['Valor lista']),
          estado_unidad: getSafeString(row['Estado Bien']) || 'Disponible', // Fallback si el campo está vacío
        };
        return item;
      }).filter(row => row.unidad && row.unidad.trim() !== '' && row.proyecto_nombre && row.proyecto_nombre.trim() !== ''); // Solo filas con unidad_codigo y proyecto_nombre válidos

      if (mappedData.length === 0) {
        setSupabaseError('No se encontraron datos válidos (con "N° Bien" y "Nombre del Proyecto") para cargar tras el mapeo.');
        setIsUploadingToSupabase(false);
        return;
      }
      
      console.log('Datos mapeados para Supabase:', mappedData);

      // Verificar si hay duplicados en los datos mapeados
      const uniqueKeys = new Set();
      const duplicates = mappedData.filter(item => {
        const key = `${item.proyecto_nombre}-${item.unidad}`;
        if (uniqueKeys.has(key)) {
          return true;
        }
        uniqueKeys.add(key);
        return false;
      });

      if (duplicates.length > 0) {
        console.warn('Se encontraron duplicados en los datos:', duplicates);
        setSupabaseError(`Se encontraron ${duplicates.length} registros duplicados en el Excel. Por favor, corrija los datos y vuelva a intentarlo.`);
        setIsUploadingToSupabase(false);
        return;
      }

      // Insertar o actualizar los datos en la tabla stock_unidades
      const { data, error } = await supabase
        .from('stock_unidades')
        .upsert(mappedData, {
          onConflict: 'proyecto_nombre,unidad', // Usar la constraint que acabamos de crear
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      const successMsg = `¡Stock procesado! ${mappedData.length} unidades consideradas para carga/actualización en Supabase.`;
      setSupabaseSuccess(successMsg);
      console.log('Datos guardados/actualizados en Supabase:', data);

    } catch (error: any) {
      console.error('Error en el proceso de carga a Supabase:', error);
      const errorMsg = `Error en el proceso de carga a Supabase: ${error.message || 'Error desconocido.'}`;
      setSupabaseError(errorMsg);
    } finally {
      setIsUploadingToSupabase(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Configuración del Cotizador</h2>
        <p className="text-gray-600">
          Aquí podrás configurar los parámetros del cotizador, incluyendo la carga inicial de stock de unidades.
        </p>
      </div>

      <StockUploadCard onDataUpload={handleStockDataUploaded} />

      {/* Mensajes para la carga a Supabase */}
      {isUploadingToSupabase && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-md flex items-center animate-pulse">
          <svg className="animate-spin h-5 w-5 mr-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Cargando datos a Supabase...
        </div>
      )}
      {supabaseError && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          <strong>Error:</strong> {supabaseError}
        </div>
      )}
      {supabaseSuccess && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
          {supabaseSuccess}
        </div>
      )}
    </div>
  );
};

export default CotizadorSettings;