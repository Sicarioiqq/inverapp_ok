import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF'; // Asumo que este componente está correctamente implementado
import { useUFStore } from '../../stores/ufStore';
import { Building, Home, DollarSign, Calculator, Download, X, Search, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';

// Interfaces
interface StockUnidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipo_bien: string;
  tipologia: string;
  piso: string;
  orientacion: string;
  sup_util: number;
  sup_terraza: number;
  sup_total: number;
  valor_lista: number;
  estado_unidad: string;
  descuento: number | null;
}

interface Broker {
  id: string;
  name: string;
  business_name: string;
  slug: string;
  public_access_token: string;
}

interface ProjectCommercialPolicy {
  project_name: string;
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
  observaciones: string | null;
  comuna: string | null;
}

// Validate broker access
const validateBroker = async (slug: string, token: string): Promise<Broker | null> => {
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .eq('slug', slug)
      .eq('public_access_token', token)
      .single();
    if (error) throw new Error('Error de validación:\n\nAcceso denegado: token inválido');
    return data;
  } catch (error) {
    console.error('Error validating broker:', error);
    throw error;
  }
};

// Fetch commercial policy for a project
const fetchCommercialPolicy = async (projectName: string): Promise<ProjectCommercialPolicy | null> => {
  try {
    const { data, error } = await supabase
      .from('project_commercial_policies')
      .select('*')
      .eq('project_name', projectName)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error in fetchCommercialPolicy:', error);
    return null;
  }
};

// Main component
const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const { ufValue, fetchUFValue } = useUFStore();
  
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<StockUnidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [commercialPolicy, setCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'principales' | 'secundarios' | 'configuracion'>('principales');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');
  
  const [currentBrokerCommissionRateForSelectedUnit, setCurrentBrokerCommissionRateForSelectedUnit] = useState<number | null>(null);
  const [brokerCommissionsMap, setBrokerCommissionsMap] = useState<Map<string, number>>(new Map());
  const [commissionsLoading, setCommissionsLoading] = useState(true);


  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bonoAmount, setBonoAmount] = useState(0);
  const [pagoReserva, setPagoReserva] = useState(0);
  const [pagoPromesa, setPagoPromesa] = useState(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState(0);
  const [pagoPie, setPagoPie] = useState(0);
  const [pagoPiePct, setPagoPiePct] = useState(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState(0);
  
  useEffect(() => {
    fetchUFValue();
  }, [fetchUFValue]);
  
  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);
      setCommissionsLoading(true);
      try {
        if (!brokerSlug || !accessToken) throw new Error('Parámetros de acceso inválidos');
        const validatedBroker = await validateBroker(brokerSlug, accessToken);
        setBroker(validatedBroker);
        
        if (validatedBroker) {
          const { data: commissionsData, error: commissionsError } = await supabase
            .from('broker_project_commissions')
            .select('project_name, commission_rate')
            .eq('broker_id', validatedBroker.id);

          if (commissionsError) throw commissionsError;

          const newMap = new Map<string, number>();
          commissionsData?.forEach(comm => {
            if (comm.project_name && typeof comm.commission_rate === 'number') {
                 newMap.set(comm.project_name, comm.commission_rate);
            }
          });
          setBrokerCommissionsMap(newMap);
          setCommissionsLoading(false);
        } else {
          setCommissionsLoading(false);
        }
        await fetchAllUnits();
      } catch (err: any) {
        console.error('Error initializing page:', err);
        setError(err.message || 'Error al cargar la página');
        setCommissionsLoading(false);
      } finally {
        setLoading(false);
      }
    };
    initializePage();
  }, [brokerSlug, accessToken]);
  
  const fetchAllUnits = async () => {
    try {
      let allUnitsData: StockUnidad[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('stock_unidades')
          .select('*')
          .eq('estado_unidad', 'Disponible')
          .range(from, from + size - 1)
          .order('proyecto_nombre', { ascending: true })
          .order('unidad', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          allUnitsData = [...allUnitsData, ...data];
          from += size;
          if (data.length < size) break;
        } else {
          break;
        }
      }
      setUnidades(allUnitsData);
    } catch (err) {
      console.error('Error fetching units:', err);
      setError('Error al cargar unidades de stock.');
    }
  };
  
  useEffect(() => {
    const fetchDetailsForSelectedUnit = async () => {
      if (selectedUnidad && broker) {
        try {
          const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
          setCommercialPolicy(policy);

          const commission = brokerCommissionsMap.get(selectedUnidad.proyecto_nombre) || null;
          setCurrentBrokerCommissionRateForSelectedUnit(commission);

          if (policy) {
            if (ufValue && policy.monto_reserva_pesos) {
              setPagoReserva(parseFloat((policy.monto_reserva_pesos / ufValue).toFixed(2)));
            } else {
              setPagoReserva(0);
            }
            setPagoBonoPieCotizacion(0);
          } else {
            setPagoReserva(0);
            setPagoBonoPieCotizacion(0);
          }
        } catch (err) {
          console.error("Error fetching policy for selected unit:", err);
          setCommercialPolicy(null);
          setCurrentBrokerCommissionRateForSelectedUnit(null);
        }
      } else {
        setCommercialPolicy(null);
        setCurrentBrokerCommissionRateForSelectedUnit(null);
      }
    };
    fetchDetailsForSelectedUnit();
  }, [selectedUnidad, broker, ufValue, brokerCommissionsMap]);

  const calculateBrokerMaxDiscountPercentage = (
    unidad: StockUnidad, 
    commissionRateForProject: number | null | undefined
  ): number => {
    const unidadDescuentoGeneral = unidad.descuento;
  
    if (typeof commissionRateForProject !== 'number' || commissionRateForProject === null ||
        typeof unidadDescuentoGeneral !== 'number' || unidadDescuentoGeneral === null) {
      return unidadDescuentoGeneral || 0;
    }
  
    const precioOriginal = unidad.valor_lista;
    if (precioOriginal <= 0) return 0;
  
    const precioMinimoInmobiliaria = precioOriginal * (1 - (unidadDescuentoGeneral / 100));
    const montoComisionBroker = precioMinimoInmobiliaria * (commissionRateForProject / 100);
    const precioMinimoConComisionBroker = precioMinimoInmobiliaria + montoComisionBroker;
    const montoDescuentoBrokerPuedeOfrecer = precioOriginal - precioMinimoConComisionBroker;
    
    let porcentajeDescuentoBrokerPuedeOfrecer = 0;
    if (precioOriginal > 0) { // Evitar división por cero
        porcentajeDescuentoBrokerPuedeOfrecer = (montoDescuentoBrokerPuedeOfrecer / precioOriginal) * 100;
    }
  
    return Math.max(0, parseFloat(porcentajeDescuentoBrokerPuedeOfrecer.toFixed(2)));
  };
  

  const uniqueProjects = useMemo(() => Array.from(new Set(unidades.map(u => u.proyecto_nombre))), [unidades]);
  
  const uniqueTipologias = useMemo(() => {
    if (!selectedProjectFilter) return [];
    return Array.from(new Set(unidades.filter(u => u.proyecto_nombre === selectedProjectFilter && u.tipo_bien === 'DEPARTAMENTO').map(u => u.tipologia).filter(Boolean) as string[]));
  }, [unidades, selectedProjectFilter]);

  const filteredUnidades = useMemo(() => {
    let tempUnidades = unidades;
    if (activeTab === 'principales') {
        tempUnidades = tempUnidades.filter(u => u.tipo_bien === 'DEPARTAMENTO');
        if (selectedProjectFilter) {
            tempUnidades = tempUnidades.filter(u => u.proyecto_nombre === selectedProjectFilter);
        }
        if (selectedTipologia) {
            tempUnidades = tempUnidades.filter(u => u.tipologia === selectedTipologia);
        }
    } else if (activeTab === 'secundarios') {
        if (selectedUnidad) { 
            tempUnidades = unidades.filter(u => 
                u.proyecto_nombre === selectedUnidad.proyecto_nombre && 
                u.tipo_bien !== 'DEPARTAMENTO' &&
                !addedSecondaryUnits.some(added => added.id === u.id)
            );
        } else if (selectedProjectFilter) { 
             tempUnidades = unidades.filter(u => u.proyecto_nombre === selectedProjectFilter && u.tipo_bien !== 'DEPARTAMENTO');
        } else { 
            tempUnidades = unidades.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
        }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      tempUnidades = tempUnidades.filter(u => 
        u.proyecto_nombre.toLowerCase().includes(term) ||
        u.unidad.toLowerCase().includes(term) ||
        (u.tipologia && u.tipologia.toLowerCase().includes(term)) ||
        u.tipo_bien.toLowerCase().includes(term)
      );
    }
    
    if (sortField) {
      tempUnidades = [...tempUnidades].sort((a, b) => {
        let valueA: any = a[sortField as keyof StockUnidad];
        let valueB: any = b[sortField as keyof StockUnidad];
        if (valueA === null || valueA === undefined) valueA = ''; 
        if (valueB === null || valueB === undefined) valueB = '';
        let comparison = 0;
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          comparison = valueA.localeCompare(valueB);
        } else if (typeof valueA === 'number' && typeof valueB === 'number') {
          comparison = valueA - valueB;
        } else {
          comparison = String(valueA).localeCompare(String(valueB));
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return tempUnidades;
  }, [unidades, searchTerm, activeTab, selectedProjectFilter, selectedTipologia, sortField, sortDirection, selectedUnidad, addedSecondaryUnits]);
  
  const availableSecondaryUnits = useMemo(() => {
    if (!selectedUnidad) return [];
    return unidades.filter(unidad => 
      unidad.proyecto_nombre === selectedUnidad.proyecto_nombre &&
      unidad.tipo_bien !== 'DEPARTAMENTO' &&
      !addedSecondaryUnits.some(added => added.id === unidad.id)
    );
  }, [unidades, selectedUnidad, addedSecondaryUnits]);
  
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  const maxDiscountForSelectedUnit = selectedUnidad ? calculateBrokerMaxDiscountPercentage(selectedUnidad, currentBrokerCommissionRateForSelectedUnit) : 0;

  const precioDescuentoDepartamento = useMemo(() => {
    if (!selectedUnidad) return 0;
    const actualDiscountToApply = Math.min(discountAmount, maxDiscountForSelectedUnit);
    if (quotationType === 'descuento' || quotationType === 'mix') {
      return precioBaseDepartamento * (actualDiscountToApply / 100);
    }
    return 0;
  }, [selectedUnidad, quotationType, discountAmount, precioBaseDepartamento, maxDiscountForSelectedUnit]);
  
  const precioDepartamentoConDescuento = useMemo(() => {
    return precioBaseDepartamento - precioDescuentoDepartamento;
  }, [precioBaseDepartamento, precioDescuentoDepartamento]);
  
  const precioTotalSecundarios = useMemo(() => {
    return addedSecondaryUnits.reduce((total, unit) => total + (unit.valor_lista || 0), 0);
  }, [addedSecondaryUnits]);
  
  const totalEscrituraBruto = useMemo(() => { 
    return precioDepartamentoConDescuento + precioTotalSecundarios;
  }, [precioDepartamentoConDescuento, precioTotalSecundarios]);

  const totalEscrituraNetoCliente = useMemo(() => { 
    let finalPrice = totalEscrituraBruto;
    if ((quotationType === 'bono' || quotationType === 'mix') && bonoAmount > 0) {
      finalPrice -= bonoAmount;
    }
    return Math.max(0, finalPrice);
  }, [totalEscrituraBruto, quotationType, bonoAmount]);
  
  const pagoCreditoHipotecarioCalculado = useMemo(() => {
    const montoACubrirPorCliente = totalEscrituraNetoCliente - pagoBonoPieCotizacion;
    const pagosPreviosCliente = pagoReserva + pagoPromesa + pagoPie;
    return Math.max(0, montoACubrirPorCliente - pagosPreviosCliente);
  }, [totalEscrituraNetoCliente, pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion]);
  
  const totalFormaDePago = useMemo(() => {
    return pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;
  }, [pagoReserva, pagoPromesa, pagoPie, pagoCreditoHipotecarioCalculado, pagoBonoPieCotizacion]);
  

  const handleSelectUnidad = (unidad: StockUnidad) => {
    setSelectedUnidad(unidad);
    setSelectedProjectFilter(unidad.proyecto_nombre); 
    setActiveTab('configuracion');
    setPagoReserva(0);
    setPagoPromesa(0);
    setPagoPromesaPct(0);
    setPagoPie(0);
    setPagoPiePct(0);
    setPagoBonoPieCotizacion(0);
    setAddedSecondaryUnits([]); 
    setDiscountAmount(0); 
    setBonoAmount(0);
  };
  
  const handleAddSecondaryUnit = (unit: StockUnidad) => {
    setAddedSecondaryUnits(prev => [...prev, unit]);
  };
  
  const handleRemoveSecondaryUnit = (unitId: string) => {
    setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
  };
  
  const handlePromesaPctChange = (value: number) => {
    const newPct = Math.max(0, Math.min(100, value));
    setPagoPromesaPct(newPct);
    const referencePriceForPct = totalEscrituraNetoCliente; 
    const newAmount = referencePriceForPct > 0 ? parseFloat((referencePriceForPct * (newPct / 100)).toFixed(2)) : 0;
    setPagoPromesa(newAmount);
  };
  
  const handlePiePctChange = (value: number) => {
    const newPct = Math.max(0, Math.min(100, value));
    setPagoPiePct(newPct);
    const referencePriceForPct = totalEscrituraNetoCliente;
    const newAmount = referencePriceForPct > 0 ? parseFloat((referencePriceForPct * (newPct / 100)).toFixed(2)) : 0;
    setPagoPie(newAmount);
  };
  
  const handlePromesaChange = (value: number) => {
    const newValue = Math.max(0, value);
    setPagoPromesa(newValue);
    const referencePriceForPct = totalEscrituraNetoCliente;
    const newPct = referencePriceForPct > 0 ? parseFloat(((newValue / referencePriceForPct) * 100).toFixed(2)) : 0;
    setPagoPromesaPct(newPct);
  };
  
  const handlePieChange = (value: number) => {
    const newValue = Math.max(0, value);
    setPagoPie(newValue);
    const referencePriceForPct = totalEscrituraNetoCliente;
    const newPct = referencePriceForPct > 0 ? parseFloat(((newValue / referencePriceForPct) * 100).toFixed(2)) : 0;
    setPagoPiePct(newPct);
  };
  
  const formatNumberWithTwoDecimals = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00'; // Coma para decimal chileno
    return new Intl.NumberFormat('es-CL', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatPercentageForDisplay = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '0,00%';
    // Utiliza formatNumberWithTwoDecimals que ya formatea como "XX,YY"
    return `${formatNumberWithTwoDecimals(value)}%`;
  };
  
  const formatCLP = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No especificada';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (correctedDate < today) return 'INMEDIATA';
    return new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(correctedDate);
  };

  const isFormReadyForPDF = clientName && clientRut && selectedUnidad && Math.abs(totalFormaDePago - totalEscrituraNetoCliente) <= 0.01;

  if (loading || (broker && commissionsLoading)) { 
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-700">Cargando datos...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center text-red-500 mb-4"><X className="h-12 w-12" /></div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Error</h2>
          <p className="text-gray-600 text-center whitespace-pre-line">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!broker) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center text-red-500 mb-4"><X className="h-12 w-12" /></div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 text-center">No se pudo validar el acceso al cotizador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logoinversiones.png" alt="Logo Inversiones" className="h-12 mr-4" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cotizador {broker.name}</h1>
              <p className="text-sm text-gray-500">{broker.business_name}</p>
            </div>
          </div>
          {ufValue && (<div className="bg-blue-50 px-3 py-1 rounded-md"><span className="text-sm font-medium text-blue-700">UF: {formatCLP(ufValue)}</span></div>)}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {['principales', 'secundarios', 'configuracion'].map((tabName) => (
              <button
                key={tabName}
                onClick={() => setActiveTab(tabName as any)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tabName 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabName === 'principales' ? 'Principales' : tabName === 'secundarios' ? 'Secundarios' : 'Configuración Cotización'}
              </button>
            ))}
          </nav>
        </div>
        
        {activeTab === 'principales' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="projectFilterPrincipales" className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <select id="projectFilterPrincipales" value={selectedProjectFilter} onChange={(e) => { setSelectedProjectFilter(e.target.value); setSelectedTipologia(''); }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">Todos los proyectos</option>
                    {uniqueProjects.map(project => (<option key={project} value={project}>{project}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tipologiaFilterPrincipales" className="block text-sm font-medium text-gray-700 mb-1">Tipología</label>
                  <select id="tipologiaFilterPrincipales" value={selectedTipologia} onChange={(e) => setSelectedTipologia(e.target.value)} disabled={!selectedProjectFilter} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500">
                    <option value="">Todas las tipologías</option>
                    {uniqueTipologias.map(tipologia => (<option key={tipologia} value={tipologia}>{tipologia}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="searchPrincipales" className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                    <input id="searchPrincipales" type="text" placeholder="Buscar unidad..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['proyecto_nombre', 'unidad', 'tipologia', 'piso', 'sup_util', 'valor_lista'].map(field => (
                        <th key={field} className={`px-6 py-3 text-${field.includes('sup') || field.includes('valor') ? 'right' : 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer`} onClick={() => handleSort(field)}>
                          {field === 'proyecto_nombre' ? 'Proyecto' : field === 'sup_util' ? 'Sup. Útil' : field === 'valor_lista' ? 'Valor UF' : field.charAt(0).toUpperCase() + field.slice(1)}
                          {sortField === field && (<span className="ml-1">{sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}</span>)}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Desc. Max. Broker</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUnidades.map((unidad) => {
                      const commissionForUnitProject = brokerCommissionsMap.get(unidad.proyecto_nombre);
                      const maxBrokerDiscountForUnit = calculateBrokerMaxDiscountPercentage(unidad, commissionForUnitProject);
                      return (
                        <tr key={unidad.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unidad.proyecto_nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unidad.unidad}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unidad.tipologia || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unidad.piso || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatNumberWithTwoDecimals(unidad.sup_util)} m²</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatNumberWithTwoDecimals(unidad.valor_lista)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">{formatPercentageForDisplay(maxBrokerDiscountForUnit)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button onClick={() => handleSelectUnidad(unidad)} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Seleccionar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'secundarios' && (
           <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros Unidades Secundarias</h2>
               <p className="text-sm text-gray-600 mb-4">
                {selectedUnidad 
                  ? `Mostrando unidades secundarias para el proyecto: ${selectedUnidad.proyecto_nombre}. Seleccione unidades para agregar a la cotización.`
                  : "Seleccione una unidad principal primero (desde la pestaña 'Principales' o 'Configuración Cotización') para ver y agregar unidades secundarias."
                }
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="projectFilterSecundarios" className="block text-sm font-medium text-gray-700 mb-1">Proyecto (Principal Seleccionado)</label>
                  <input id="projectFilterSecundarios" type="text" value={selectedUnidad ? selectedUnidad.proyecto_nombre : 'N/A - Seleccione unidad principal'} readOnly className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500" />
                </div>
                <div>
                  <label htmlFor="searchSecundarios" className="block text-sm font-medium text-gray-700 mb-1">Buscar Unidad Secundaria</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                    <input id="searchSecundarios" type="text" placeholder="Buscar por unidad, tipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" disabled={!selectedUnidad} />
                  </div>
                </div>
              </div>
            </div>

            {selectedUnidad && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['unidad', 'tipo_bien', 'sup_total', 'valor_lista'].map(field => (
                           <th key={field} className={`px-6 py-3 text-${field.includes('sup') || field.includes('valor') ? 'right' : 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer`} onClick={() => handleSort(field)}>
                           {field === 'tipo_bien' ? 'Tipo' : field === 'sup_total' ? 'Sup. Total' : field === 'valor_lista' ? 'Valor UF' : field.charAt(0).toUpperCase() + field.slice(1)}
                           {sortField === field && (<span className="ml-1">{sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}</span>)}
                         </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUnidades.map((unidad) => ( 
                        <tr key={unidad.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unidad.unidad}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unidad.tipo_bien}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatNumberWithTwoDecimals(unidad.sup_total)} m²</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatNumberWithTwoDecimals(unidad.valor_lista)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button onClick={() => handleAddSecondaryUnit(unidad)} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"><Plus className="h-4 w-4 mr-1" /> Agregar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'configuracion' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Home className="h-5 w-5 text-blue-500 mr-2" />Selección de Unidad</h2>
                <div className="space-y-4">
                  <div className="relative">
                    <label htmlFor="mainUnitInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Unidad Principal</label>
                    <div className="relative">
                      <input id="mainUnitInputConfig" type="text" value={selectedUnidad ? `${selectedUnidad.proyecto_nombre} - ${selectedUnidad.unidad} (${selectedUnidad.tipologia || selectedUnidad.tipo_bien})` : ''} onClick={() => { setActiveTab('principales');}} placeholder="Seleccione una unidad principal desde la pestaña 'Principales'" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10 cursor-pointer" readOnly />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><ChevronDown className="h-5 w-5 text-gray-400" /></div>
                    </div>
                  </div>
                  {selectedUnidad && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Unidades Secundarias</label>
                        <button type="button" onClick={() => { setActiveTab('secundarios'); setSearchTerm('');} } className="text-sm text-blue-600 hover:text-blue-800 flex items-center"><Plus className="h-4 w-4 mr-1" />{addedSecondaryUnits.length > 0 ? "Agregar/Modificar" : "Agregar"}</button>
                      </div>
                      {addedSecondaryUnits.length > 0 ? (<div className="mt-2 space-y-2">{addedSecondaryUnits.map(unit => (<div key={unit.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md"><div><div className="font-medium">{unit.tipo_bien} {unit.unidad}</div><div className="text-sm text-gray-500">{formatNumberWithTwoDecimals(unit.valor_lista)} UF</div></div><button type="button" onClick={() => handleRemoveSecondaryUnit(unit.id)} className="text-red-500 hover:text-red-700"><X className="h-5 w-5" /></button></div>))}</div>) : (<p className="text-sm text-gray-500 italic">No hay unidades secundarias.</p>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del Cliente</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="clientNameInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input id="clientNameInputConfig" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ingrese nombre" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div>
                  <div><label htmlFor="clientRutInputConfig" className="block text-sm font-medium text-gray-700 mb-1">RUT</label><input id="clientRutInputConfig" type="text" value={clientRut} onChange={(e) => setClientRut(e.target.value)} placeholder="Ingrese RUT" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div>
                </div>
              </div>
              {selectedUnidad && (<div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Building className="h-5 w-5 text-blue-500 mr-2" />Info. Unidad Seleccionada</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700">Tipo de Bien</label><div className="mt-1 text-gray-900">{selectedUnidad.tipo_bien}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">N° Unidad</label><div className="mt-1 text-gray-900">{selectedUnidad.unidad}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Tipología</label><div className="mt-1 text-gray-900">{selectedUnidad.tipologia || 'N/A'}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Piso</label><div className="mt-1 text-gray-900">{selectedUnidad.piso || 'N/A'}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Orientación</label><div className="mt-1 text-gray-900">{selectedUnidad.orientacion || 'N/A'}</div></div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700">Sup. Útil</label><div className="mt-1 text-gray-900">{formatNumberWithTwoDecimals(selectedUnidad.sup_util)} m²</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Sup. Terraza</label><div className="mt-1 text-gray-900">{formatNumberWithTwoDecimals(selectedUnidad.sup_terraza)} m²</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Sup. Total</label><div className="mt-1 text-gray-900">{formatNumberWithTwoDecimals(selectedUnidad.sup_total)} m²</div></div>
                </div>
              </div>)}
              {selectedUnidad && commercialPolicy && (<div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><DollarSign className="h-5 w-5 text-blue-500 mr-2" />Política Comercial ({commercialPolicy.project_name})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700">Monto Reserva</label><div className="mt-1 text-gray-900">{formatCLP(commercialPolicy.monto_reserva_pesos)}{ufValue && commercialPolicy.monto_reserva_pesos > 0 ? ` (${formatNumberWithTwoDecimals(commercialPolicy.monto_reserva_pesos / ufValue)} UF)` : ''}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700">Bono Pie Máximo</label><div className="mt-1 text-gray-900">{(commercialPolicy.bono_pie_max_pct * 100).toFixed(2)}%</div></div>
                  {commercialPolicy.fecha_tope && (<div><label className="block text-sm font-medium text-gray-700">Fecha Tope Entrega</label><div className="mt-1 text-gray-900">{formatDate(commercialPolicy.fecha_tope)}</div></div>)}
                  {commercialPolicy.comuna && (<div><label className="block text-sm font-medium text-gray-700">Comuna</label><div className="mt-1 text-gray-900">{commercialPolicy.comuna}</div></div>)}
                </div>
                {commercialPolicy.observaciones && (<div className="mt-4"><label className="block text-sm font-medium text-gray-700">Observaciones</label><div className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{commercialPolicy.observaciones}</div></div>)}
              </div>)}
            </div>
            
            <div className="space-y-6">
              {selectedUnidad && (<>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><DollarSign className="h-5 w-5 text-blue-500 mr-2" />Precios</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cotización</label>
                      <div className="flex space-x-4">
                        <label className="inline-flex items-center"><input type="radio" value="descuento" checked={quotationType === 'descuento'} onChange={() => setQuotationType('descuento')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" /><span className="ml-2 text-sm text-gray-700">Descuento</span></label>
                        <label className="inline-flex items-center"><input type="radio" value="bono" checked={quotationType === 'bono'} onChange={() => setQuotationType('bono')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" /><span className="ml-2 text-sm text-gray-700">Bono</span></label>
                        <label className="inline-flex items-center"><input type="radio" value="mix" checked={quotationType === 'mix'} onChange={() => setQuotationType('mix')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" /><span className="ml-2 text-sm text-gray-700">Mixto</span></label>
                      </div>
                    </div>
                    {(quotationType === 'descuento' || quotationType === 'mix') && (
                      <div>
                        <label htmlFor="discountAmountInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Descuento (Máx: {formatPercentageForDisplay(maxDiscountForSelectedUnit)})</label>
                        <div className="flex items-center">
                          <input id="discountAmountInputConfig" type="number" min="0" max={maxDiscountForSelectedUnit} step="0.01" value={discountAmount} onChange={(e) => { const val = parseFloat(e.target.value) || 0; setDiscountAmount(Math.min(Math.max(0, val), maxDiscountForSelectedUnit));}} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                          <span className="ml-2">%</span>
                        </div>
                      </div>
                    )}
                    {(quotationType === 'bono' || quotationType === 'mix') && (
                      <div><label htmlFor="bonoAmountInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Monto Bono (UF)</label><input id="bonoAmountInputConfig" type="number" min="0" step="0.01" value={bonoAmount} onChange={(e) => setBonoAmount(Math.max(0, parseFloat(e.target.value)) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div>
                    )}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-sm text-gray-500">Precio Base Depto:</span><span className="text-sm font-medium">{formatNumberWithTwoDecimals(precioBaseDepartamento)} UF</span></div>
                        {precioDescuentoDepartamento > 0 && (<div className="flex justify-between"><span className="text-sm text-gray-500">Descuento Aplicado ({formatPercentageForDisplay(discountAmount)}):</span><span className="text-sm font-medium text-red-600">-{formatNumberWithTwoDecimals(precioDescuentoDepartamento)} UF</span></div>)}
                        <div className="flex justify-between"><span className="text-sm text-gray-500">Precio Depto. con Desc:</span><span className="text-sm font-medium">{formatNumberWithTwoDecimals(precioDepartamentoConDescuento)} UF</span></div>
                        {bonoAmount > 0 && (quotationType === 'bono' || quotationType === 'mix') && (<div className="flex justify-between"><span className="text-sm text-gray-500">Bono Adicional Aplicado:</span><span className="text-sm font-medium text-red-600">-{formatNumberWithTwoDecimals(bonoAmount)} UF</span></div>)}
                         <div className="flex justify-between font-semibold"><span className="text-sm text-gray-600">Precio Depto. Neto Cliente:</span><span className="text-sm">{formatNumberWithTwoDecimals(precioDepartamentoConDescuento - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0) )} UF</span></div>
                        {precioTotalSecundarios > 0 && (<div className="flex justify-between"><span className="text-sm text-gray-500">Precio Un. Secundarias:</span><span className="text-sm font-medium">{formatNumberWithTwoDecimals(precioTotalSecundarios)} UF</span></div>)}
                        <div className="flex justify-between pt-2 border-t border-gray-200"><span className="text-base font-medium text-gray-700">Total Cotización (Cliente):</span><span className="text-base font-bold">{formatNumberWithTwoDecimals(totalEscrituraNetoCliente)} UF</span></div>
                        {ufValue && (<div className="flex justify-between"><span className="text-sm text-gray-500">Equivalente en Pesos:</span><span className="text-sm text-gray-500">{formatCLP(totalEscrituraNetoCliente * ufValue)}</span></div>)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Calculator className="h-5 w-5 text-blue-500 mr-2" />Forma de Pago</h2>
                    <div className="space-y-4">
                      <div><label htmlFor="pagoReservaInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Reserva (UF)</label><input id="pagoReservaInputConfig" type="number" min="0" step="0.01" value={pagoReserva} onChange={(e) => setPagoReserva(Math.max(0,parseFloat(e.target.value)) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Promesa</label><div className="grid grid-cols-2 gap-4"><div><div className="flex items-center"><input type="number" min="0" max="100" step="0.01" value={pagoPromesaPct} onChange={(e) => handlePromesaPctChange(parseFloat(e.target.value) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /><span className="ml-2">%</span></div></div><div><input type="number" min="0" step="0.01" value={pagoPromesa} onChange={(e) => handlePromesaChange(parseFloat(e.target.value) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div></div></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Pie</label><div className="grid grid-cols-2 gap-4"><div><div className="flex items-center"><input type="number" min="0" max="100" step="0.01" value={pagoPiePct} onChange={(e) => handlePiePctChange(parseFloat(e.target.value) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /><span className="ml-2">%</span></div></div><div><input type="number" min="0" step="0.01" value={pagoPie} onChange={(e) => handlePieChange(parseFloat(e.target.value) || 0)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" /></div></div></div>
                      {commercialPolicy && commercialPolicy.bono_pie_max_pct > 0 && (
                        <div>
                          <label htmlFor="pagoBonoPieInputConfig" className="block text-sm font-medium text-gray-700 mb-1">Bono Pie Inmobiliaria (UF) - Máx {commercialPolicy.bono_pie_max_pct > 0 && totalEscrituraBruto > 0 ? formatNumberWithTwoDecimals(totalEscrituraBruto * commercialPolicy.bono_pie_max_pct) : '0,00'} UF ({(commercialPolicy.bono_pie_max_pct * 100).toFixed(2)}%)</label>
                          <input id="pagoBonoPieInputConfig" type="number" min="0" max={totalEscrituraBruto > 0 && commercialPolicy.bono_pie_max_pct > 0 ? parseFloat((totalEscrituraBruto * commercialPolicy.bono_pie_max_pct).toFixed(2)) : 0} step="0.01" value={pagoBonoPieCotizacion} onChange={(e) => {const value = parseFloat(e.target.value) || 0; const maxBono = totalEscrituraBruto > 0 && commercialPolicy.bono_pie_max_pct > 0 ? parseFloat((totalEscrituraBruto * commercialPolicy.bono_pie_max_pct).toFixed(2)) : 0; setPagoBonoPieCotizacion(Math.min(Math.max(0, value), maxBono));}} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                          {pagoBonoPieCotizacion > 0 && totalEscrituraBruto > 0 && (<p className="mt-1 text-xs text-gray-500">{((pagoBonoPieCotizacion / totalEscrituraBruto) * 100).toFixed(2).replace('.',',')}% del total bruto</p>)}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Crédito Hipotecario (UF)</label>
                        <input type="text" value={formatNumberWithTwoDecimals(pagoCreditoHipotecarioCalculado)} className="block w-full rounded-md bg-gray-100 border-gray-300 shadow-sm" readOnly />
                        {pagoCreditoHipotecarioCalculado > 0 && totalEscrituraNetoCliente > 0 && (<p className="mt-1 text-xs text-gray-500">{((pagoCreditoHipotecarioCalculado / totalEscrituraNetoCliente) * 100).toFixed(2).replace('.',',')}% del total neto cliente</p>)}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center"><span className="font-medium text-gray-700">Total Pagado por Cliente:</span><span className="font-bold text-lg">{formatNumberWithTwoDecimals(totalFormaDePago)} UF</span></div>
                        { Math.abs(totalFormaDePago - totalEscrituraNetoCliente) > 0.01 && (<div className="mt-2 p-2 bg-red-50 text-red-600 rounded-md text-sm"><div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" /><span>La forma de pago ({formatNumberWithTwoDecimals(totalFormaDePago)}) no coincide con el total neto para el cliente ({formatNumberWithTwoDecimals(totalEscrituraNetoCliente)}). Diferencia: {formatNumberWithTwoDecimals(Math.abs(totalFormaDePago - totalEscrituraNetoCliente))} UF</span></div></div>)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Generar Cotización</h2>
                    {isFormReadyForPDF ? (
                      <PDFDownloadLink document={<BrokerQuotePDF cliente={clientName} rut={clientRut} ufValue={ufValue || 0} selectedUnidad={selectedUnidad!} addedSecondaryUnits={addedSecondaryUnits} quotationType={quotationType} discountAmount={discountAmount} bonoAmount={bonoAmount} pagoReserva={pagoReserva} pagoPromesa={pagoPromesa} pagoPromesaPct={pagoPromesaPct} pagoPie={pagoPie} pagoPiePct={pagoPiePct} pagoBonoPieCotizacion={pagoBonoPieCotizacion} precioBaseDepartamento={precioBaseDepartamento} precioDescuentoDepartamento={precioDescuentoDepartamento} precioDepartamentoConDescuento={precioDepartamentoConDescuento} precioTotalSecundarios={precioTotalSecundarios} totalEscritura={totalEscrituraBruto} totalEscrituraNetoCliente={totalEscrituraNetoCliente} pagoCreditoHipotecarioCalculado={pagoCreditoHipotecarioCalculado} totalFormaDePago={totalFormaDePago} brokerName={broker.name} commercialPolicy={commercialPolicy} />} fileName={`Cotizacion_${selectedUnidad!.proyecto_nombre}_${selectedUnidad!.unidad}_${clientName.replace(/\s/g, '_')}.pdf`} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" >
                        {({ loading: pdfLoading }) => (<><Download className="h-5 w-5 mr-2" />{pdfLoading ? 'Generando PDF...' : 'Descargar Cotización PDF'}</>)}
                      </PDFDownloadLink>
                    ) : (
                      <button type="button" disabled className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"><Download className="h-5 w-5 mr-2" />Descargar Cotización PDF</button>
                    )}
                    {(!clientName || !clientRut) && (<p className="mt-2 text-xs text-amber-600">Debe ingresar el nombre y RUT del cliente.</p>)}
                    {!selectedUnidad && (<p className="mt-2 text-xs text-amber-600">Debe seleccionar una unidad principal.</p>)}
                    {selectedUnidad && Math.abs(totalFormaDePago - totalEscrituraNetoCliente) > 0.01 && (<p className="mt-2 text-xs text-red-600">La forma de pago debe coincidir con el total neto para el cliente.</p>)}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">© {new Date().getFullYear()} {broker.business_name}. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default BrokerQuotePage;