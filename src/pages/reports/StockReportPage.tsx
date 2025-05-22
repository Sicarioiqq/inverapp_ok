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

const PAGE_SIZE = 1000;

const StockReportPage: React.FC = () => {
  const [data, setData] = useState<StockUnidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'principales' | 'secundarios'>('todos');
  const [projFilter, setProjFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        let from = 0;
        const all: StockUnidad[] = [];
        const cols = [
          'id', 'created_at', 'proyecto_nombre', 'unidad',
          'tipo_bien', 'tipologia', 'piso', 'orientacion',
          'sup_util', 'sup_terraza', 'sup_total', 'valor_lista',
          'estado_unidad', 'etapa'
        ].join(',');
        while (true) {
          const to = from + PAGE_SIZE - 1;
          const { data: page, error: fetchErr } = await supabase
            .from<StockUnidad>('stock_unidades')
            .select(cols)
            .order('proyecto_nombre')
            .order('unidad')
            .range(from, to);
          if (fetchErr) throw fetchErr;
          if (!page || !page.length) break;
          all.push(...page);
          if (page.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        setData(all);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const projects = useMemo(
    () => Array.from(new Set(data.map(u => u.proyecto_nombre).filter(Boolean))) as string[],
    [data]
  );

  const tiposDepto = useMemo(() => {
    if (!projFilter) return [];
    return Array.from(new Set(
      data
      .filter(u => u.proyecto_nombre === projFilter && u.tipo_bien === 'DEPARTAMENTO' && u.tipologia)
      .map(u => u.tipologia as string)
    ));
  }, [data, projFilter]);

  const filtered = useMemo(() => data.filter(u =>
    (!projFilter || u.proyecto_nombre === projFilter) &&
    (!tipoFilter || u.tipologia === tipoFilter)
  ), [data, projFilter, tipoFilter]);

  const principales = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');
  const secundarios = filtered.filter(u => u.tipo_bien !== 'DEPARTAMENTO');

  // Group rows by project
  const groupByProject = (rows: StockUnidad[]) => {
    return rows.reduce<Record<string, StockUnidad[]>>((acc, cur) => {
      const key = cur.proyecto_nombre || 'Sin Proyecto';
      acc[key] = acc[key] || [];
      acc[key].push(cur);
      return acc;
    }, {});
  };

  const renderAccordion = (rows: StockUnidad[]) => {
    const groups = groupByProject(rows);
    return (
      <div className="space-y-2">
        {Object.entries(groups).map(([proj, items]) => (
          <details key={proj} className="bg-white shadow rounded-lg">
            <summary className="px-4 py-2 font-medium cursor-pointer">
              {proj} — {items.length} unidad{items.length > 1 ? 'es' : ''}
            </summary>
            <div className="px-4 pb-2">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th>Unidad</th>
                    <th>Tipología</th>
                    <th>Piso</th>
                    <th>Sup. Útil</th>
                    <th>Precio UF</th>
                    <th>Estado</th>
                    <th>Etapa</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1">{u.unidad}</td>
                      <td className="px-2 py-1">{u.tipologia}</td>
                      <td className="px-2 py-1">{u.piso}</td>
                      <td className="px-2 py-1 text-right">{u.sup_util?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="px-2 py-1 text-right">{u.valor_lista?.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
                      <td className="px-2 py-1">
                        <span className={`px-2 rounded-full text-xs font-semibold ${
                          u.estado_unidad==='Disponible'? 'bg-green-100 text-green-800':
                          u.estado_unidad==='Reservado'?   'bg-yellow-100 text-yellow-800':
                          u.estado_unidad==='Vendido'?     'bg-red-100 text-red-800':'bg-gray-100 text-gray-800'}
                        }>
                          {u.estado_unidad}
                        </span>
                      </td>
                      <td className="px-2 py-1">{u.etapa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <PackageSearch className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Informe de Stock</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
            <select
              value={projFilter}
              onChange={e => { setProjFilter(e.target.value); setTipoFilter(''); setActiveTab('todos'); }}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipología (Deptos)</label>
            <select
              value={tipoFilter}
              onChange={e => { setTipoFilter(e.target.value); setActiveTab('principales'); }}
              disabled={!projFilter}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Todos</option>
              {tiposDepto.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex space-x-6 bg-white shadow rounded-lg p-4">
          <div>
            <p className="text-sm text-gray-500">Total Unidades</p>
            <p className="text-2xl font-semibold text-gray-800">{filtered.length}</p>
          </div>
          {activeTab !== 'todos' && (
            <div>
              <p className="text-sm text-gray-500">{activeTab==='principales'?'Departamentos':'Otros'}</p>
              <p className="text-2xl font-semibold text-gray-800">
                {activeTab==='principales'? principales.length : secundarios.length}
              </p>
            </div>
          )}
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['todos','principales','secundarios'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab===tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab==='todos'?'Todos':tab==='principales'?'Principales':'Secundarios'}
              </button>
            ))}
          </nav>
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
        ) : activeTab==='todos' ? (
          renderAccordion(filtered)
        ) : activeTab==='principales' ? (
          renderAccordion(principales)
        ) : (
          renderAccordion(secundarios)
        )}
      </div>
    </Layout>
  );
};

export default StockReportPage;
