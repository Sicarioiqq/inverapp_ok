// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import { supabase } from '../../lib/supabase';

// Función auxiliar para convertir strings con coma (o sin ella) a números
const toNumber = (value: any): number | null => {
  if (value == null) return null;
  const s = String(value).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// Función auxiliar para normalizar strings y manejar 'EMPTY'
const getSafeString = (value: any): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return (s === '' || s.toUpperCase() === 'EMPTY') ? null : s;
};

// Función para mapear el campo "Bloqueado" a los valores permitidos por el CHECK en la DB
const normalizeEstado = (raw: string | null): string => {
  if (!raw) return 'Disponible';
  const val = raw.trim().toLowerCase();
  // Ajusta estas reglas según los valores reales de tu Excel:
  if (['sí', 'si', 'true', '1'].includes(val)) {
    return 'No Disponible';
  }
  // Asumimos que cualquier otra cosa implica Disponible
  return 'Disponible';
};

const CotizadorSettings: React.FC = () => {
  const [isUploading, setIsUploading]     = useState(false);
  const [supabaseError, setSupabaseError] = useState<string|null>(null);
  const [supabaseSuccess, setSupabaseSuccess] = useState<string|null>(null);

  const handleStockDataUploaded = async (dataFromExcel: any[]) => {
    setSupabaseError(null);
    setSupabaseSuccess(null);

    if (!dataFromExcel?.length) {
      setSupabaseError('No hay datos para cargar desde el archivo Excel.');
      return;
    }
    setIsUploading(true);

    try {
      // 1) Mappear filas
      const mapped = dataFromExcel
        .map(row => {
          const proyecto_nombre = getSafeString(row['Nombre del Proyecto']);
          const unidad          = getSafeString(row['N° Bien']);
          const tipologia       = getSafeString(row['Tipo']);
          const tipo_bien       = getSafeString(row['Tipo Bien']);
          const etapa           = getSafeString(row['Etapa']);
          const piso            = getSafeString(row['Piso']);
          const orientacion     = getSafeString(row['Orientación']);

          // valores numéricos
          const valor_lista   = toNumber(row['Valor lista']);
          const descuento     = toNumber(row['Descuento autorizado']);
          const sup_interior  = toNumber(row['Sup. Interior']);
          const sup_util      = toNumber(row['Sup. Útil']);
          const sup_terraza   = toNumber(row['Sup. terraza']);
          const sup_ponderada = toNumber(row['Sup. ponderada']);
          const sup_terreno   = toNumber(row['Sup. terreno']);
          const sup_jardin    = toNumber(row['Sup. jardín']);
          const sup_total     = toNumber(row['Sup. total']);
          const sup_logia     = toNumber(row['Sup. logia']);

          // estado unida a partir de Bloqueado
          const rawBloq       = getSafeString(row['Bloqueado']);
          const estado_unidad = normalizeEstado(rawBloq);

          // validar campos clave
          if (!proyecto_nombre || !unidad || !tipo_bien) {
            console.warn('Fila incompleta:', row);
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
        .filter((x): x is NonNullable<typeof x> =>
          !!x.proyecto_nombre && !!x.unidad && !!x.tipo_bien
        );

      if (!mapped.length) {
        setSupabaseError(
          'No se encontraron filas válidas con Proyecto, N° Bien y Tipo Bien.'
        );
        return;
      }

      console.log('Mapped:', mapped);

      // 2) Detección de duplicados en el Excel
      const seen = new Set<string>();
      const dupes = mapped.filter(item => {
        const key = `${item.proyecto_nombre}:${item.unidad}:${item.tipo_bien}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (dupes.length) {
        setSupabaseError(
          `Hay ${dupes.length} registros duplicados en el Excel. Corrige y reintenta.`
        );
        console.warn('Duplicados:', dupes);
        return;
      }

      // 3) Upsert en Supabase
      const { data, error } = await supabase
        .from('stock_unidades')
        .upsert(mapped, {
          onConflict: 'proyecto_nombre,unidad,tipo_bien'
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setSupabaseSuccess(
        `¡Carga exitosa! ${mapped.length} unidades procesadas.`
      );
      console.log('Upsert result:', data);

    } catch (err: any) {
      console.error('Error en carga:', err);
      setSupabaseError(`Error en el proceso de carga: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Configuración del Cotizador
        </h2>
        <p className="text-gray-600">
          Carga inicial de stock de unidades.
        </p>
      </div>

      <StockUploadCard onDataUpload={handleStockDataUploaded} />

      {isUploading && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-md flex items-center animate-pulse">
          <svg
            className="animate-spin h-5 w-5 mr-3"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Cargando datos...
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
