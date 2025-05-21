// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

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

// Función para normalizar el estado de la unidad
const normalizeEstado = (estado: string | null): string => {
  if (!estado) return 'Disponible';
  
  // Normaliza el string removiendo espacios extra y convirtiendo a minúsculas
  const estadoNormalizado = estado.trim().toLowerCase();
  
  // Mapa de estados válidos y sus normalizaciones
  const estadosValidos: { [key: string]: string } = {
    'disponible': 'Disponible',
    'reservado': 'Reservado',
    'vendido': 'Vendido',
    'no disponible': 'No Disponible',
    'nodisponible': 'No Disponible',
    'no_disponible': 'No Disponible',
    'disponible ': 'Disponible',
    'reservada': 'Reservado',
    'vendida': 'Vendido',
  };

  // Retorna el estado normalizado si existe en el mapa, o 'Disponible' por defecto
  return estadosValidos[estadoNormalizado] || 'Disponible';
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
      // Asegurarse de que tenemos un valor válido para 'unidad'
      const unidad = getSafeString(row['N° Bien']) || row['Unidad'] || row['N° Unidad'];
      if (!unidad) {
        console.warn('Fila sin número de unidad:', row);
        return null;
      }

      // Mapeo: Columna Supabase : row['Encabezado EXACTO del Excel']
      const item = {
        proyecto_nombre: getSafeString(row['Nombre del Proyecto']),
        unidad: unidad, // Campo requerido
        unidad_codigo: getSafeString(row['N° Bien']),
        tipologia: getSafeString(row['Tipo']),
        piso: getSafeString(row['Piso']),
        orientacion: getSafeString(row['Orientación']),
        m2_utiles: toNumber(row['Sup. Útil']),
        m2_terraza: toNumber(row['Sup. terraza']),
        m2_totales: toNumber(row['Sup. total']),
        precio_uf: toNumber(row['Valor lista']),
        estado: normalizeEstado(getSafeString(row['Estado Bien'])), // Aseguramos que siempre tenga un valor válido
        estado_unidad: normalizeEstado(getSafeString(row['Estado Bien'])) // Mantenemos ambos campos sincronizados
      };

      // Verificar que tenemos los campos requeridos
      if (!item.proyecto_nombre) {
        console.warn('Fila sin nombre de proyecto:', row);
        return null;
      }

      return item;
    }).filter((item): item is NonNullable<typeof item> => 
      item !== null && 
      item.unidad !== null && 
      item.proyecto_nombre !== null
    );

    if (mappedData.length === 0) {
      const errorMsg = 'No se encontraron datos válidos para cargar. Asegúrese de que el archivo contiene las columnas requeridas y valores válidos.';
      toast.error(errorMsg);
      setSupabaseError(errorMsg);
      setIsUploadingToSupabase(false);
      return;
    }
    
    console.log('Datos mapeados para Supabase:', mappedData);

    try {
      const { data, error } = await supabase
        .from('stock_unidades')
        .upsert(mappedData, {
          onConflict: 'proyecto_nombre,unidad_codigo',
        });

      if (error) {
        console.error('Error de Supabase al hacer upsert:', error);
        throw error;
      }

      const successMsg = `¡Stock procesado! ${mappedData.length} unidades consideradas para carga/actualización en Supabase.`;
      setSupabaseSuccess(successMsg);
      toast.success(successMsg);
      console.log('Datos guardados/actualizados en Supabase:', data);

    } catch (error: any) {
      console.error('Error en el proceso de carga a Supabase:', error);
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