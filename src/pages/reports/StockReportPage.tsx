// src/pages/reports/StockReportPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  const [stockData, setStockData]                 = useState<StockUnidad[]>([]);
  const [loading, setLoading]                     = useState<boolean>(true);
  const [error, setError]                         = useState<string | null>(null);
  const [activeTab, setActiveTab]                 = useState<'principales' | 'secundarios'>('principales');
  const [selectedProject, setSelectedProject]     = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');

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
          .order('unidad',         { ascending: true });

        if (fetchError) throw fetchError;
        setStockData(data ?? []);
      } catch (err: any) {
        setError(`Error al cargar el stock: ${err.message}`);
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, []);

  // Proyectos únicos
  const proyectos = useMemo(() => {
    return Array.from(
      new Set(stockData.map(u => u.proyecto_nombre).filter(Boolean))
    ) as string[];
  }, [stockData]);

  // Tipologías solo de DEPARTAMENTO, en cascada según proyecto
  const tipologias = useMemo(() => {
    if (!selectedProject) return [];
    return Array.from(
      new Set(
        stockData
          .filter(u =>
            u.proyecto_nombre === selectedProject &&
            u.tipo_bien === 'DEPARTAMENTO' &&
            u.tipologia
          )
          .map(u => u.tipologia as string)
      )
    );
  }, [stockData, selectedProject]);

  // Datos filtrados por proyecto/tipología
  const filtered = useMemo(() => {
    return stockData.filter(u => {
      if (selectedProject && u.proyecto_nombre !== selectedProject) return false;
      if (selectedTipologia && u.tipologia !== selectedTipologia) return false;
      return true;
    });
  }, [stockData, selectedProject, selectedTipologia]);

  // Separar en pestañas
  const principales = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');
  const secundarios = filtered.filter(u => u.tipo_bien !== 'DEPARTAMENTO');

  // Render de tabla
  const renderTable = (rows: StockUnidad[]) => (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {[
              'Proyecto', 'N° Bien', 'Tipo Bien', 'Tipología',
              'Piso', 'Sup. Útil', 'Precio UF', 'Estado', 'Etapa'
            ].map(header => (
              <th
                key={header}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map(item => (
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
                {item.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                {item.valor_lista?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <PackageSearch className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Informe de Stock</h1>
        </div>

        {/* Filtros */}
        <div className="bg-white shadow rounded-lg p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
            <select
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setSelectedTipologia(''); }}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {proyectos.map(proj => (
                <option key={proj} value={proj}>
                  {proj}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipología</label>
            <select
              value={selectedTipologia}
              onChange={e => setSelectedTipologia(e.target.value)}
              disabled={!selectedProject}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Todos</option>
              {tipologias.map(tip => (
                <option key={tip} value={tip}>
                  {tip}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pestañas */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('principales')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'principales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Principales
            </button>
            <button
              onClick={() => setActiveTab('secundarios')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'secundarios'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Secundarios
            </button>
          </nav>
        </div>

        {/* Contenido de pestañas */}
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
        ) : activeTab === 'principales' ? (
          renderTable(principales)
        ) : (
          renderTable(secundarios)
        )}
      </div>
    </Layout>
  );
};

export default StockReportPage;