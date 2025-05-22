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
  ArrowDown,
  PlusCircle, // Icono para añadir
  Trash2 // Icono para eliminar
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
  tipo_bien: string; // Asegúrate de que esta propiedad esté en la interfaz
}

// NUEVA INTERFAZ para comisiones de broker por proyecto
interface BrokerProjectCommission {
  broker_id: string;
  project_name: string;
  commission_rate: number; // Stored as a decimal, e.g., 0.05 for 5%
}

type Tab = 'principales' | 'secundarios' | 'configuracion';
type QuotationType = 'descuento' | 'bono' | 'mix'; // Tipos para la configuración de cotización

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

  // NUEVOS ESTADOS para el valor de la UF
  const [ufValue, setUfValue] = useState<number | null>(null);
  const [loadingUf, setLoadingUf] = useState(true);

  const [sortField, setSortField] = useState<keyof Unidad>('unidad');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
  const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // NUEVOS ESTADOS para la configuración de cotización
  const [quotationType, setQuotationType] = useState<QuotationType>('descuento');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [bonoAmount, setBonoAmount] = useState<number>(0);

  // NUEVOS ESTADOS para unidades secundarias del proyecto
  const [projectSecondaryUnits, setProjectSecondaryUnits] = useState<Unidad[]>([]);
  const [selectedSecondaryUnitToAdd, setSelectedSecondaryUnitToAdd] = useState<string>(''); // ID de la unidad seleccionada en el dropdown
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]); // Lista de unidades secundarias añadidas a la cotización


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
        console.error('Error cargando stock:', e);
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
            console.error('Error cargando comisiones de broker:', e);
        } finally {
            setLoadingCommissions(false);
        }
    };

    fetchStock();
    fetchBrokerCommissions(); // Llamar a la nueva función de fetch
  }, [brokerInfo]);

  // NUEVO: Fetch UF value
  useEffect(() => {
    const fetchUf = async () => {
      setLoadingUf(true);
      try {
        // Usando la API mindicador.cl para el valor de la UF
        const response = await fetch('https://mindicador.cl/api');
        if (!response.ok) {
          throw new Error(`Error HTTP! estado: ${response.status}`);
        }
        const data = await response.json();
        // Asumiendo que el valor de la UF está en data.uf.valor
        if (data && data.uf && data.uf.valor) {
          setUfValue(data.uf.valor);
        } else {
          throw new Error('Valor de UF no encontrado en la respuesta de la API.');
        }
      } catch (e) {
        console.error('Error obteniendo valor de UF:', e);
        // Opcionalmente, se puede establecer un estado de error para la obtención de UF
      } finally {
        setLoadingUf(false);
      }
    };
    fetchUf();
  }, []); // El array de dependencia vacío significa que se ejecuta una vez al montar

  // NUEVO: Obtener unidades secundarias para el proyecto seleccionado
  useEffect(() => {
    if (selectedUnidad?.proyecto_nombre) {
      const fetchProjectUnits = async () => {
        try {
          const { data, error: suError } = await supabase
            .from<Unidad>('stock_unidades')
            .select('id, unidad, tipologia, valor_lista, tipo_bien') // Asegúrate de seleccionar 'tipo_bien' aquí
            .eq('proyecto_nombre', selectedUnidad.proyecto_nombre)
            .neq('tipo_bien', 'DEPARTAMENTO') // Filtrar por unidades secundarias (no departamentos)
            .order('unidad');

          if (suError) throw suError;
          setProjectSecondaryUnits(data || []);
          setSelectedSecondaryUnitToAdd(''); // Resetear selección del dropdown al cambiar de proyecto
          setAddedSecondaryUnits([]); // Resetear unidades secundarias añadidas
        } catch (e) {
          console.error('Error cargando unidades secundarias del proyecto:', e);
          setProjectSecondaryUnits([]);
        }
      };
      fetchProjectUnits();
    } else {
      setProjectSecondaryUnits([]);
      setAddedSecondaryUnits([]);
    }
  }, [selectedUnidad?.proyecto_nombre]);


  // Opciones de filtro
  const proyectos = ['Todos', ...Array.from(new Set(stock.map(u => u.proyecto_nombre))).sort()];
  const tipologias = [
    'Todos',
    ...Array.from(
      new Set(
        // Filtrar tipologías basadas en la pestaña activa y el filtro de proyecto actual
        stock
          .filter(u => activeTab === 'principales' ? u.tipo_bien === 'DEPARTAMENTO' : true) // SOLO mostrar DEPARTAMENTO para 'principales'
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

  // Handler para agregar unidad secundaria a la cotización
  const handleAddSecondaryUnit = () => {
    if (selectedSecondaryUnitToAdd) {
      const unitToAdd = projectSecondaryUnits.find(unit => unit.id === selectedSecondaryUnitToAdd);
      if (unitToAdd && !addedSecondaryUnits.some(unit => unit.id === unitToAdd.id)) {
        setAddedSecondaryUnits(prev => [...prev, unitToAdd]);
        setSelectedSecondaryUnitToAdd(''); // Limpiar la selección del dropdown
      }
    }
  };

  // Handler para remover unidad secundaria de la cotización
  const handleRemoveAddedSecondaryUnit = (unitId: string) => {
    setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
  };


  if (isValidating || loadingCommissions || loadingUf) // Esperar también a que carguen las comisiones y la UF
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" /> Cargando datos...
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
  // Modificar headersSecundarios para mostrar 'tipo_bien' en lugar de 'tipologia'
  const headersSecundarios = headersPrincipales.map(h => {
    if (h.key === 'tipologia') {
      return { key: 'tipo_bien', label: 'Tipo Bien' }; // Cambiar a tipo_bien
    }
    return h;
  }).filter(h => h.key !== 'descuento'); // Mantener el filtro de descuento

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo.name}</h1>
          <div className="text-lg font-semibold text-gray-700">
            {ufValue ? (
              <span>UF: $ {ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            ) : (
              <span className="text-sm text-gray-500">Cargando UF...</span>
            )}
          </div>
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
                        {/* Renderizar tipo_bien si la pestaña es 'secundarios', de lo contrario, tipología */}
                        <td className="px-4 py-2">{activeTab === 'secundarios' ? u.tipo_bien : u.tipologia}</td> 
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

        {/* Contenido de la pestaña de Configuración */}
        {activeTab === 'configuracion' && (
          <> {/* Fragmento para agrupar las tarjetas */}
            {/* Tarjeta de Información General y Superficies */}
            <div className="bg-white shadow rounded p-6 mb-6"> {/* Añadido mb-6 para separar de la siguiente tarjeta */}
              <h2 className="text-xl font-semibold mb-4">Información de la Unidad Seleccionada</h2>
              {!selectedUnidad ? (
                <p className="text-gray-500">Seleccione un departamento en Principales.</p>
              ) : (
                <>
                  {/* Sección Cliente/RUT */}
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
                  <section className="mt-6 border-b pb-4">
                    <h3 className="text-lg font-medium mb-2">Proyecto</h3>
                    <p><span className="font-semibold">Proyecto:</span> {selectedUnidad.proyecto_nombre}</p>
                  </section>
                  {/* Sección Unidad, Estado, Tipología, Piso, Descuento, Valor */}
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
                  <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Eliminado border-b pb-4 de aquí para que la separación con la nueva tarjeta sea más clara */}
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

            {/* NUEVA TARJETA: Configuración de Cotización (Separada) */}
            {selectedUnidad && ( /* Solo mostrar esta tarjeta si hay una unidad seleccionada */
              <div className="bg-white shadow rounded p-6 mt-6"> {/* Añadido mt-6 para la separación */}
                  <h3 className="text-xl font-semibold mb-4">Configuración de Cotización</h3>

                  {/* Contenedor principal para las 3 columnas */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
                      {/* Columna 1: Tipo de Configuración y Campos de Ingreso */}
                      <div>
                          <div className="mb-4">
                              <label htmlFor="quotationType" className="block text-sm font-medium text-gray-700">Tipo de Configuración</label>
                              <select
                                  id="quotationType"
                                  name="quotationType"
                                  value={quotationType}
                                  onChange={e => setQuotationType(e.target.value as QuotationType)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              >
                                  <option value="descuento">Descuento</option>
                                  <option value="bono">Bono Pie</option>
                                  <option value="mix">Mix (Descuento + Bono)</option>
                              </select>
                          </div>

                          {/* Campos de Ingreso Condicionales */}
                          <div className="space-y-4"> {/* Agrupamos los inputs para mantener el espaciado vertical */}
                              {quotationType === 'descuento' && (
                                  <div>
                                      <label htmlFor="discountInput" className="block text-sm font-medium text-gray-700">Descuento (%)</label>
                                      <input
                                          type="number"
                                          id="discountInput"
                                          value={discountAmount}
                                          onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                          min="0"
                                          max="100"
                                          step="0.001"
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                      />
                                  </div>
                              )}
                              {quotationType === 'bono' && (
                                  <div>
                                      <label htmlFor="bonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (UF)</label>
                                      <input
                                          type="number"
                                          id="bonoInput"
                                          value={bonoAmount}
                                          onChange={e => setBonoAmount(parseFloat(e.target.value) || 0)}
                                          min="0"
                                          step="0.01"
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                      />
                                  </div>
                              )}
                              {quotationType === 'mix' && (
                                  <>
                                      <div>
                                          <label htmlFor="mixDiscountInput" className="block text-sm font-medium text-gray-700">Descuento (%)</label>
                                          <input
                                              type="number"
                                              id="mixDiscountInput"
                                              value={discountAmount}
                                              onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                              min="0"
                                              max="100"
                                              step="0.001"
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                          />
                                      </div>
                                      <div>
                                          <label htmlFor="mixBonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (UF) (Automático)</label>
                                          <input
                                              type="number"
                                              id="mixBonoInput"
                                              value={bonoAmount} // Este se calculará automáticamente más tarde
                                              readOnly
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed"
                                          />
                                      </div>
                                  </>
                              )}
                          </div>
                      </div>

                      {/* Columna 2: Agregar Secundarios a la Cotización */}
                      <div>
                          <h4 className="text-lg font-semibold mb-3">Agregar Secundarios</h4>
                          
                          <div className="flex items-end gap-2 mb-4"> {/* Contenedor del dropdown y botón */}
                              <div className="flex-grow">
                                  <label htmlFor="secondaryUnitSelect" className="sr-only">Seleccionar unidad secundaria</label>
                                  <select
                                      id="secondaryUnitSelect"
                                      value={selectedSecondaryUnitToAdd}
                                      onChange={e => setSelectedSecondaryUnitToAdd(e.target.value)}
                                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  >
                                      <option value="">Seleccione un secundario</option>
                                      {projectSecondaryUnits.length === 0 ? (
                                          <option disabled>No hay unidades secundarias disponibles.</option>
                                      ) : (
                                          projectSecondaryUnits.map(unit => (
                                              // Solo mostrar unidades que no han sido añadidas ya
                                              !addedSecondaryUnits.some(addedUnit => addedUnit.id === unit.id) && (
                                                  <option key={unit.id} value={unit.id}>
                                                      {unit.unidad} ({unit.tipo_bien}) - {unit.valor_lista?.toLocaleString()} UF
                                                  </option>
                                              )
                                          ))
                                      )}
                                  </select>
                              </div>
                              <button
                                  type="button"
                                  onClick={handleAddSecondaryUnit}
                                  disabled={!selectedSecondaryUnitToAdd}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                              >
                                  <PlusCircle className="h-5 w-5 mr-1" /> Agregar
                              </button>
                          </div>
                      </div>

                      {/* Columna 3: Lista de Secundarios Agregados */}
                      <div className="border-t lg:border-t-0 lg:border-l lg:pl-6 pt-4 lg:pt-0"> {/* Separación visual y para columnas */}
                          <h4 className="text-lg font-semibold mb-3">Secundarios Agregados:</h4>
                          {addedSecondaryUnits.length === 0 ? (
                              <p className="text-gray-500">Ningún secundario añadido.</p>
                          ) : (
                              <ul className="space-y-2">
                                  {addedSecondaryUnits.map(unit => (
                                      <li key={unit.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                          <span className="text-sm text-gray-800">
                                              {unit.unidad} ({unit.tipo_bien}) - {unit.valor_lista?.toLocaleString()} UF
                                          </span>
                                          <button
                                              type="button"
                                              onClick={() => handleRemoveAddedSecondaryUnit(unit.id)}
                                              className="text-red-600 hover:text-red-800 ml-4 p-1 rounded-full hover:bg-red-100"
                                              title="Eliminar de la cotización"
                                          >
                                              <Trash2 className="h-4 w-4" />
                                          </button>
                                      </li>
                                  ))}
                              </ul>
                          )}
                      </div>
                  </div>
              </div>
            )} {/* FIN NUEVA TARJETA/SECCIÓN */}
          </>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP - Cotizador Brokers</footer>
    </div>
  );
};

export default BrokerQuotePage;