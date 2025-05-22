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
  sup_terraza?: number | null;
  sup_total?: number | null;
  valor_lista: number | null;
  descuento: number | null;
  estado_unidad: string | null;
  tipo_bien: string;
}

// NUEVA INTERFAZ para comisiones de broker por proyecto
interface BrokerProjectCommission {
  broker_id: string;
  project_name: string;
  commission_rate: number; // Stored as a decimal, e.g., 0.05 for 5%
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
  // NUEVO ESTADO para las comisiones de broker por proyecto
  const [brokerCommissions, setBrokerCommissions] = useState<BrokerProjectCommission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);


  const [sortField, setSortField] = useState<keyof Unidad>('unidad');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
  const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // Validar broker
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

  // Cargar TODO el stock con paginación de 1000 en 1000
  useEffect(() => {
    if (!brokerInfo) return;
    const fetchStock = async () => {
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
              'id, proyecto_nombre, unidad, tipologia, piso, sup_util, sup_terraza, sup_total, valor_lista, descuento, estado_unidad, tipo_bien'
            )
            .range(from, to);
          if (se) throw se;
          if (data && data.length) {
            all.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          } else break;
        }
        setStock(all);
      } catch (e) {
        console.error('Error loading stock:', e);
      } finally {
        setLoadingStock(false);
      }
    };

    // NUEVA FUNCIÓN para cargar comisiones de broker por proyecto
    const fetchBrokerCommissions = async () => {
        setLoadingCommissions(true);
        try {
            const { data, error: ce } = await supabase
                .from<BrokerProjectCommission>('broker_project_commissions')
                .select('broker_id, project_name, commission_rate')
                .eq('broker_id', brokerInfo.id); // Filtrar por el ID del broker asignado

            if (ce) throw ce;
            setBrokerCommissions(data || []);
        } catch (e) {
            console.error('Error loading broker commissions:', e);
        } finally {
            setLoadingCommissions(false);
        }
    };

    fetchStock();
    fetchBrokerCommissions(); // Llamar a la nueva función de fetch
  }, [brokerInfo]);

  // Opciones de filtro
  const proyectos = ['Todos', ...Array.from(new Set(stock.map(u => u.proyecto_nombre))).sort()];
  const tipologias = [
    'Todos',
    ...Array.from(
      new Set(
        stock
          .filter(u => filterProyecto === 'Todos' || u.proyecto_nombre === filterProyecto)
          .map(u => u.tipologia)
      )
    ).sort()
  ];

  // Función para calcular el descuento ajustado por la comisión del broker
  const calculateAdjustedDiscount = (
    valorLista: number | null,
    descuentoActual: number | null,
    projectName: string
  ): number | null => {
    if (valorLista === null || valorLista === 0) return null;

    // Buscar la comisión asociada para este proyecto y broker
    const projectCommission = brokerCommissions.find(
      (comm) => comm.broker_id === brokerInfo?.id && comm.project_name === projectName
    );

    // Si no hay comisión configurada para este proyecto, o no hay un descuento actual,
    // se devuelve el descuento existente. Se asume que commission_rate es un porcentaje entero.
    if (!projectCommission || projectCommission.commission_rate === null || descuentoActual === null) {
      return descuentoActual;
    }

    const brokerCommissionRate = projectCommission.commission_rate / 100; // Convertir a decimal

    // Fórmula proporcionada por el usuario
    const precioMinimoVenta = valorLista * (1 - descuentoActual);
    const comisionBrokerUF = precioMinimoVenta * brokerCommissionRate;
    const precioMasComision = precioMinimoVenta + comisionBrokerUF;
    const descuentoDisponibleUF = valorLista - precioMasComision;

    const nuevoDescuentoPorcentaje = descuentoDisponibleUF / valorLista;

    return nuevoDescuentoPorcentaje; // Retornar como decimal
  };


  // Filtrar y ordenar
  const filtered = stock
    .filter(u => {
      if (activeTab === 'principales') return u.tipo_bien === 'DEPARTAMENTO';
      if (activeTab === 'secundarios') return u.tipo_bien !== 'DEPARTAMENTO';
      return true;
    })
    .filter(u => filterProyecto === 'Todos' || u.proyecto_nombre === filterProyecto)
    .filter(u => filterTipologia === 'Todos' || u.tipologia === filterTipologia)
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  if (isValidating || loadingCommissions) // Esperar también a que carguen las comisiones
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" /> Validando...
      </div>
    );
  if (error || !brokerInfo)
    return (
      <div className="p-6 text-center">
        <ShieldX className="h-16 w-16 text-red-500 mx-auto" />
        <p className="mt-4 text-red-600">{error}</p>
      </div>
    );

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
            className={
              activeTab === 'principales'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <Home className="inline mr-1" /> Principales
          </button>
          <button
            onClick={() => setActiveTab('secundarios')}
            className={
              activeTab === 'secundarios'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <LayoutDashboard className="inline mr-1" /> Secundarios
          </button>
          <button
            onClick={() => setActiveTab('configuracion')}
            className={
              activeTab === 'configuracion'
                ? 'border-b-2 border-blue-600 pb-2'
                : 'pb-2 text-gray-500'
            }
          >
            <SlidersHorizontal className="inline mr-1" /> Configuración
          </button>
        </nav>

        {/* Filtros solo en listado */}
        {(activeTab === 'principales' || activeTab === 'secundarios') && (
          <div className="flex space-x-4 mb-4">
            <select
              value={filterProyecto}
              onChange={e => {
                setFilterProyecto(e.target.value);
                setFilterTipologia('Todos');
              }}
              className="border p-2 rounded"
            >
              {proyectos.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filterTipologia}
              onChange={e => setFilterTipologia(e.target.value)}
              className="border p-2 rounded"
            >
              {tipologias.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabla Principales / Secundarios */}
        {activeTab !== 'configuracion' && (
          <div className="overflow-x-auto bg-white shadow rounded">
            <table className="min-w-full">
              <thead className="bg-gray-200">
                <tr>
                  {(activeTab === 'principales' ? headersPrincipales : headersSecundarios).map(h => (
                    <th
                      key={h.key}
                      className="px-4 py-2 text-left cursor-pointer"
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
                        {sortField === h.key && (sortAsc ? <ArrowUp className="ml-1" /> : <ArrowDown className="ml-1" />)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStock ? (
                  <tr>
                    <td colSpan={(activeTab === 'principales' ? headersPrincipales : headersSecundarios).length} className="p-4 text-center">
                      <Loader2 className="animate-spin" /> Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={(activeTab === 'principales' ? headersPrincipales : headersSecundarios).length} className="p-4 text-center text-gray-500">
                      No hay unidades.
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => {
                    // Calcular el descuento ajustado
                    const adjustedDiscount = calculateAdjustedDiscount(
                      u.valor_lista,
                      u.descuento,
                      u.proyecto_nombre
                    );
                    const descPct = (adjustedDiscount !== null ? (adjustedDiscount * 100) : (u.descuento ?? 0) * 100).toFixed(2) + '%';
                    
                    return (
                      <tr
                        key={u.id}
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedUnidad(u);
                          setActiveTab('configuracion');
                        }}
                      >
                        <td className="px-4 py-2">{u.proyecto_nombre}</td>
                        <td className="px-4 py-2">{u.unidad}</td>
                        <td className="px-4 py-2">{u.tipologia}</td>
                        <td className="px-4 py-2">{u.piso || '-'}</td>
                        <td className="px-4 py-2 text-right">{u.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right">{u.valor_lista?.toLocaleString()}</td>
                        {activeTab === 'principales' && <td className="px-4 py-2 text-right">{descPct}</td>}
                        <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full ${u.estado_unidad === 'Disponible' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{u.estado_unidad}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Configuración solo de la unidad seleccionada */}
        {activeTab === 'configuracion' && (
          <div className="bg-white shadow rounded p-6"> {/* Removed space-y-6 from here */}
            <h2 className="text-xl font-semibold mb-4">Configuración de Cotización</h2>
            {!selectedUnidad ? (
              <p className="text-gray-500">Seleccione un departamento en Principales.</p>
            ) : (
              <>
                {/* Sección Cliente/RUT */}
                {/* Changed from 'mb-6' to 'pb-4 mb-4' and added 'border-b' for separation */}
                <div className="bg-blue-50 p-4 rounded border-b pb-4 mb-6">
                  <h3 className="text-lg font-medium mb-2">Datos del Cliente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
                      <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1" placeholder="Ingrese nombre" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">RUT del Cliente</label>
                      <input type="text" value={rut} onChange={e => setRut(e.target.value)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1" placeholder="Ingrese RUT" />
                    </div>
                  </div>
                </div>
                {/* Sección Proyecto */}
                {/* Added 'mt-6' for separation and 'border-b pb-4' */}
                <section className="mt-6 border-b pb-4">
                  <h3 className="text-lg font-medium mb-2">Proyecto</h3>
                  <p><span className="font-semibold">Proyecto:</span> {selectedUnidad.proyecto_nombre}</p>
                </section>
                {/* Sección Unidad, Estado, Tipología, Piso, Descuento, Valor */}
                {/* Modified to use grid, added bold tags to values, added 'border-b pb-4' and 'mt-6' */}
                <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b pb-4">
                  <h3 className="text-lg font-medium col-span-full mb-2">Detalles de Unidad</h3>
                  <div>
                    <p>
                      N° Bien: <span className="font-semibold">{selectedUnidad.unidad}</span> <span className="text-sm text-gray-500">({selectedUnidad.estado_unidad})</span>
                    </p>
                  </div>
                  <div>
                    <p>Tipología: <span className="font-semibold">{selectedUnidad.tipologia}</span></p>
                  </div>
                  <div>
                    <p>Piso: <span className="font-semibold">{selectedUnidad.piso || '-'}</span></p>
                  </div>
                  <div>
                    <p>
                      Descuento: <span className="font-semibold">
                        {(calculateAdjustedDiscount(
                          selectedUnidad.valor_lista,
                          selectedUnidad.descuento,
                          selectedUnidad.proyecto_nombre
                        ) !== null ? (calculateAdjustedDiscount(
                          selectedUnidad.valor_lista,
                          selectedUnidad.descuento,
                          selectedUnidad.proyecto_nombre
                        )! * 100) : (selectedUnidad.descuento ?? 0) * 100).toFixed(2)
                      }%
                      </span>
                    </p>
                  </div>
                  <div className="col-span-full">
                    <p>Valor Lista: <span className="font-semibold">{selectedUnidad.valor_lista?.toLocaleString()} UF</span></p>
                  </div>
                </section>
                {/* Sección Superficies */}
                {/* Modified to use grid, added bold tags to values, added 'mt-6' */}
                <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <h3 className="text-lg font-medium col-span-full mb-2">Superficies</h3>
                  <div>
                    <p>Sup. Útil: <span className="font-semibold">{selectedUnidad.sup_util?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} m²</span></p>
                  </div>
                  {selectedUnidad.sup_terraza != null && (
                    <div>
                      <p>Sup. Terraza: <span className="font-semibold">{selectedUnidad.sup_terraza} m²</span></p>
                    </div>
                  )}
                  {selectedUnidad.sup_total != null && (
                    <div>
                      <p>Sup. Total: <span className="font-semibold">{selectedUnidad.sup_total} m²</span></p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP - Cotizador Brokers</footer>
    </div>
  );
};

export default BrokerQuotePage;