// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard'; // Asumiendo que está en src/pages/settings/components/
import { supabase } from '@/lib/supabase'; // ¡VERIFICA ESTA IMPORTACIÓN Y LA CONFIGURACIÓN DE TU ALIAS!
                                        // Si falla después de los arreglos de Bolt, prueba temporalmente una ruta relativa.
import { toast } from 'react-hot-toast';   // O tu sistema de notificaciones preferido

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

// Función auxiliar para normalizar strings y manejar 'EMPTY' u otros placeholders
const getSafeString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  // Considera si 'EMPTY' es el único placeholder o si hay otros (ej. '-', 'N/A')
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
      toast.error('No hay datos para cargar desde el archivo Excel.');
      return;
    }

    setIsUploadingToSupabase(true);

    const mappedData = dataFromExcel.map(row => {
      // Mapeo: Columna Supabase : row['Encabezado EXACTO del Excel']
      // Basado en tu Excel: "Nombre del Proyecto", "N° Bien", "Tipo", "Piso", "Orientación",
      // "Estado Bien", "Valor lista", "Sup. Útil", "Sup. terraza", "Sup. total".
      const item = {
        proyecto_nombre: getSafeString(row['Nombre del Proyecto']),
        unidad_codigo:   getSafeString(row['N° Bien']),
        tipologia:       getSafeString(row['Tipo']),
        piso:            getSafeString(row['Piso']),
        orientacion:     getSafeString(row['Orientación']),
        m2_utiles:       toNumber(row['Sup. Útil']),
        m2_terraza:      toNumber(row['Sup. terraza']),
        m2_totales:      toNumber(row['Sup. total']),
        precio_uf:       toNumber(row['Valor lista']),
        estado_unidad:   getSafeString(row['Estado Bien']) || 'Disponible', // Fallback a 'Disponible'
      };
      return item;
    }).filter(row => row.unidad_codigo && row.unidad_codigo.trim() !== ''); // Solo filas con un 'N° Bien' válido

    if (mappedData.length === 0) {
      toast.error('No se encontraron datos válidos (con "N° Bien") para cargar tras el mapeo.');
      setIsUploadingToSupabase(false);
      return;
    }
    
    console.log('Datos mapeados para Supabase:', mappedData);

    try {
      // **IMPORTANTE**: 'onConflict' debe coincidir con tu UNIQUE constraint en la tabla 'stock_unidades'.
      // Si tu constraint es UNIQUE(proyecto_nombre, unidad_codigo), entonces usa 'proyecto_nombre,unidad_codigo'.
      // Si tu constraint es solo UNIQUE(unidad_codigo), entonces usa 'unidad_codigo'.
      const { data, error } = await supabase
        .from('stock_unidades') // Nombre exacto de tu tabla en Supabase
        .upsert(mappedData, {
          onConflict: 'proyecto_nombre,unidad_codigo', // AJUSTA ESTO A TU CONSTRAINT
        });

      if (error) {
        console.error('Error de Supabase al hacer upsert:', error);
        throw error; // Esto será capturado por el bloque catch
      }

      const successMsg = `¡Stock procesado! ${mappedData.length} unidades consideradas para carga/actualización en Supabase.`;
      setSupabaseSuccess(successMsg);
      toast.success(successMsg);
      console.log('Datos guardados/actualizados en Supabase:', data);

    } catch (error: any) {
      console.error('Error en el proceso de carga a Supabase:', error);
      // El mensaje de error de Supabase suele ser informativo
      const errorMsg = `Error al guardar en Supabase: ${error.message || 'Error desconocido. Revisa la consola del navegador y de Supabase.'}`;
      setSupabaseError(errorMsg);
      toast.error(errorMsg);
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