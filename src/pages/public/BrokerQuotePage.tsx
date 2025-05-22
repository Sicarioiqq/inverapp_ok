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
  tipo_bien: string;
  piso: string | null;
  sup_util: number | null;
  valor_lista: number | null;
  descuento: number | null;
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
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [brokerSlug, accessToken]);

  // Fetch stock principales
  useEffect(() => {
    if (!brokerInfo) return;
    const load = async () => {
      setLoadingStock(true);
      try {
        const { data, error: se } = await supabase
          .from<Unidad>('stock_unidades')
          .select(
            'id, proyecto_nombre, unidad, tipologia, tipo_bien, piso, sup_util, valor_lista, descuento, estado_unidad'
          )
          .eq('tipo_bien', 'DEPARTAMENTO');
        if (se) throw se;
        if (data) {
          setStock(data);
          setProjects(Array.from(new Set(data.map(u => u.proyecto_nombre))).sort());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStock(false);
      }
    };
    load();
  }, [brokerInfo]);

  // Filter & sort
  useEffect(() => {
    let arr = stock;
    if (selectedProject) arr = arr.filter(u => u.proyecto_nombre === selectedProject);
    const types = Array.from(new Set(arr.map(u => u.tipologia))).sort();
    setTypologies(types);
    if (selectedTip) arr = arr.filter(u => u.tipologia === selectedTip);
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
    { key: 'valor_lista', label: 'Valor Lista (UF)' },
    { key: 'descuento', label: 'Descuento (%)' },
    { key: 'estado_unidad', label: 'Estado' },
  ];

  if (isValidating)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
        Validando...
      </div>
    );
  if (error || !brokerInfo)
    return (
      <div className="p-6 text-center">
        <ShieldX className="h-16 w-16 text-red-500 mx-auto" />
        <p className="mt-4 text-red-600">{error}</p>
      </div>
    );

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
            className={
              activeTab === 'principales'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <Home className="inline mr-1" />Principales
          </button>
          <button
            onClick={() => setActiveTab('secundarios')}
            className={
              activeTab === 'secundarios'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <LayoutDashboard className="inline mr-1" />Secundarios
          </button>
          <button
            onClick={() => setActiveTab('configuracion')}
            className={
              activeTab === 'configuracion'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <SlidersHorizontal className="inline mr-1" />Configuración
          </button>
        </nav>

        {activeTab === 'principales' && (
          <>
            <div className="flex space-x-4 mb-4">
              <select
                value={selectedProject}
                onChange={e => {
                  setSelectedProject(e.target.value);
                  setSelectedTip('');
                }}
                className="border p-2 rounded"
              >
                <option value="">Todos Proyectos</option>
                {projects.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={selectedTip}
                onChange={e => setSelectedTip(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Todas Tipologías</option>
                {typologies.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    {headers.map(h => (
                      <th
                        key={h.key}
                        className="px-4 py-2 cursor-pointer"
                        onClick={() => {
                          if (sortField === h.key) setSortAsc(!sortAsc);
                          else {
                            setSortField(h.key);
                            setSortAsc(true);
                          }
                        }}
                      >
                        <div className="flex items-center">
                          {h.label}
                          {sortField === h.key && (sortAsc ? <ArrowUp /> : <ArrowDown />)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <tr>
                      <td colSpan={headers.length} className="p-4 text-center">
                        <Loader2 className="animate-spin" />
                      </td>
                    </tr>
                  ) : (
                    filtered.map(u => (
                      <tr
                        key={u.id}
                        className="odd:bg-gray-50 hover:bg-gray-100"
                      >
                        <td className="px-4 py-2">{u.proyecto_nombre}</td>
                        <td className="px-4 py-2">{u.unidad}</td>
                        <td className="px-4 py-2">{u.tipologia}</td>
                        <td className="px-4 py-2">{u.piso || '-'}</td>
                        <td className="px-4 py-2">{u.sup_util?.toFixed(2) ?? '-'}</td>
                        <td className="px-4 py-2">{u.valor_lista?.toFixed(3) ?? '-'}</td>
                        <td className="px-4 py-2">{u.descuento?.toFixed(3) ?? '-'}</td>
                        <td className="px-4 py-2">{u.estado_unidad}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {/* TODO: implementar secundarios y configuracion */}
      </main>
    </div>
  );
};

export default BrokerQuotePage;
