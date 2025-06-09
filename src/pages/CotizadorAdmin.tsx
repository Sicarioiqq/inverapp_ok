import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';

interface Unidad {
  id: string;
  proyecto_nombre: string | null;
  unidad: string | null;
  tipologia: string | null;
  tipo_bien: string | null;
  piso: string | null;
  orientacion: string | null;
  sup_util: number | null;
  sup_terraza: number | null;
  sup_total: number | null;
  valor_lista: number | null;
  estado_unidad: string | null;
  etapa: string | null;
}

const CotizadorAdmin: React.FC = () => {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProyecto, setSelectedProyecto] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');
  const [selectedUnidad, setSelectedUnidad] = useState<string>('');
  const [unidadInput, setUnidadInput] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnidades = async () => {
      setLoading(true);
      setError(null);
      try {
        let all: Unidad[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('stock_unidades')
            .select('*')
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        setUnidades(all);
      } catch (err: any) {
        setError('Error al cargar las unidades');
      } finally {
        setLoading(false);
      }
    };
    fetchUnidades();
  }, []);

  const proyectos = useMemo(() =>
    Array.from(new Set(unidades.map(u => u.proyecto_nombre).filter(Boolean))) as string[],
    [unidades]
  );

  const tipologias = useMemo(() => {
    if (!selectedProyecto) return [];
    return Array.from(new Set(
      unidades.filter(u => u.proyecto_nombre === selectedProyecto && u.tipologia && u.tipo_bien === 'DEPARTAMENTO')
        .map(u => u.tipologia as string)
    ));
  }, [unidades, selectedProyecto]);

  const bienes = useMemo(() => {
    if (!selectedProyecto || !selectedTipologia) return [];
    return Array.from(new Set(
      unidades.filter(u => u.proyecto_nombre === selectedProyecto && u.tipologia === selectedTipologia && u.unidad && u.tipo_bien === 'DEPARTAMENTO')
        .map(u => u.unidad as string)
    ));
  }, [unidades, selectedProyecto, selectedTipologia]);

  const unidadesFiltradas = useMemo(() => {
    return unidades.filter(u =>
      u.tipo_bien === 'DEPARTAMENTO' &&
      (!selectedProyecto || u.proyecto_nombre === selectedProyecto) &&
      (!selectedTipologia || u.tipologia === selectedTipologia) &&
      (!selectedUnidad || u.unidad === selectedUnidad) &&
      (!unidadInput || (u.unidad && u.unidad.toLowerCase().includes(unidadInput.toLowerCase())))
    );
  }, [unidades, selectedProyecto, selectedTipologia, selectedUnidad, unidadInput]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Cotizador Administración</h1>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedProyecto}
              onChange={e => {
                setSelectedProyecto(e.target.value);
                setSelectedTipologia('');
                setSelectedUnidad('');
              }}
            >
              <option value="">Todos</option>
              {proyectos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipología</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedTipologia}
              onChange={e => {
                setSelectedTipologia(e.target.value);
                setSelectedUnidad('');
              }}
              disabled={!selectedProyecto}
            >
              <option value="">Todas</option>
              {tipologias.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">N° Bien</label>
            <select
              className="w-full border rounded px-3 py-2 mb-1"
              value={selectedUnidad}
              onChange={e => setSelectedUnidad(e.target.value)}
              disabled={!selectedProyecto || !selectedTipologia}
            >
              <option value="">Todos</option>
              {bienes.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar N° bien manualmente</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="Buscar N° bien"
              value={unidadInput}
              onChange={e => setUnidadInput(e.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <span className="text-gray-500">Cargando unidades...</span>
          </div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Proyecto</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">N° Bien</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Tipología</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Tipo Bien</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Piso</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Sup. Útil</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Sup. Terraza</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Sup. Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Precio UF</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Estado</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Etapa</th>
                </tr>
              </thead>
              <tbody>
                {unidadesFiltradas.map(u => (
                  <tr key={u.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => navigate(`/calculo-comision-broker/${u.id}`)}>
                    <td className="px-3 py-2 whitespace-nowrap">{u.proyecto_nombre}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.unidad}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.tipologia}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.tipo_bien}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.piso}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.sup_util}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.sup_terraza}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.sup_total}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.valor_lista}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.estado_unidad}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{u.etapa}</td>
                  </tr>
                ))}
                {unidadesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-gray-500 py-6">No hay unidades para los filtros seleccionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CotizadorAdmin; 