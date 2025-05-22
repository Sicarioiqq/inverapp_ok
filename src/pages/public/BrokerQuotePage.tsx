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
  Trash2, // Icono para eliminar
  DollarSign, // Icono para precios
  Wallet // Icono para forma de pago
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
  descuento: number | null; // Descuento base de la unidad (ej: 0.15 para 15%)
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
  const [discountAmount, setDiscountAmount] = useState<number>(0); // El descuento en % ingresado por el usuario
  const [bonoAmount, setBonoAmount] = useState<number>(0); // El monto de bono en UF ingresado por el usuario

  // NUEVOS ESTADOS para unidades secundarias del proyecto
  const [projectSecondaryUnits, setProjectSecondaryUnits] = useState<Unidad[]>([]);
  const [selectedSecondaryUnitToAdd, setSelectedSecondaryUnitToAdd] = useState<string>(''); // ID de la unidad seleccionada en el dropdown
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]); // Lista de unidades secundarias añadidas a la cotización

  // NUEVOS ESTADOS para la forma de pago de la cotización
  const [pagoReserva, setPagoReserva] = useState<number>(0);
  const [pagoPromesa, setPagoPromesa] = useState<number>(0);
  const [pagoPie, setPagoPie] = useState<number>(0);
  // pagoCreditoHipotecario se calculará automáticamente
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0); // Este es el monto del bono pie que aparece en la sección "Forma de Pago"


  // Constante para el valor fijo de la reserva en pesos
  const VALOR_RESERVA_PESOS = 100000;


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

  // NUEVO: Obtener unidades secundarias para el proyecto seleccionado e inicializar descuentos/bonos
  useEffect(() => {
    if (selectedUnidad) {
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
          setSelectedSecondaryUnitToAdd('');
          setAddedSecondaryUnits([]);
        } catch (e) {
          console.error('Error cargando unidades secundarias del proyecto:', e);
          setProjectSecondaryUnits([]);
        }
      };
      fetchProjectUnits();

      // Inicializar discountAmount o bonoAmount según el tipo de configuración
      // Tomar el descuento del departamento después de aplicar la comisión del broker
      const initialAdjustedDiscount = calculateAdjustedDiscount(
        selectedUnidad.valor_lista,
        selectedUnidad.descuento,
        selectedUnidad.proyecto_nombre
      );

      if (quotationType === 'descuento' || quotationType === 'mix') {
        // En estos modos, el descuento se "autocarga" con el descuento disponible del departamento
        // y se redondea a 2 decimales para la visualización.
        setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2))); 
        setBonoAmount(0); // Restablecer bono en estos modos
      } else if (quotationType === 'bono') {
        setDiscountAmount(0); // Restablecer descuento en modo bono
        setBonoAmount(0); // El bono en modo 'bono' se ingresa manualmente por ahora, no hay un valor inicial automático
      }
    } else {
      // Resetear estados si no hay unidad seleccionada
      setProjectSecondaryUnits([]);
      setAddedSecondaryUnits([]);
      setDiscountAmount(0);
      setBonoAmount(0);
    }
  }, [selectedUnidad, quotationType, brokerCommissions, brokerInfo]); // Se re-ejecuta si la unidad seleccionada, el tipo de cotización, o los datos del broker/comisiones cambian

  // Efecto para inicializar el pago de reserva (en UF) y para sincronizar el bono pie de configuración con el de cotización
  useEffect(() => {
    if (ufValue !== null) {
      setPagoReserva(VALOR_RESERVA_PESOS / ufValue);
    }
    // Sincronizar el bonoAmount de la configuración con el pagoBonoPieCotizacion
    // Solo si el tipo de configuración es 'bono' o 'mix'
    if (quotationType === 'bono' || quotationType === 'mix') {
      setPagoBonoPieCotizacion(bonoAmount);
    } else {
      setPagoBonoPieCotizacion(0); // Si es solo descuento, el bono pie de la cotización es 0
    }
  }, [ufValue, bonoAmount, quotationType]); // Depende de ufValue, bonoAmount y quotationType para recalcular

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

  // Filtrar y ordenar (Definido aquí para que esté disponible en todo el componente)
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

  // Cálculos para la nueva sección de Cotización
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  
  // Ajusta el precio del departamento según el tipo de configuración
  let precioDescuentoDepartamento = 0;
  let precioDepartamentoConDescuento = precioBaseDepartamento;
  
  // Si la configuración es 'descuento' o 'mix', aplica el descuento al departamento
  if (quotationType === 'descuento' || quotationType === 'mix') {
    precioDescuentoDepartamento = (precioBaseDepartamento * discountAmount) / 100;
    precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
  } else {
    // Si la configuración es solo 'bono', no hay descuento directo en el departamento
    precioDescuentoDepartamento = 0;
    precioDepartamentoConDescuento = precioBaseDepartamento;
  }

  const precioTotalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);

  // Calcula el "Total Escritura"
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
  
  // Calcula el crédito hipotecario ajustado
  const pagoCreditoHipotecarioCalculado = totalEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion);

  // Este es el "Total" de la forma de pago (sumando el crédito hipotecario calculado)
  const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;


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

  // Función para formatear moneda (siempre con 2 decimales)
  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Función para convertir UF a Pesos (con 0 decimales para pesos)
  const ufToPesos = (uf: number | null): string => {
    if (uf === null || ufValue === null) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(uf * ufValue);
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
                      <p>Valor Lista: <span className="font-semibold">{formatCurrency(selectedUnidad.valor_lista)} UF</span></p>
                    </div>
                  </section>
                  {/* Sección Superficies */}
                  <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Eliminado border-b pb-4 de aquí para que la separación con la nueva tarjeta sea más clara */}
                    <h3 className="text-lg font-medium col-span-full mb-2">Superficies</h3>
                    <div>
                      <p>Sup. Útil: <span className="font-semibold">{formatCurrency(selectedUnidad.sup_util)} m²</span></p>
                    </div>
                    {selectedUnidad.sup_terraza != null && (
                      <div>
                        <p>Sup. Terraza: <span className="font-semibold">{formatCurrency(selectedUnidad.sup_terraza)} m²</span></p>
                      </div>
                    )}
                    {selectedUnidad.sup_total != null && (
                      <div>
                        <p>Sup. Total: <span className="font-semibold">{formatCurrency(selectedUnidad.sup_total)} m²</span></p>
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
                                  onChange={e => {
                                    const newQuotationType = e.target.value as QuotationType;
                                    setQuotationType(newQuotationType);
                                    // Al cambiar el tipo de configuración, inicializar montos
                                    if (selectedUnidad) {
                                      const initialAdjustedDiscount = calculateAdjustedDiscount(
                                        selectedUnidad.valor_lista,
                                        selectedUnidad.descuento,
                                        selectedUnidad.proyecto_nombre
                                      );
                                      if (newQuotationType === 'descuento' || newQuotationType === 'mix') {
                                        setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2))); // Usar el descuento ajustado del departamento
                                        setBonoAmount(0); // Restablecer bono en estos modos
                                      } else if (newQuotationType === 'bono') {
                                        setDiscountAmount(0); // Restablecer descuento en modo bono
                                        setBonoAmount(0); // El bono en modo 'bono' se ingresa manualmente por ahora, no hay un valor inicial automático
                                      }
                                    }
                                  }}
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
                                          value={parseFloat(discountAmount.toFixed(2))} // Mostrar con 2 decimales
                                          onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                          min="0"
                                          max="100"
                                          step="0.01" // Permite input de 2 decimales
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                                          focus:border-blue-500 focus:ring-blue-500
                                          bg-gray-100 cursor-not-allowed" // Se hace readOnly para que refleje el valor automático
                                          readOnly={true}
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
                                              value={parseFloat(discountAmount.toFixed(2))} // Mostrar con 2 decimales
                                              onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                              min="0"
                                              max="100"
                                              step="0.01" // Permite input de 2 decimales
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500
                                              bg-gray-100 cursor-not-allowed" // El descuento en mix es readOnly
                                              readOnly={true}
                                          />
                                      </div>
                                      <div>
                                          <label htmlFor="mixBonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (UF) (Automático)</label>
                                          <input
                                              type="number"
                                              id="mixBonoInput"
                                              value={bonoAmount} // Este se calculará automáticamente más tarde si se provee la fórmula
                                              readOnly
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed"
                                              step="0.01"
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
                                                      {unit.unidad} ({unit.tipo_bien}) - {formatCurrency(unit.valor_lista)} UF
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
                                              {unit.unidad} ({unit.tipo_bien}) - {formatCurrency(unit.valor_lista)} UF
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
            )} {/* FIN NUEVA TARJETA: Configuración de Cotización */}
            
            {/* NUEVA TARJETA: Resumen de Cotización */}
            {selectedUnidad && ( /* Solo mostrar esta tarjeta si hay una unidad seleccionada */
                <div className="bg-white shadow rounded p-6 mt-6">
                    <h3 className="text-xl font-semibold mb-4">Cotización</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Columna Izquierda: Precios de Unidades */}
                        <div>
                            <h4 className="text-lg font-semibold mb-3 flex items-center"><DollarSign className="h-5 w-5 mr-2 text-green-600" />Precios de Unidades</h4>
                            <div className="space-y-2 text-gray-700">
                                <div className="flex justify-between items-center">
                                    <span>Departamento {selectedUnidad.unidad}:</span>
                                    <span className="font-semibold">{formatCurrency(selectedUnidad.valor_lista)} UF</span>
                                </div>
                                {/* Mostrar descuento solo si es tipo 'descuento' o 'mix' y el monto es > 0 */}
                                {(quotationType === 'descuento' || quotationType === 'mix') && precioDescuentoDepartamento > 0 && (
                                  <div className="flex justify-between items-center">
                                      <span>Descuento ({formatCurrency(discountAmount)}%):</span>
                                      <span className="font-semibold text-red-600">- {formatCurrency(precioDescuentoDepartamento)} UF</span>
                                  </div>
                                )}
                                
                                {addedSecondaryUnits.map(unit => (
                                    <div key={unit.id} className="flex justify-between items-center">
                                        <span>{unit.tipo_bien} {unit.unidad}:</span>
                                        <span className="font-semibold">{formatCurrency(unit.valor_lista)} UF</span>
                                    </div>
                                ))}
                                <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                                    <span>Total Escritura:</span>
                                    <span>{formatCurrency(totalEscritura)} UF</span>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Forma de Pago */}
                        <div>
                            <h4 className="text-lg font-semibold mb-3 flex items-center"><Wallet className="h-5 w-5 mr-2 text-blue-600" />Forma de Pago</h4>
                            <div className="space-y-2 text-gray-700">
                                {/* Encabezados de tabla para la forma de pago */}
                                <div className="grid grid-cols-5 text-sm font-medium text-gray-500 pb-1 border-b">
                                    <span className="col-span-2">Glosa</span>
                                    <span className="text-right">%</span>
                                    <span className="text-right">Pesos</span>
                                    <span className="text-right">UF</span>
                                </div>

                                {/* Fila: Reserva */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Reserva:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoReserva / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoReserva)}</span>
                                    <div className="flex justify-end">
                                        <span className="w-24 text-right px-2 py-1 bg-gray-100 rounded-md border border-gray-300 font-semibold">{formatCurrency(pagoReserva)}</span>
                                    </div>
                                </div>

                                {/* Fila: Promesa */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Promesa:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoPromesa / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoPromesa)}</span>
                                    <div className="flex justify-end">
                                        <input
                                            type="number"
                                            value={pagoPromesa} // Mantener como number para edición directa
                                            onChange={e => setPagoPromesa(parseFloat(e.target.value) || 0)}
                                            className="w-24 text-right border rounded-md px-2 py-1"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {/* Fila: Pie */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Pie:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoPie / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoPie)}</span>
                                    <div className="flex justify-end">
                                        <input
                                            type="number"
                                            value={pagoPie} // Mantener como number para edición directa
                                            onChange={e => setPagoPie(parseFloat(e.target.value) || 0)}
                                            className="w-24 text-right border rounded-md px-2 py-1"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {/* Fila: Crédito Hipotecario (ajustable automáticamente) */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Crédito Hipotecario:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoCreditoHipotecarioCalculado)}</span>
                                    <div className="flex justify-end">
                                        <span className="w-24 text-right px-2 py-1 bg-gray-100 rounded-md border border-gray-300 font-semibold">{formatCurrency(pagoCreditoHipotecarioCalculado)}</span>
                                    </div>
                                </div>

                                {/* Fila: Bono Pie (ahora se usa pagoBonoPieCotizacion) */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Bono Pie:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoBonoPieCotizacion / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoBonoPieCotizacion)}</span>
                                    <div className="flex justify-end">
                                        <span className="w-24 text-right px-2 py-1 bg-gray-100 rounded-md border border-gray-300 font-semibold">{formatCurrency(pagoBonoPieCotizacion)}</span>
                                    </div>
                                </div>
                                
                                {/* Total Forma de Pago */}
                                <div className="grid grid-cols-5 items-center font-bold border-t pt-2 mt-2">
                                    <span className="col-span-2">Total:</span>
                                    {/* El porcentaje y pesos deben basarse en totalEscritura */}
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((totalFormaDePago / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(totalFormaDePago)}</span>
                                    <span className="text-right">{formatCurrency(totalFormaDePago)} UF</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP - Cotizador Brokers</footer>
    </div>
  );
};

export default BrokerQuotePage;