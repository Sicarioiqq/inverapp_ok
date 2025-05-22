// src/pages/reports/StockReportPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { PackageSearch, AlertCircle, Loader2 } from 'lucide-react';

interface StockUnidad {
  id: string;
  created_at: string;
  proyecto_nombre: string | null;
  unidad: string | null;
  tipo_bien: string | null;
  tipologia: string | null;
  piso: string | null;
  orientacion: string | null;
  sup_util: number | null;
  sup_terraza: number | null;
  sup_total: number | null;
  valor_lista: number | null;
  estado_unidad: string | null;
  etapa: string | null;
}

const StockReportPage: React.FC = () => {
  const [stockData, setStockData] = useState<StockUnidad[]>([]);
  const [loading,   setLoading]   = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      setError(null);
      try {
        const columns = `
          id,
          created_at,
          proyecto_nombre,
          unidad,
          tipo_bien,
          tipologia,
          piso,
          orientacion,
          sup_util,
          sup_terraza,
          sup_total,
          valor_lista,
          estado_unidad,
          etapa
        `;
        const { data, error: fetchError } = await supabase
          .from('stock_unidades')
          .select(columns)
          .order('proyecto_nombre', { ascending: true })
          .order('unidad', { ascending: true });

        if (fetchError) throw fetchError;
        setStockData(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(`Error al cargar el stock: ${err.message}`);
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex items-center mb-6">
          <PackageSearch className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-800">Informe de Stock</h1>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            <span className="ml-3 text-lg text-gray-700">Cargando stock...</span>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="flex items-center text-red-600 mb-4">
              <AlertCircle className="h-8 w-8 mr-3" />
              <h1 className="text-2xl font-semibold">Error al Cargar Stock</h1>
            </div>
            <p className="text-red-700 bg-red-100 p-4 rounded-md">{error}</p>
          </div>
        ) : stockData.length === 0 ? (
          <p className="text-gray-600 text-lg">No hay unidades de stock disponibles para mostrar.</p>
        ) : (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Proyecto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    N° Bien
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tipo Bien
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tipología
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Piso
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sup. Útil
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Precio UF
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Etapa
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stockData.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.proyecto_nombre}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {item.unidad}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {item.tipo_bien}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {item.tipologia}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {item.piso}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                      {item.sup_util?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                      {item.valor_lista?.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.estado_unidad === 'Disponible'
                            ? 'bg-green-100 text-green-800'
                            : item.estado_unidad === 'Reservado'
                            ? 'bg-yellow-100 text-yellow-800'
                            : item.estado_unidad === 'Vendido'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.estado_unidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {item.etapa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StockReportPage;
