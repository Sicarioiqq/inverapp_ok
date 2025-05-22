// src/pages/reports/StockReportPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Usando la ruta relativa que te funcionó
import { PackageSearch, AlertCircle, Loader2 } from 'lucide-react';

// Interfaz ajustada a las columnas probables de tu tabla 'stock_unidades'
// y las que son más relevantes para un informe de stock.
interface StockUnidad {
  id: string;
  created_at: string;
  proyecto_nombre: string | null;
  unidad_codigo: string | null; // Asumiendo que 'unidad' en tu mapeo se guarda como 'unidad_codigo'
  tipo_bien: string | null;     // Columna del Excel 'Tipo Bien'
  tipologia: string | null;     // Columna del Excel 'Tipo' (ej. 2D+2B)
  piso: string | null;
  orientacion: string | null;
  m2_utiles: number | null;    // Corresponde a 'Sup. Útil'
  m2_terraza: number | null;   // Corresponde a 'Sup. terraza'
  m2_totales: number | null;   // Corresponde a 'Sup. total'
  precio_uf: number | null;    // Corresponde a 'Valor lista'
  estado_unidad: string | null;
  etapa: string | null;         // Columna del Excel 'Etapa'
  // Añade más columnas si las tienes en la tabla y quieres mostrarlas
}

const StockReportPage: React.FC = () => {
  const [stockData, setStockData] = useState<StockUnidad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Asegúrate de que los nombres de columna en .select() coincidan con tu tabla 'stock_unidades'
        const { data, error: fetchError } = await supabase
          .from('stock_unidades')
          .select(`
            id, 
            created_at,
            proyecto_nombre, 
            unidad_codigo, 
            tipo_bien, 
            tipologia, 
            piso, 
            orientacion, 
            m2_utiles, 
            m2_terraza, 
            m2_totales, 
            precio_uf, 
            estado_unidad,
            etapa 
          `) // Columnas a seleccionar
          .order('proyecto_nombre', { ascending: true })
          .order('unidad_codigo', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }
        setStockData(data || []);
      } catch (err: any) {
        console.error('Error fetching stock data:', err);
        setError(`Error al cargar el stock: ${err.message}`);
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-lg text-gray-700">Cargando stock...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="h-8 w-8 mr-3" />
          <h1 className="text-2xl font-semibold">Error al Cargar Stock</h1>
        </div>
        <p className="text-red-700 bg-red-100 p-4 rounded-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <PackageSearch className="h-8 w-8 text-blue-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-800">Informe de Stock</h1>
      </div>

      {stockData.length === 0 ? (
        <p className="text-gray-600 text-lg">No hay unidades de stock disponibles para mostrar.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {/* Define las cabeceras de tu tabla */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Proyecto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">N° Bien</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo Bien</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipología</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Piso</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sup. Útil</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio UF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Etapa</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.proyecto_nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.unidad_codigo}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.tipo_bien}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.tipologia}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.piso}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{item.m2_utiles?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{item.precio_uf?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.estado_unidad === 'Disponible' ? 'bg-green-100 text-green-800' :
                      item.estado_unidad === 'Reservado' ? 'bg-yellow-100 text-yellow-800' :
                      item.estado_unidad === 'Vendido' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.estado_unidad}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.etapa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockReportPage;