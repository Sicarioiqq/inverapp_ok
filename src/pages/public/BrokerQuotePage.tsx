// src/pages/public/BrokerQuotePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Home,
  SlidersHorizontal,
  Loader2,
  AlertTriangle,
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
  tipo_bien: string;
  piso: string | null;
  sup_util: number | null;
  precio_uf: number | null;
  estado_unidad: string | null;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();

  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('principales');

  // Stock principales state
  const [stock, setStock] = useState<Unidad[]>([]);
  const [filtered, setFiltered] = useState<Unidad[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [typologies, setTypologies] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTip, setSelectedTip] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Unidad>('proyecto_nombre');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  // Validate access and fetch broker
  useEffect(() => {
    if (!brokerSlug || !accessToken) {
      setError('Información de acceso inválida o incompleta.');
      setIsValidating(false);
      return;
    }
    const fn = async () => {
      try {
        const { data, error: fe } = await supabase
          .from('brokers')
          .select('id,name')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken)
          .single();
        if (fe || !data) throw new Error('Acceso no autorizado.');
        setBrokerInfo(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsValidating(false);
      }
    };
    fn();
  }, [brokerSlug, accessToken]);

  // Fetch stock principales on mount
  useEffect(() => {
    if (!brokerInfo) return;
    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const { data } = await supabase
          .from<Unidad>('stock_unidades')
          .select(
            'id, proyecto_nombre, unidad, tipologia, tipo_bien, piso, sup_util, precio_uf, estado_unidad'
          )
          .eq('tipo_bien', 'DEPARTAMENTO');
        if (data) {
          setStock(data);
          // init filters
          const projs = Array.from(new Set(data.map(u => u.proyecto_nombre))).sort();
          setProjects(projs);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [brokerInfo]);

  // Filter and sort
  useEffect(() => {
    let arr = stock;
    if (selectedProject) arr = arr.filter(u => u.proyecto_nombre === selectedProject);
    // build typologies from project-filtered
    const typs = Array.from(new Set(arr.map(u => u.tipologia))).sort();
    setTypologies(typs);
    if (selectedTip) arr = arr.filter(u => u.tipologia === selectedTip);
    // sort
    arr = [...arr].sort((a, b) => {
      const fa = a[sortField] ?? '';
      const fb = b[sortField] ?? '';
      if (fa < fb) return sortAsc ? -1 : 1;
      if (fa > fb) return sortAsc ? 1 : -1;
      return 0;
    });
    setFiltered(arr);
  }, [stock, selectedProject, selectedTip, sortField, sortAsc]);

  const headers: { key: keyof Unidad; label: string }[] = [
    { key: 'proyecto_nombre', label: 'Proyecto' },
    { key: 'unidad', label: 'N° Bien' },
    { key: 'tipologia', label: 'Tipología' },
    { key: 'piso', label: 'Piso' },
    { key: 'sup_util', label: 'Sup. Útil' },
    { key: 'precio_uf', label: 'Precio UF' },
    { key: 'estado_unidad', label: 'Estado' },
  ];

  if (isValidating) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin h-12 w-12" /> Validando...
    </div>
  );

  if (error || !brokerInfo) return (
    <div className="p-6 text-center">
      <ShieldX className="h-16 w-16 text-red-500 mx-auto" />
      <p className="mt-4 text-red-600">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto p-4 flex justify-between">
          <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo.name}</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        {/* Tabs */}
        <nav className="flex space-x-4 border-b mb-4">
          <button onClick={() => setActiveTab('principales')} className={activeTab==='principales'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <Home className="inline-block mr-1"/>Principales
          </button>
          <button onClick={() => setActiveTab('secundarios')} className={activeTab==='secundarios'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <LayoutDashboard className="inline-block mr-1"/>Secundarios
          </button>
          <button onClick={() => setActiveTab('configuracion')} className={activeTab==='configuracion'? 'border-b-2 border-blue-600 pb-2':'pb-2 text-gray-500'}>
            <SlidersHorizontal className="inline-block mr-1"/>Configuración
          </button>
        </nav>
        {/* Content */}
        {activeTab==='principales' && (
          <div>
            {/* Filters */}
            <div className="flex space-x-4 mb-4">
              <select value={selectedProject} onChange={e=>{setSelectedProject(e.target.value); setSelectedTip('');}} className="border p-2 rounded">
                <option value="">Todos Proyectos</option>
                {projects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <select value={selectedTip} onChange={e=>setSelectedTip(e.target.value)} className="border p-2 rounded">
                <option value="">Todas Tipologías</option>
                {typologies.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    {headers.map(h=>(
                      <th key={h.key} className="px-4 py-2 cursor-pointer" onClick={()=>{
                        if(sortField===h.key) setSortAsc(!sortAsc);
                        else {setSortField(h.key); setSortAsc(true);} }}>
                        <div className="flex items-center">
                          {h.label}
                          {sortField===h.key && (sortAsc? <ArrowUp/>:<ArrowDown/>)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingStock? (
                    <tr><td colSpan={headers.length} className="p-4 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto"/></td></tr>
                  ) : filtered.map(u=>(
                    <tr key={u.id} className="odd:bg-gray-50 hover:bg-gray-100">
                      <td className="px-4 py-2">{u.proyecto_nombre}</td>
                      <td className="px-4 py-2">{u.unidad}</td>
                      <td className="px-4 py-2">{u.tipologia}</td>
                      <td className="px-4 py-2">{u.piso || '-'}</td>
                      <td className="px-4 py-2 text-right">{u.sup_util?.toFixed(2) || '-'}</td>
                      <td className="px-4 py-2 text-right">{u.precio_uf?.toFixed(0) || '-'}</td>
                      <td className="px-4 py-2">{u.estado_unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab!=='principales' && (
          <div className="bg-white p-6 rounded shadow text-center text-gray-500">Contenido de la pestaña &quot;{activeTab}&quot; todavía no implementado.</div>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP</footer>
    </div>
  );
};

export default BrokerQuotePage;
