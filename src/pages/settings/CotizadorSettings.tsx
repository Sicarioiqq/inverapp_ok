// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import BrokerCommissionsConfig from './components/BrokerCommissionsConfig'; // <-- 1. IMPORTA EL NUEVO COMPONENTE
import { supabase } from '../../lib/supabase'; // Usando la ruta relativa que te funcionó
import { toast } from 'react-hot-toast';

// ... (tus funciones auxiliares toNumber, getSafeString, normalizeEstado se mantienen igual) ...
const toNumber = (value: any): number | null => {
  if (value == null) return null;
  const s = String(value).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const getSafeString = (value: any): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return (s === '' || s.toUpperCase() === 'EMPTY') ? null : s;
};
const normalizeEstado = (raw: string | null): string => {
  if (!raw) return 'Disponible';
  const val = raw.trim().toLowerCase();
  if (['sí', 'si', 'true', '1', 'bloqueado'].includes(val)) {
    return 'No Disponible';
  }
  return 'Disponible';
};


const CotizadorSettings: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false); // Para la carga de stock
  const [supabaseError, setSupabaseError] = useState<string | null>(null); // Para errores de carga de stock
  const [supabaseSuccess, setSupabaseSuccess] = useState<string | null>(null); // Para éxito de carga de stock

  const handleStockDataUploaded = async (dataFromExcel: any[]) => {
    setSupabaseError(null);
    setSupabaseSuccess(null);

    if (!dataFromExcel?.length) {
      // toast.error en lugar de setSupabaseError para mensajes más efímeros
      toast.error('No hay datos para cargar desde el archivo Excel.');
      return;
    }
    setIsUploading(true);

    // 1) Mapeo y validación (tu lógica existente)
    const mapped = dataFromExcel
      .map(row => {
        const proyecto_nombre = getSafeString(row['Nombre del Proyecto']);
        const unidad          = getSafeString(row['N° Bien']);
        const tipologia       = getSafeString(row['Tipo']);
        const tipo_bien       = getSafeString(row['Tipo Bien']);
        const etapa           = getSafeString(row['Etapa']);
        const piso            = getSafeString(row['Piso']);
        const orientacion     = getSafeString(row['Orientación']);
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
        const rawBloq         = getSafeString(row['Bloqueado']);
        const estado_unidad   = normalizeEstado(rawBloq);

        if (!proyecto_nombre || !unidad || !tipo_bien) {
          console.warn('Fila incompleta (Proyecto, Unidad o Tipo Bien faltante):', row);
          return null;
        }
        return {
          proyecto_nombre, unidad, tipo_bien, tipologia, etapa, piso, orientacion,
          valor_lista, descuento, sup_interior, sup_util, sup_terraza, sup_ponderada,
          sup_terreno, sup_jardin, sup_total, sup_logia, estado_unidad,
        };
      })
      .filter((x): x is NonNullable<typeof x> =>
        !!x && !!x.proyecto_nombre && !!x.unidad && !!x.tipo_bien // Añadí !!x para asegurar que x no sea null
      );

    if (!mapped.length) {
        const errorMsg = 'No se encontraron filas válidas con Proyecto, N° Bien y Tipo Bien.';
        setSupabaseError(errorMsg); // Puedes usar setSupabaseError o toast.error
        toast.error(errorMsg);
        setIsUploading(false);
        return;
    }

    // 2) Detección de duplicados en el Excel (tu lógica existente)
    const seen = new Set<string>();
    const dupes = mapped.filter(item => {
      const key = `${item.proyecto_nombre}:${item.unidad}:${item.tipo_bien}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });

    if (dupes.length) {
      const errorMsg = `Hay ${dupes.length} registros duplicados en el Excel (misma combinación de Proyecto, N° Bien y Tipo Bien). Corrige y reintenta.`;
      setSupabaseError(errorMsg);
      toast.error(errorMsg);
      console.warn('Duplicados encontrados en el archivo:', dupes);
      setIsUploading(false);
      return;
    }

    try {
      // 3) Borra todo el contenido actual
      console.log('Borrando stock existente...');
      const { error: deleteError } = await supabase
        .from('stock_unidades')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Condición para borrar todo que no sea un UUID inválido
      if (deleteError) {
        console.error('Error al borrar stock:', deleteError);
        throw deleteError;
      }
      console.log('Stock anterior eliminado.');

      // 4) Inserta todos los registros nuevos
      console.log(`Insertando ${mapped.length} nuevas unidades...`);
      const { data, error: insertError } = await supabase
        .from('stock_unidades')
        .insert(mapped);
      if (insertError) {
        console.error('Error al insertar nuevo stock:', insertError);
        throw insertError;
      }

      const successMsg = `¡Stock reemplazado! ${mapped.length} unidades cargadas.`;
      setSupabaseSuccess(successMsg);
      toast.success(successMsg);
      console.log('Resultado de la inserción:', data);

    } catch (err: any) {
      console.error('Error en el proceso de carga de stock:', err);
      const errorMsg = `Error en el proceso de carga de stock: ${err.message || 'Error desconocido.'}`;
      setSupabaseError(errorMsg); // Muestra el error en la UI
      toast.error(errorMsg); // También como toast
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-10"> {/* Aumenté el space-y para separar las tarjetas */}
      {/* Sección de Carga de Stock */}
      <div>
        <div className="mb-6"> {/* Contenedor para título y párrafo de carga de stock */}
          <h2 className="text-2xl font-semibold mb-2 text-gray-800">
            Configuración del Cotizador
          </h2>
          <p className="text-gray-600">
            Carga inicial de stock de unidades (reemplaza todo el stock existente).
          </p>
        </div>

        <StockUploadCard onDataUpload={handleStockDataUploaded} />

        {isUploading && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-md flex items-center animate-pulse">
            <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Cargando datos de stock...
          </div>
        )}
        {supabaseError && ( // Error específico para la carga de stock
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            <strong>Error en carga de stock:</strong> {supabaseError}
          </div>
        )}
        {supabaseSuccess && ( // Éxito específico para la carga de stock
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
            {supabaseSuccess}
          </div>
        )}
      </div>

      <hr className="my-10 border-gray-300" /> {/* Divisor entre secciones */}

      {/* Sección de Configuración de Comisiones de Broker */}
      <div> {/* No necesitas otro div con mb-6 si BrokerCommissionsConfig ya tiene su propio título */}
        <BrokerCommissionsConfig /> {/* <-- 2. AÑADE EL NUEVO COMPONENTE AQUÍ */}
      </div>
    </div>
  );
};

export default CotizadorSettings;