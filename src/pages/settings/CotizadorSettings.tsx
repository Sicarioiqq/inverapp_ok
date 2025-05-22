// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import { supabase } from '../../lib/supabase';

// Función auxiliar para convertir strings con coma (o sin ella) a números
const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (stringValue === '') return null;
  const normalized = stringValue.replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
};

// Función auxiliar para normalizar strings y manejar 'EMPTY'
const getSafeString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return (str === 'EMPTY' || str === '') ? null : str;
};

const CotizadorSettings: React.FC = () => {
  const [isUploadingToSupabase, setIsUploadingToSupabase] = useState<boolean>(false);
  const [supabaseError, setSupabaseError]           = useState<string | null>(null);
  const [supabaseSuccess, setSupabaseSuccess]       = useState<string | null>(null);

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
      // 1) Mapear columnas
      const mappedData = dataFromExcel
        .map(row => {
          const proyecto_nombre = getSafeString(row['Nombre del Proyecto']);
          const unidad          = getSafeString(row['N° Bien']);
          const tipologia       = getSafeString(row['Tipo']);
          const tipo_bien       = getSafeString(row['Tipo Bien']);
          const piso            = getSafeString(row['Piso']);
          const orientacion     = getSafeString(row['Orientación']);
          const etapa           = getSafeString(row['Etapa']);
          const valor_lista     = toNumber(row['Valor lista']);
          const descuento       = toNumber(row['Descuento autorizado']);
          const sup_interior    = toNumber(row['Sup. Interior']);
          const sup_util        = toNumber(row['Sup. Útil']);
          const sup_terraza     = toNumber(row['Sup. terraza']);
          const sup_ponderada   = toNumber(row['Sup. ponderada']);
          const sup_terreno     = toNumber(row['Sup. terreno']);
          const sup_jardin      = toNumber(row['Sup. jardín']);
          const sup_total       = toNumber(row['Sup. total']);
          const sup_logia       = toNumber(row['Sup. logia']);
          const estado_unidad   = getSafeString(row['Bloqueado']) || 'Disponible';

          // 2) Validar campos clave
          if (!proyecto_nombre || !unidad || !tipo_bien) {
            console.warn('Fila incompleta (Proyecto, Unidad o Tipo Bien faltante):', row);
            return null;
          }

          return {
            proyecto_nombre,
            unidad,
            tipo_bien,
            tipologia,
            etapa,
            piso,
            orientacion,
            valor_lista,
            descuento,
            sup_interior,
            sup_util,
            sup_terraza,
            sup_ponderada,
            sup_terreno,
            sup_jardin,
            sup_total,
            sup_logia,
            estado_unidad,
          };
        })
        .filter((item): item is NonNullable<typeof item> =>
          !!item &&
          !!item.proyecto_nombre &&
          !!item.unidad &&
          !!item.tipo_bien
        );

      if (mappedData.length === 0) {
        setSupabaseError(
          'No se encontraron datos válidos (con "Nombre del Proyecto", "N° Bien" y "Tipo Bien") para cargar.'
        );
        setIsUploadingToSupabase(false);
        return;
      }

      console.log('Datos mapeados para Supabase:', mappedData);

      // 3) Detectar duplicados en el Excel
      const uniqueKeys = new Set<string>();
      const duplicates = mappedData.filter(item => {
        const key = `${item.proyecto_nombre}:${item.unidad}:${item.tipo_bien}`;
        if (uniqueKeys.has(key)) return true;
        uniqueKeys.add(key);
        return false;
      });

      if (duplicates.length > 0) {
        console.warn('Se encontraron duplicados en el Excel:', duplicates);
        setSupabaseError(
          `Se encontraron ${duplicates.length} registros duplicados en el Excel. Corrija los datos y reintente.`
        );
        setIsUploadingToSupabase(false);
        return;
      }

      // 4) Upsert en Supabase usando la constraint única (proyecto_nombre, unidad, tipo_bien)
      const { data, error } = await supabase
        .from('stock_unidades')
        .upsert(mappedData, {
          onConflict: 'proyecto_nombre,unidad,tipo_bien',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      setSupabaseSuccess(
        `¡Stock procesado! ${mappedData.length} unidades cargadas/actualizadas correctamente.`
      );
      console.log('Datos guardados/actualizados en Supabase:', data);

    } catch (err: any) {
      console.error('Error en el proceso de carga a Supabase:', err);
      setSupabaseError(`Error en el proceso de carga: ${err.message || 'Error desconocido.'}`);
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
          <svg
            className="animate-spin h-5 w-5 mr-3 text-blue-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
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
