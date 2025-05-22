// src/pages/reports/StockReportPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Usando la ruta relativa que te funcionó
import { PackageSearch } from 'lucide-react'; // Ícono para la página de stock

// Define una interfaz para la estructura de tus datos de stock
// Asegúrate que coincida con las columnas de tu tabla 'stock_unidades'
// y los datos que insertaste desde CotizadorSettings.tsx
interface StockUnidad {
  id: string; // O el tipo de tu ID, usualmente uuid
  created_at: string;
  proyecto_nombre: string | null;
  unidad_codigo: string | null; // Cambiado de 'unidad' a 'unidad_codigo' para coincidir con la tabla
  tipo_bien: string | null; // Añadido, basado en tu último CotizadorSettings.tsx
  tipologia: string | null;
  etapa: string | null; // Añadido
  piso: string | null;
  orientacion: string | null;
  valor_lista: number | null; // Añadido
  descuento: number | null; // Añadido
  sup_interior: number | null; // Añadido
  sup_util: number | null; // Cambiado de 'm2_utiles' a 'sup_util'
  sup_terraza: number | null; // Cambiado de 'm2_terraza' a 'sup_terraza'
  sup_ponderada: number | null; // Añadido
  sup_terreno: number | null; // Añadido
  sup_jardin: number | null; // Añadido
  sup_total: number | null; // Cambiado de 'm2_totales' a 'sup_total'
  sup_logia: number | null; // Añadido
  estado_unidad: string | null;
  // ... puedes añadir más columnas que quieras mostrar o usar
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
        // Selecciona las columnas que realmente necesitas mostrar.
        // El nombre de columna 'unidad' en tu CotizadorSettings.tsx se llamaba unidad_codigo en la tabla.
        // Asegúrate de que los nombres de columna aquí coincidan con tu tabla 'stock_unidades'.
        const { data, error: fetchError } = await supabase
          .from('stock_unidades') // Nombre exacto de tu tabla
          .select(`
            id,
            created_at,
            proyecto_nombre,
            unidad_codigo, 
            tipo_bien, 
            tipologia,
            etapa,
            piso,
            orientacion,
            sup_util,    
            sup_terraza, 
            sup_total,   
            valor_lista, 
            estado_unidad
          `) // Lista las columnas que quieres obtener
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
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-3 text-lg text-gray-700">Cargando stock...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-red-600 mb-4">Error al Cargar Stock</h1>
        <p className="text-red-500 bg-red-100 p-4 rounded-md">{error}</p>
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
        <p className="text-gray-600 text-lg">No hay unidades de stock disponibles.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad (N° Bien)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Bien</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipología</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piso</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sup. Útil</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sup. Terraza</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.proyecto_nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.unidad_codigo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.tipo_bien}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.tipologia}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.piso}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{item.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{item.sup_terraza?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{item.valor_lista?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.estado_unidad === 'Disponible' ? 'bg-green-100 text-green-800' :
                      item.estado_unidad === 'Reservado' ? 'bg-yellow-100 text-yellow-800' :
                      item.estado_unidad === 'Vendido' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800' // Para 'No Disponible' u otros
                    }`}>
                      {item.estado_unidad}
                    </span>
                  </td>
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