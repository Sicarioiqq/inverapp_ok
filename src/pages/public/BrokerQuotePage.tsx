// src/pages/public/BrokerQuotePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Home,
  SlidersHorizontal,
  Loader2,
  ShieldX,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface BrokerInfo {
  id: string;
  name: string | null;
}

interface Unidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipologia: string;
  piso: string | null;
  sup_util: number | null;
  valor_lista: number | null;
  descuento: number | null;
  estado_unidad: string | null;
  tipo_bien: string;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();

  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('principales');

  const [stock, setStock] = useState<Unidad[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [sortField, setSortField] = useState<keyof Unidad>('unidad');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
  const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // Validate broker
  useEffect(() => {
    const validate = async () => {
      if (!brokerSlug || !accessToken) {
        setError('Acceso inválido.');
        setIsValidating(false);
        return;
      }
      try {
        const { data, error: fe } = await supabase
          .from('brokers')
          .select('id, name')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken)
          .single();
        if (fe || !data) throw new Error('No autorizado');
        setBrokerInfo(data as BrokerInfo);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [brokerSlug, accessToken]);

  // Load full stock (all rows)
  useEffect(() => {
    if (!brokerInfo) return;
    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const { data, error: se } = await supabase
          .from<Unidad>('stock_unidades')
          .select('*');
        if (!se && data) setStock(data);
      } catch (e) {
        console.error('Error loading stock:', e);
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [brokerInfo]);

  // Derive filters
  const proyectos = Array.from(new Set(stock.map(u => u.proyecto_nombre))).sort();
  const tipologias = Array.from(new Set(
    stock
      .filter(u => filterProyecto === 'Todos' || u.proyecto_nombre === filterProyecto)
      .map(u => u.tipologia)
  )).sort();

  // Apply filters & sort
  const filtered = stock
    .filter(u => activeTab === 'principales'
      ? u.tipo_bien === 'DEPARTAMENTO'
      : activeTab === 'secundarios'
        ? u.tipo_bien !== 'DEPARTAMENTO'
        : true
    )
    .filter(u => filterProyecto === 'Todos' || u.proyecto_nombre === filterProyecto)
    .filter(u => filterTipologia === 'Todos' || u.tipologia === filterTipologia)
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  if (isValidating)
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin"/> Validando...</div>;
  if (error || !brokerInfo)
    return <div className="p-6 text-center"><ShieldX className="h-16 w-16 text-red-500 mx-auto"/><p className="mt-4 text-red-600">{error}</p></div>;

  const headersPrincipales = [
    { key: 'proyecto_nombre', label: 'Proyecto' },
    { key: 'unidad', label: 'N° Bien' },
    { key: 'tipologia', label: 'Tipología' },
    { key: 'piso', label: 'Piso' },
    { key: 'sup_util', label: 'Sup. Útil' },
    { key: 'valor_lista', label: 'Valor UF' },
    { key: 'descuento', label: 'Desc. (%)' },
    { key: 'estado_unidad', label: 'Estado' }
  ];
  const headersSecundarios = headersPrincipales.filter(h => h.key !== 'descuento');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo.name}</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <nav className="flex space-x-4 border-b mb-4">
          <button
            onClick={() => setActiveTab('principales')}
            className={activeTab==='principales' ? 'border-b-2 border-blue-600 pb-2' : 'pb-2 text-gray-500'}
          >
            <Home className="inline mr-1"/> Principales
          </button>
          <button
            onClick={() => setActiveTab('secundarios')}
            className={activeTab==='secundarios' ? 'border-b-2 border-blue-600 pb-2' : 'pb-2 text-gray-500'}
          >
            <LayoutDashboard className="inline mr-1"/> Secundarios
          </button>
          <button
            onClick={() => setActiveTab('configuracion')}
            className={activeTab==='configuracion' ? 'border-b-2 border-blue-600 pb-2' : 'pb-2 text-gray-500'}
          >
            <SlidersHorizontal className="inline mr-1"/> Configuración
          </button>
        </nav>

        {(activeTab === 'principales' || activeTab === 'secundarios') && (
          <div className="flex space-x-4 mb-4">
            <select
              value={filterProyecto}
              onChange={e => { setFilterProyecto(e.target.value); setFilterTipologia('Todos'); }}
              className="border p-2 rounded"
            >
              <option>Todos</option>
              {proyectos.map(p => <option key={p}>{p}</option>)}
            </select>
            <select
              value={filterTipologia}
              onChange={e => setFilterTipologia(e.target.value)}
              className="border p-2 rounded"
            >
              <option>Todos</option>
              {tipologias.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        )}

        {activeTab !== 'configuracion' && (
          <div className="overflow-x-auto bg-white shadow rounded">
            <table className="min-w-full">
              <thead className="bg-gray-200">
                <tr>
                  {(activeTab==='principales' ? headersPrincipales : headersSecundarios).map(h => (
                    <th
                      key={h.key}
                      className="px-4 py-2 text-left cursor-pointer"
                      onClick={() => {
                        if (sortField === h.key) setSortAsc(!sortAsc);
                        else { setSortField(h.key); setSortAsc(true); }
                      }}
                    >
                      <div className="flex items-center">
                        {h.label}
                        {sortField===h.key && (sortAsc ? <ArrowUp className="ml-1"/> : <ArrowDown className="ml-1"/>)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStock ? (
                  <tr><td colSpan={(activeTab==='principales'? headersPrincipales.length : headersSecundarios.length)} className="p-4 text-center"><Loader2 className="animate-spin"/> Cargando...</td></tr>
                ) : filtered.length===0 ? (
                  <tr><td colSpan={(activeTab==='principales'? headersPrincipales.length : headersSecundarios.length)} className="p-4 text-center text-gray-500">No hay unidades.</td></tr>
                ) : filtered.map(u => {
                  const netDesc = ((u.descuento ?? 0) * 100).toFixed(2);
                  return (
                    <tr
                      key={u.id}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedUnidad(u); setActiveTab('configuracion'); }}
                    >
                      <td className="px-4 py-2">{u.proyecto_nombre}</td>
                      <td className="px-4 py-2">{u.unidad}</td>
                      <td className="px-4 py-2">{u.tipologia}</td>
                      <td className="px-4 py-2">{u.piso||'-'}</td>
                      <td className="px-4 py-2 text-right">{u.sup_util?.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-2 text-right">{u.valor_lista?.toLocaleString(undefined,{minimumFractionDigits:0})}</td>
                      {activeTab==='principales' && <td className="px-4 py-2 text-right">{netDesc}%</td>}
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${u.estado_unidad==='Disponible'? 'bg-green-100 text-green-800': 'bg-gray-100 text-gray-800'}`}>{u.estado_unidad}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'configuracion' && (
          <div className="bg-white shadow rounded p-6 mt-6 space-y-8">
            <h2 className="text-xl font-semibold">Configuración de Cotización</h2>

            {/* Cliente */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cliente</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  placeholder="Nombre del Cliente"
                  className="mt-1 block w-full border border-blue-300 rounded-md bg-white p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RUT</label>
                <input
                  type="text"
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  placeholder="RUT del Cliente"
                  className="mt-1 block w-full border border-blue-300 rounded-md bg-white p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </section>

            {/* Proyecto */}
            <section>
              <h3 className="text-lg font-medium text-gray-800">Proyecto</h3>
              <p className="mt-1 text-gray-600">{selectedUnidad?.proyecto_nombre || '-'}</p>
            </section>

            {/* Unidad */}
            <section>
              <h3 className="text-lg font-medium text-gray-800">Unidad</h3>
              <p className="mt-1 text-gray-600">
                {selectedUnidad?.unidad || '-'} <span className="text-sm text-gray-500">({selectedUnidad?.estado_unidad || '-'})</span>
              </p>
              <p className="mt-1 text-gray-600">Tipología: {selectedUnidad?.tipologia || '-'}</p>
              <p className="mt-1 text-gray-600">Piso: {selectedUnidad?.piso || '-'}</p>
              <p className="mt-1 text-gray-600">Descuento: <span className="font-semibold">{selectedUnidad ? ((selectedUnidad.descuento || 0)*100).toFixed(2) + ' %' : '-'}</span></p>
              <p className="mt-1 text-gray-600">Valor Lista: <span className="font-semibold">{selectedUnidad?.valor_lista != null ? selectedUnidad.valor_lista + ' UF' : '-'}</span></p>
            </section>

            {/* Superficies */}
            <section>
              <h3 className="text-lg font-medium text