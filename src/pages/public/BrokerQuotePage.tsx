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

  // Stock and filters state
  const [stock, setStock] = useState<Unidad[]>([]);
  const [filtered, setFiltered] = useState<Unidad[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [typologies, setTypologies] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTip, setSelectedTip] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Unidad>('proyecto_nombre');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  // Commission map by project
  const [commissions, setCommissions] = useState<Record<string, number>>({});

  // Selected unidad for configuration
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  // Configuration form
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // Validate broker and load commissions
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
        if (fe || !data) throw fe || new Error('No autorizado');
        setBrokerInfo(data as BrokerInfo);

        const { data: commData, error: ce } = await supabase
          .from('broker_project_commissions')
          .select('project_name, commission_rate')
          .eq('broker_id', data.id);
        if (ce) throw ce;
        const map: Record<string, number> = {};
        commData?.forEach(c => { map[c.project_name] = c.commission_rate; });
        setCommissions(map);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [brokerSlug, accessToken]);

  // Load full stock with pagination
  useEffect(() => {
    if (!brokerInfo) return;
    const load = async () => {
      setLoadingStock(true);
      try {
        const pageSize = 1000;
        let from = 0;
        const all: Unidad[] = [];
        while (true) {
          const to = from + pageSize - 1;
          const { data, error: se } = await supabase
            .from<Unidad>('stock_unidades')
            .select(
              'id, proyecto_nombre, unidad, tipologia, piso, sup_util, valor_lista, descuento, estado_unidad, tipo_bien'
            )
            .range(from, to);
          if (se) throw se;
          if (data?.length) {
            all.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          } else break;
        }
        setStock(all);
        setProjects(
          Array.from(new Set(all.map(u => u.proyecto_nombre))).sort()
        );
      } catch (e) {
        console.error('Error loading stock:', e);
      } finally {
        setLoadingStock(false);
      }
    };
    load();
  }, [brokerInfo]);

  // Filter, cascade typology, hide net discount < 0, sort
  useEffect(() => {
    let arr = [...stock];
    if (activeTab === 'principales') arr = arr.filter(u => u.tipo_bien === 'DEPARTAMENTO');
    if (activeTab === 'secundarios') arr = arr.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
    if (selectedProject) arr = arr.filter(u => u.proyecto_nombre === selectedProject);

    const types = Array.from(new Set(arr.map(u => u.tipologia))).sort();
    setTypologies(types);

    if (selectedTip) arr = arr.filter(u => u.tipologia === selectedTip);

    // compute net percentage and hide < 0
    arr = arr.filter(u => {
      const basePct = (u.descuento ?? 0) * 100;
      const comm = commissions[u.proyecto_nombre] ?? 0;
      return basePct - comm >= 0;
    });

    arr.sort((a, b) => {
      const fa = (a[sortField] ?? '') as string | number;
      const fb = (b[sortField] ?? '') as string | number;
      return fa < fb ? (sortAsc ? -1 : 1) : fa > fb ? (sortAsc ? 1 : -1) : 0;
    });
    setFiltered(arr);
  }, [stock, activeTab, selectedProject, selectedTip, sortField, sortAsc, commissions]);

  const headers = activeTab === 'principales'
    ? [
      { key: 'proyecto_nombre', label: 'Proyecto' },
      { key: 'unidad', label: 'N° Bien' },
      { key: 'tipologia', label: 'Tipología' },
      { key: 'piso', label: 'Piso' },
      { key: 'sup_util', label: 'Sup. Útil' },
      { key: 'valor_lista', label: 'Valor Lista (UF)' },
      { key: 'descuento', label: 'Descuento Neto (%)' },
      { key: 'estado_unidad', label: 'Estado' }
    ]
    : [
      { key: 'proyecto_nombre', label: 'Proyecto' },
      { key: 'unidad', label: 'N° Bien'},
      { key: 'tipologia', label: 'Tipología'},
      { key: 'piso', label: 'Piso'},
      { key: 'sup_util', label: 'Sup. Útil'},
      { key: 'valor_lista', label: 'Valor Lista (UF)'},
      { key: 'estado_unidad', label: 'Estado'}
    ];

  if (isValidating) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /> Validando...</div>;
  if (error || !brokerInfo) return <div className="p-6 text-center"><ShieldX className="h-16 w-16 text-red-500 mx-auto" /><p className="mt-4 text-red-600">{error}</p></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo.name}</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <nav className="flex space-x-4 border-b mb-4">
          <button onClick={() => setActiveTab('principales')} className={activeTab==='principales'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <Home className="inline mr-1"/>Principales
          </button>
          <button onClick={() => setActiveTab('secundarios')} className={activeTab==='secundarios'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <LayoutDashboard className="inline mr-1"/>Secundarios
          </button>
          <button onClick={() => setActiveTab('configuracion')} className={activeTab==='configuracion'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <SlidersHorizontal className="inline mr-1"/>Configuración
          </button>
        </nav>

        {(activeTab==='principales' || activeTab==='secundarios') && (
          <div className="flex space-x-4 mb-4">
            <select value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedTip(''); }} className="border p-2 rounded">
              <option value="">Todos Proyectos</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={selectedTip} onChange={e => setSelectedTip(e.target.value)} className="border p-2 rounded">
              <option value="">Todas Tipologías</option>
              {typologies.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {activeTab !== 'configuracion' && (
          <div className="overflow-x-auto bg-white shadow rounded">
            <table className="min-w-full">
              <thead className="bg-gray-200">
                <tr>
                  {headers.map(h => (
                    <th key={h.key} className="px-4 py-2 text-left cursor-pointer" onClick={() => { if (sortField === h.key) setSortAsc(!sortAsc); else { setSortField(h.key); setSortAsc(true); } }}>
                      <div className="flex items-center">
                        {h.label}
                        {sortField === h.key && (sortAsc ? <ArrowUp className="ml-1"/> : <ArrowDown className="ml-1"/>)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStock ? (
                  <tr><td colSpan={headers.length} className="p-4 text-center"><Loader2 className="animate-spin"/> Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={headers.length} className="p-4 text-center text-gray-500">No hay unidades.</td></tr>
                ) : filtered.map(u => {
                  const basePct = (u.descuento ?? 0) * 100;
                  const comm = commissions[u.proyecto_nombre] ?? 0;
                  const netPct = basePct - comm;
                  return (
                    <tr key={u.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => { if (activeTab==='principales') { setSelectedUnidad(u); setActiveTab('configuracion'); } }}>
                      <td className="px-4 py-2">{u.proyecto_nombre}</td>
                      <td className="px-4 py-2">{u.unidad}</td>
                      <td className="px-4 py-2">{u.tipologia}</td>
                      <td className="px-4 py-2">{u.piso ?? '-'}</td>
                      <td className="px-4 py-2 text-right">{u.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{u.valor_lista?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      {activeTab === 'principales' && (
                        <td className="px-4 py-2 text-right">{netPct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                      )}
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${u.estado_unidad==='Disponible'?'bg-green-100 text-green-800':u.estado_unidad==='No Disponible'?'bg-gray-100 text-gray-800':'bg-yellow-100 text-yellow-800'}`}>{u.estado_unidad}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'configuracion' && (
          <div className="bg-white shadow rounded p-6">
            <h2 className="text-xl font-semibold mb-4">Configuración de Cotización</h2>
            {selectedUnidad ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cliente</label>
                    <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">RUT</label>
                    <input type="text" value={rut} onChange={e => setRut(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                  </div>
                </div>
                <div className="space-y-2">
                  <p><strong>Proyecto:</strong> {selectedUnidad.proyecto_nombre}</p>
                  <p><strong>Departamento:</strong> {selectedUnidad.unidad}</p>
                  <p><strong>Tipología:</strong> {selectedUnidad.tipologia}</p>
                  <p><strong>Piso:</strong> {selectedUnidad.piso ?? '-'}</p>
                  <p><strong>Sup. Útil:</strong> {selectedUnidad.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</p>
                  <p><strong>Valor Lista:</strong> {selectedUnidad.valor_lista?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} UF</p>
                  <p><strong>Descuento:</strong> {(selectedUnidad.descuento ?? 0)*100}%</p>
                  <p><strong>Estado:</strong> {selectedUnidad.estado_unidad}</p>
                </div>
              </>
            ) : (
              <p className="text-gray-500">Seleccione un departamento en la pestaña Principales para configurar.</p>
            )}
          </div>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP - Cotizador Brokers</footer>
    </div>
  );
};

export default BrokerQuotePage;
