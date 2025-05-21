// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import { supabase } from '@/lib/supabase'; // Asegúrate de que esta importación funcione
import { toast } from 'react-hot-toast';

// Función auxiliar para convertir strings con coma (o sin ella) a números
const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (stringValue === '') return null;
  const normalizedStringValue = stringValue.replace(',', '.');
  const numberValue = parseFloat(normalizedStringValue);
  return isNaN(numberValue) ? null : numberValue;
};

// Función auxiliar para normalizar strings y manejar 'EMPTY' u otros placeholders
const getSafeString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return (str === 'EMPTY' || str === '') ? null : str;
};

// Función para normalizar el estado de la unidad
const normalizeEstado = (estado: string | null): string => {
  if (!estado) return 'Disponible';
  const estadoNormalizado = estado.trim().toLowerCase();
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
  return estadosValidos[estadoNormalizado] || 'Disponible';
};

const CotizadorSettings: React.FC = () => {
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseSuccess, setSupabaseSuccess] = useState<string | null>(null);

  const handleStockDataUploaded = async (dataFromExcel: any[]) => {
    console.log('Datos crudos del Excel recibidos:', dataFromExcel.length, "filas");
    setSupabaseError(null);
    setSupabaseSuccess(null);

    if (!dataFromExcel || dataFromExcel.length === 0) {
      toast.error('No hay datos para cargar desde el archivo Excel.');
      return;
    }

    setIsUploadingToSupabase(true);

    const mappedData = dataFromExcel
      .map((row, index) => {
        const proyectoNombre = getSafeString(row['Nombre del Proyecto']);
        // Usar 'N° Bien' como fuente principal para unidad_codigo.
        const unidadCodigo = getSafeString(row['N° Bien']);

        // Solo omitir si falta información esencial para la UNIQUE constraint
        if (!proyectoNombre || !unidadCodigo) {
          console.warn(`Fila ${index + 2} omitida del Excel: Falta Nombre del Proyecto o N° Bien. Proyecto: '${proyectoNombre}', N° Bien: '${unidadCodigo}'`, row);
          return null;
        }

        // Mapeo: Columna Supabase : row['Encabezado EXACTO del Excel']
        return {
          proyecto_nombre: proyectoNombre,
          unidad_codigo: unidadCodigo, // Columna que existe en tu tabla Supabase
          tipologia: getSafeString(row['Tipo']), // Asumo 'Tipo' del Excel es la 'tipologia' (ej. 2D+2B)
          piso: getSafeString(row['Piso']),
          orientacion: getSafeString(row['Orientación']),
          m2_utiles: toNumber(row['Sup. Útil']),
          m2_terraza: toNumber(row['Sup. terraza']),
          m2_totales: toNumber(row['Sup. total']),
          precio_uf: toNumber(row['Valor lista']),
          estado_unidad: normalizeEstado(getSafeString(row['Estado Bien'])),
          // Si quieres incluir 'Tipo Bien' (DEPARTAMENTO, ESTACIONAMIENTO) como una columna separada
          // en Supabase, primero añade la columna a la tabla (ej. tipo_bien_excel TEXT)
          // y luego mapea aquí:
          // tipo_bien_excel: getSafeString(row['Tipo Bien']),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (mappedData.length === 0) {
      const errorMsg = 'No se encontraron datos válidos para cargar (Nombre del Proyecto y N° Bien son requeridos en cada fila).';
      toast.error(errorMsg);
      setSupabaseError(errorMsg);
      setIsUploadingToSupabase(false);
      return;
    }
    
    const rowsOmitted = dataFromExcel.length - mappedData.length;
    if (rowsOmitted > 0) {
      console.log(`Se omitieron ${rowsOmitted} filas del Excel por falta de datos clave (Nombre del Proyecto o N° Bien).`);
    }

    console.log(`Preparando para cargar/actualizar ${mappedData.length} unidades a Supabase.`);
    // console.log('Muestra de datos mapeados (primeros 3):', JSON.stringify(mappedData.slice(0, 3), null, 2));


    try {
      // **IMPORTANTE**: 'onConflict' debe coincidir con tu UNIQUE constraint en la tabla 'stock_unidades'.
      // Si tu constraint es UNIQUE(proyecto_nombre, unidad_codigo), entonces usa 'proyecto_nombre,unidad_codigo'.
      const { data, error } = await supabase
        .from('stock_unidades')
        .upsert(mappedData, {
          onConflict: 'proyecto_nombre,unidad_codigo', // AJUSTA ESTO SI TU CONSTRAINT ES DIFERENTE
        });

      if (error) {
        console.error('Error de Supabase al hacer upsert:', error);
        throw error;
      }

      let successMsg = `¡Stock procesado! ${mappedData.length} unidades consideradas para carga/actualización en Supabase.`;
      if (rowsOmitted > 0) {
        successMsg += ` Se omitieron ${rowsOmitted} filas del archivo Excel.`;
      }
      setSupabaseSuccess(successMsg);
      toast.success(successMsg);
      console.log('Respuesta de Supabase (upsert):', data);

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