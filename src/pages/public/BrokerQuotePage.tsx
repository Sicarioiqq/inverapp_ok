import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useUFStore } from '../../stores/ufStore';
import { Building, Home, DollarSign, Calculator, Download, Check, X, Search, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';

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

interface BrokerProjectCommission {
  broker_id: string;
  project_name: string;
  commission_rate: number;
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

    if (error) {
      throw new Error('Error de validación:\n\nAcceso denegado: token inválido');
    }

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

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is acceptable for maybeSingle()
      console.error('Error fetching commercial policy:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchCommercialPolicy:', error);
    return null;
  }
};

// Fetch broker commission rate for a project
const fetchBrokerCommissionRate = async (brokerId: string, projectName: string): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('broker_project_commissions')
      .select('commission_rate')
      .eq('broker_id', brokerId)
      .eq('project_name', projectName)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching broker commission rate:', error);
      throw error;
    }

    return data?.commission_rate || null;
  } catch (error) {
    console.error('Error in fetchBrokerCommissionRate:', error);
    return null;
  }
};

// Main component
const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const { ufValue, fetchUFValue } = useUFStore();
  
  // State variables
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<StockUnidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnidadesDropdown, setShowUnidadesDropdown] = useState(false);
  const [showSecondaryUnitsDropdown, setShowSecondaryUnitsDropdown] = useState(false);
  const [commercialPolicy, setCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'principales' | 'secundarios' | 'configuracion'>('principales');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');
  const [brokerCommissionRate, setBrokerCommissionRate] = useState<number | null>(null);
  
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState(0); // This is the discount % the broker inputs for the current quote
  const [bonoAmount, setBonoAmount] = useState(0);
  const [pagoReserva, setPagoReserva] = useState(0);
  const [pagoPromesa, setPagoPromesa] = useState(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState(0);
  const [pagoPie, setPagoPie] = useState(0);
  const [pagoPiePct, setPagoPiePct] = useState(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState(0);
  
  // Fetch UF value on component mount
  useEffect(() => {
    fetchUFValue();
  }, [fetchUFValue]);
  
  // Validate broker and fetch data
  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true);
        
        if (!brokerSlug || !accessToken) {
          throw new Error('Parámetros de acceso inválidos');
        }
        
        // Validate broker
        const validatedBroker = await validateBroker(brokerSlug, accessToken);
        setBroker(validatedBroker);
        
        // Fetch available units
        await fetchAllUnits();
        
      } catch (err: any) {
        console.error('Error initializing page:', err);
        setError(err.message || 'Error al cargar la página');
      } finally {
        setLoading(false);
      }
    };
    
    initializePage();
  }, [brokerSlug, accessToken]);
  
  // Fetch all units with pagination to handle large datasets
  const fetchAllUnits = async () => {
    try {
      let allUnits: StockUnidad[] = [];
      let from = 0;
      const size = 1000; // Fetch in batches of 1000
      
      while (true) {
        const { data, error } = await supabase
          .from('stock_unidades')
          .select('*', { count: 'exact' })
          .eq('estado_unidad', 'Disponible')
          .range(from, from + size - 1)
          .order('proyecto_nombre', { ascending: true })
          .order('unidad', { ascending: true });
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          allUnits = [...allUnits, ...data];
          from += size;
          
          if (data.length < size) break;
        } else {
          break; 
        }
      }
      
      setUnidades(allUnits);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };
  
  // Fetch commercial policy and broker commission rate when a unit is selected or broker context changes
  useEffect(() => {
    const fetchPolicyAndCommission = async () => {
      if (selectedUnidad && broker) { // Ensure broker is also available
        try {
            const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
            setCommercialPolicy(policy);
            
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
            
            const commissionRate = await fetchBrokerCommissionRate(broker.id, selectedUnidad.proyecto_nombre);
            setBrokerCommissionRate(commissionRate);

        } catch (err) {
            console.error("Error fetching policy or commission for selected unit:", err);
            setCommercialPolicy(null); 
            setBrokerCommissionRate(null); 
        }
      } else { // If no selectedUnidad or no broker, reset commission rate
        setBrokerCommissionRate(null);
        setCommercialPolicy(null);
      }
    };
    
    fetchPolicyAndCommission();
  }, [selectedUnidad, ufValue, broker]); // Add broker to dependency array
  
  // Calculate available discount for broker based on their commission
  // This is the MAXIMUM discount the broker can offer on this unit.
  const calculateBrokerMaxDiscountPercentage = (unidad: StockUnidad): number => {
    // Ensure brokerCommissionRate is a valid number, otherwise, broker-specific discount cannot be calculated.
    // Also ensure unidad.descuento (overall unit discount) is a valid number.
    if (typeof brokerCommissionRate !== 'number' || brokerCommissionRate === null || 
        typeof unidad.descuento !== 'number' || unidad.descuento === null) {
        // If commission rate is unknown or no base discount, return the general unit discount or 0.
        return unidad.descuento || 0; 
    }
    
    const precioOriginal = unidad.valor_lista;
    if (precioOriginal <= 0) return 0; 

    // Precio Mínimo de Venta para la inmobiliaria (después del descuento general de la unidad)
    // unidad.descuento es el % de descuento general. Ej: 20 para 20%.
    const precioMinimoInmobiliaria = precioOriginal * (1 - (unidad.descuento / 100));
    
    // Monto de la comisión del broker, calculado sobre el precio mínimo de venta para la inmobiliaria.
    // brokerCommissionRate es el % de comisión del broker. Ej: 5 para 5%.
    const montoComisionBroker = precioMinimoInmobiliaria * (brokerCommissionRate / 100);
    
    // Precio final que la inmobiliaria espera recibir + la comisión del broker.
    const precioMinimoConComisionBroker = precioMinimoInmobiliaria + montoComisionBroker;
    
    // Monto del descuento que el broker puede ofrecer al cliente final.
    // Es la diferencia entre el precio original y el precio que cubre el mínimo de la inmobiliaria más la comisión del broker.
    const montoDescuentoBrokerPuedeOfrecer = precioOriginal - precioMinimoConComisionBroker;
    
    // Porcentaje de descuento que el broker puede ofrecer, sobre el precio original.
    const porcentajeDescuentoBrokerPuedeOfrecer = (montoDescuentoBrokerPuedeOfrecer / precioOriginal) * 100;
    
    return Math.max(0, parseFloat(porcentajeDescuentoBrokerPuedeOfrecer.toFixed(2))); 
  };

  // Get unique projects for filtering
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(unidades.map(u => u.proyecto_nombre)));
  }, [unidades]);
  
  // Get unique tipologias for the selected project
  const uniqueTipologias = useMemo(() => {
    if (!selectedProject) return [];
    return Array.from(
      new Set(
        unidades
          .filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO')
          .map(u => u.tipologia)
          .filter(Boolean) as string[]
      )
    );
  }, [unidades, selectedProject]);
  
  const filteredUnidades = useMemo(() => {
    let filtered = unidades;
    
    if (selectedProject) {
      filtered = filtered.filter(u => u.proyecto_nombre === selectedProject);
    }
    
    if (activeTab === 'principales') {
      filtered = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');
      if (selectedTipologia) {
        filtered = filtered.filter(u => u.tipologia === selectedTipologia);
      }
    } else if (activeTab === 'secundarios') {
      // For 'secundarios' tab, units are already filtered by selectedUnidad.proyecto_nombre
      // if selectedUnidad exists. Otherwise, show all non-DEPARTAMENTO based on selectedProject.
      if (selectedUnidad) {
         filtered = unidades.filter(u => 
            u.proyecto_nombre === selectedUnidad.proyecto_nombre && 
            u.tipo_bien !== 'DEPARTAMENTO' &&
            !addedSecondaryUnits.some(added => added.id === u.id) // Exclude already added
        );
      } else if (selectedProject) {
         filtered = unidades.filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien !== 'DEPARTAMENTO');
      } else {
         filtered = unidades.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
      }
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.proyecto_nombre.toLowerCase().includes(term) ||
        u.unidad.toLowerCase().includes(term) ||
        (u.tipologia && u.tipologia.toLowerCase().includes(term)) ||
        u.tipo_bien.toLowerCase().includes(term)
      );
    }
    
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
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
    return filtered;
  }, [unidades, searchTerm, activeTab, selectedProject, selectedTipologia, sortField, sortDirection, selectedUnidad, addedSecondaryUnits]);
  
  const availableSecondaryUnits = useMemo(() => {
    if (!selectedUnidad) return [];
    return unidades.filter(unidad => 
      unidad.proyecto_nombre === selectedUnidad.proyecto_nombre &&
      unidad.tipo_bien !== 'DEPARTAMENTO' &&
      !addedSecondaryUnits.some(added => added.id === unidad.id)
    );
  }, [unidades, selectedUnidad, addedSecondaryUnits]);
  
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  
  const precioDescuentoDepartamento = useMemo(() => {
    if (!selectedUnidad) return 0;
    // discountAmount is the percentage manually entered by the broker for THIS quote
    const maxBrokerDiscount = calculateBrokerMaxDiscountPercentage(selectedUnidad);
    const appliedDiscount = Math.min(discountAmount, maxBrokerDiscount); // Broker cannot exceed their max discount

    if (quotationType === 'descuento' || quotationType === 'mix') {
      return precioBaseDepartamento * (appliedDiscount / 100);
    }
    return 0;
  }, [selectedUnidad, quotationType, discountAmount, precioBaseDepartamento, brokerCommissionRate]); // Added brokerCommissionRate
  
  const precioDepartamentoConDescuento = useMemo(() => {
    return precioBaseDepartamento - precioDescuentoDepartamento;
  }, [precioBaseDepartamento, precioDescuentoDepartamento]);
  
  const precioTotalSecundarios = useMemo(() => {
    return addedSecondaryUnits.reduce((total, unit) => total + (unit.valor_lista || 0), 0);
  }, [addedSecondaryUnits]);
  
  const totalEscritura = useMemo(() => {
    let baseTotal = precioDepartamentoConDescuento + precioTotalSecundarios;
    // If type is 'bono' or 'mix', the bonoAmount is subtracted from the total to be paid by client (acts like a further discount)
    if ((quotationType === 'bono' || quotationType === 'mix') && bonoAmount > 0) {
       // This bono is applied against the price the client pays, not necessarily reducing the escritura value itself
       // but reducing what client needs to cover from Pie/Credito.
       // For calculation of escritura, bono is considered later in payment form.
    }
    return baseTotal;
  }, [precioDepartamentoConDescuento, precioTotalSecundarios]);
  
  const pagoCreditoHipotecarioCalculado = useMemo(() => {
    // El bonoAmount reduce el monto a financiar o el pie.
    // El bonoPieCotizacion es un bono específico al pie.
    const montoACubrir = totalEscritura - pagoBonoPieCotizacion - (quotationType === 'bono' || quotationType === 'mix' ? bonoAmount : 0);
    const pagosRealizados = pagoReserva + pagoPromesa + pagoPie;
    return Math.max(0, montoACubrir - pagosRealizados);
  }, [totalEscritura, pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion, bonoAmount, quotationType]);
  
  const totalFormaDePago = useMemo(() => {
    // El bonoAmount y pagoBonoPieCotizacion son "descuentos" o "ayudas" que reducen lo que el cliente paga de su bolsillo o financia.
    // El total de la forma de pago debe igualar el totalEscritura.
    // Los bonos se consideran como parte del "pago" desde la perspectiva de la inmobiliaria/broker.
    return pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion + (quotationType === 'bono' || quotationType === 'mix' ? bonoAmount : 0);
  }, [pagoReserva, pagoPromesa, pagoPie, pagoCreditoHipotecarioCalculado, pagoBonoPieCotizacion, bonoAmount, quotationType]);
  

  const handleSelectUnidad = (unidad: StockUnidad) => {
    setSelectedUnidad(unidad);
    setSelectedProject(unidad.proyecto_nombre); // Also set selectedProject for secondary units filter
    setShowUnidadesDropdown(false);
    setSearchTerm(''); 
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
    // Commercial policy and broker commission will be fetched by useEffect
  };
  
  const handleAddSecondaryUnit = (unit: StockUnidad) => {
    setAddedSecondaryUnits(prev => [...prev, unit]);
    // Optionally, keep the "Secundarios" tab open or switch to "Configuracion"
    // For now, let's assume user might want to add more, so we don't switch tab automatically.
    // setActiveTab('configuracion'); 
  };
  
  const handleRemoveSecondaryUnit = (unitId: string) => {
    setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
  };
  
  const handlePromesaPctChange = (value: number) => {
    const newPct = Math.max(0, Math.min(100, value));
    setPagoPromesaPct(newPct);
    const newAmount = totalEscritura > 0 ? parseFloat((totalEscritura * (newPct / 100)).toFixed(2)) : 0;
    setPagoPromesa(newAmount);
  };
  
  const handlePiePctChange = (value: number) => {
    const newPct = Math.max(0, Math.min(100, value));
    setPagoPiePct(newPct);
    const newAmount = totalEscritura > 0 ? parseFloat((totalEscritura * (newPct / 100)).toFixed(2)) : 0;
    setPagoPie(newAmount);
  };
  
  const handlePromesaChange = (value: number) => {
    const newValue = Math.max(0, value);
    setPagoPromesa(newValue);
    const newPct = totalEscritura > 0 ? parseFloat(((newValue / totalEscritura) * 100).toFixed(2)) : 0;
    setPagoPromesaPct(newPct);
  };
  
  const handlePieChange = (value: number) => {
    const newValue = Math.max(0, value);
    setPagoPie(newValue);
    const newPct = totalEscritura > 0 ? parseFloat(((newValue / totalEscritura) * 100).toFixed(2)) : 0;
    setPagoPiePct(newPct);
  };
  
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const formatCLP = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
  
    // Adjust for timezone offset to avoid date shifting
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    if (correctedDate < today) {
      return 'INMEDIATA';
    }
    return new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(correctedDate);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center text-red-500 mb-4">
            <X className="h-12 w-12" />
          </div>
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
          <div className="flex items-center justify-center text-red-500 mb-4">
            <X className="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 text-center">No se pudo validar el acceso al cotizador.</p>
        </div>
      </div>
    );
  }
  
  const maxDiscountForSelectedUnit = selectedUnidad ? calculateBrokerMaxDiscountPercentage(selectedUnidad) : 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logoinversiones.png" alt="Logo Inversiones" className="h-12 mr-4" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cotizador {broker.name}</h1>
              <p className="text-sm text-gray-500">{broker.business_name}</p>
            </div>
          </div>
          
          {ufValue && (
            <div className="bg-blue-50 px-3 py-1 rounded-md">
              <span className="text-sm font-medium text-blue-700">
                UF: {formatCLP(ufValue)}
              </span>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('principales')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'principales' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Principales
            </button>
            <button
              onClick={() => setActiveTab('secundarios')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'secundarios' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Secundarios
            </button>
            <button
              onClick={() => setActiveTab('configuracion')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuracion' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuración Cotización
            </button>
          </nav>
        </div>
        
        {/* Principales Tab */}
        {activeTab === 'principales' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="projectFilterPrincipales" className="block text-sm font-medium text-gray-700 mb-1">
                    Proyecto
                  </label>
                  <select
                    id="projectFilterPrincipales"
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value);
                      setSelectedTipologia('');
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Todos los proyectos</option>
                    {uniqueProjects.map(project => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="tipologiaFilterPrincipales" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipología
                  </label>
                  <select
                    id="tipologiaFilterPrincipales"
                    value={selectedTipologia}
                    onChange={(e) => setSelectedTipologia(e.target.value)}
                    disabled={!selectedProject}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">Todas las tipologías</option>
                    {uniqueTipologias.map(tipologia => (
                      <option key={tipologia} value={tipologia}>{tipologia}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="searchPrincipales" className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="searchPrincipales"
                      type="text"
                      placeholder="Buscar unidad..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('proyecto_nombre')}
                      >
                        Proyecto
                        {sortField === 'proyecto_nombre' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('unidad')}
                      >
                        Unidad
                        {sortField === 'unidad' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('tipologia')}
                      >
                        Tipología
                        {sortField === 'tipologia' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('piso')}
                      >
                        Piso
                        {sortField === 'piso' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('sup_util')}
                      >
                        Sup. Útil
                        {sortField === 'sup_util' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('valor_lista')}
                      >
                        Valor UF
                        {sortField === 'valor_lista' && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                          </span>
                        )}
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" // No sort for calculated field directly in header
                      >
                        Desc. Max. Broker
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUnidades.map((unidad) => {
                      // Calculate broker's maximum possible discount for this unit based on current brokerCommissionRate
                      const maxBrokerDiscountForUnit = calculateBrokerMaxDiscountPercentage(unidad);
                      
                      return (
                        <tr key={unidad.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unidad.proyecto_nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unidad.unidad}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {unidad.tipologia || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {unidad.piso || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                            {formatCurrency(unidad.sup_util)} m²
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(unidad.valor_lista)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                            {formatCurrency(maxBrokerDiscountForUnit)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleSelectUnidad(unidad)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Seleccionar
                            </button>
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
        
        {/* Secundarios Tab */}
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
                  <label htmlFor="projectFilterSecundarios" className="block text-sm font-medium text-gray-700 mb-1">
                    Proyecto (Principal Seleccionado)
                  </label>
                  <input
                    id="projectFilterSecundarios"
                    type="text"
                    value={selectedUnidad ? selectedUnidad.proyecto_nombre : 'N/A - Seleccione unidad principal'}
                    readOnly
                    className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="searchSecundarios" className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Unidad Secundaria
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="searchSecundarios"
                      type="text"
                      placeholder="Buscar por unidad, tipo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      disabled={!selectedUnidad} // Only allow search if a main unit is selected
                    />
                  </div>
                </div>
              </div>
            </div>

            {selectedUnidad && ( // Only show table if a main unit is selected
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('unidad')}
                        >
                          Unidad
                          {sortField === 'unidad' && (
                            <span className="ml-1">
                              {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                            </span>
                          )}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('tipo_bien')}
                        >
                          Tipo
                          {sortField === 'tipo_bien' && (
                            <span className="ml-1">
                              {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                            </span>
                          )}
                        </th>
                         <th 
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('sup_total')}
                        >
                          Sup. Total
                          {sortField === 'sup_total' && (
                            <span className="ml-1">
                              {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                            </span>
                          )}
                        </th>
                        <th 
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('valor_lista')}
                        >
                          Valor UF
                          {sortField === 'valor_lista' && (
                            <span className="ml-1">
                              {sortDirection === 'asc' ? <ChevronUp className="inline-block h-4 w-4" /> : <ChevronDown className="inline-block h-4 w-4" />}
                            </span>
                          )}
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUnidades.map((unidad) => ( 
                        <tr key={unidad.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unidad.unidad}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {unidad.tipo_bien}
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                            {formatCurrency(unidad.sup_total)} m²
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(unidad.valor_lista)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleAddSecondaryUnit(unidad)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Agregar
                            </button>
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
        
        {/* Configuración Cotización Tab */}
        {activeTab === 'configuracion' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Unit Selection and Client Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Unit Selection Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Home className="h-5 w-5 text-blue-500 mr-2" />
                  Selección de Unidad
                </h2>
                
                <div className="space-y-4">
                  {/* Unit Selector */}
                  <div className="relative">
                    <label htmlFor="mainUnitInput" className="block text-sm font-medium text-gray-700 mb-1">
                      Unidad Principal
                    </label>
                    <div className="relative">
                      <input
                        id="mainUnitInput"
                        type="text"
                        value={selectedUnidad ? `${selectedUnidad.proyecto_nombre} - ${selectedUnidad.unidad} (${selectedUnidad.tipologia || selectedUnidad.tipo_bien})` : ''}
                        onClick={() => { setActiveTab('principales'); setShowUnidadesDropdown(true); }} 
                        placeholder="Seleccione una unidad principal desde la pestaña 'Principales'"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10 cursor-pointer"
                        readOnly
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Secondary Units */}
                  {selectedUnidad && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Unidades Secundarias
                        </label>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('secundarios'); setSearchTerm('');} }
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {addedSecondaryUnits.length > 0 ? "Agregar/Modificar Secundarias" : "Agregar Secundarias"}
                        </button>
                      </div>
                      
                      {addedSecondaryUnits.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {addedSecondaryUnits.map(unit => (
                            <div key={unit.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                              <div>
                                <div className="font-medium">{unit.tipo_bien} {unit.unidad}</div>
                                <div className="text-sm text-gray-500">{formatCurrency(unit.valor_lista)} UF</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSecondaryUnit(unit.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No hay unidades secundarias seleccionadas.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Client Information Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Datos del Cliente
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="clientNameInput" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Cliente
                    </label>
                    <input
                      id="clientNameInput"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ingrese nombre"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="clientRutInput" className="block text-sm font-medium text-gray-700 mb-1">
                      RUT del Cliente
                    </label>
                    <input
                      id="clientRutInput"
                      type="text"
                      value={clientRut}
                      onChange={(e) => setClientRut(e.target.value)}
                      placeholder="Ingrese RUT"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              {/* Unit Information Card */}
              {selectedUnidad && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Building className="h-5 w-5 text-blue-500 mr-2" />
                    Información de la Unidad Seleccionada
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Tipo de Bien
                      </label>
                      <div className="mt-1 text-gray-900">
                        {selectedUnidad.tipo_bien}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        N° Unidad
                      </label>
                      <div className="mt-1 text-gray-900">
                        {selectedUnidad.unidad}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Tipología
                      </label>
                      <div className="mt-1 text-gray-900">
                        {selectedUnidad.tipologia || 'N/A'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Piso
                      </label>
                      <div className="mt-1 text-gray-900">
                        {selectedUnidad.piso || 'N/A'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Orientación
                      </label>
                      <div className="mt-1 text-gray-900">
                        {selectedUnidad.orientacion || 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Superficie Útil
                      </label>
                      <div className="mt-1 text-gray-900">
                        {formatCurrency(selectedUnidad.sup_util)} m²
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Superficie Terraza
                      </label>
                      <div className="mt-1 text-gray-900">
                        {formatCurrency(selectedUnidad.sup_terraza)} m²
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Superficie Total
                      </label>
                      <div className="mt-1 text-gray-900">
                        {formatCurrency(selectedUnidad.sup_total)} m²
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Commercial Policy Card */}
              {selectedUnidad && commercialPolicy && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
                    Política Comercial ({commercialPolicy.project_name})
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Monto Reserva
                      </label>
                      <div className="mt-1 text-gray-900">
                        {formatCLP(commercialPolicy.monto_reserva_pesos)}
                        {ufValue && commercialPolicy.monto_reserva_pesos > 0 ? ` (${formatCurrency(commercialPolicy.monto_reserva_pesos / ufValue)} UF)` : ''}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Bono Pie Máximo
                      </label>
                      <div className="mt-1 text-gray-900">
                        {(commercialPolicy.bono_pie_max_pct * 100).toFixed(2)}%
                      </div>
                    </div>
                    
                    {commercialPolicy.fecha_tope && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Fecha Tope Entrega
                        </label>
                        <div className="mt-1 text-gray-900">
                          {formatDate(commercialPolicy.fecha_tope)}
                        </div>
                      </div>
                    )}
                    
                    {commercialPolicy.comuna && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Comuna
                        </label>
                        <div className="mt-1 text-gray-900">
                          {commercialPolicy.comuna}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {commercialPolicy.observaciones && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Observaciones de Política Comercial
                      </label>
                      <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                        {commercialPolicy.observaciones}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Right Column - Pricing and Payment */}
            <div className="space-y-6">
              {selectedUnidad && (
                <>
                  {/* Pricing Card */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
                      Precios
                    </h2>
                    
                    <div className="space-y-4">
                      {/* Quotation Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tipo de Cotización
                        </label>
                        <div className="flex space-x-4">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="descuento"
                              checked={quotationType === 'descuento'}
                              onChange={() => setQuotationType('descuento')}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Descuento</span>
                          </label>
                          
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="bono"
                              checked={quotationType === 'bono'}
                              onChange={() => setQuotationType('bono')}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Bono</span>
                          </label>
                          
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="mix"
                              checked={quotationType === 'mix'}
                              onChange={() => setQuotationType('mix')}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Mixto</span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Discount Amount */}
                      {(quotationType === 'descuento' || quotationType === 'mix') && (
                        <div>
                          <label htmlFor="discountAmountInput" className="block text-sm font-medium text-gray-700 mb-1">
                            Porcentaje de Descuento (Máx: {formatCurrency(maxDiscountForSelectedUnit)}%)
                          </label>
                          <div className="flex items-center">
                            <input
                              id="discountAmountInput"
                              type="number"
                              min="0"
                              max={maxDiscountForSelectedUnit}
                              step="0.01"
                              value={discountAmount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDiscountAmount(Math.min(Math.max(0, val), maxDiscountForSelectedUnit));
                              }}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <span className="ml-2">%</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Bono Amount */}
                      {(quotationType === 'bono' || quotationType === 'mix') && (
                        <div>
                          <label htmlFor="bonoAmountInput" className="block text-sm font-medium text-gray-700 mb-1">
                            Monto Bono (UF)
                          </label>
                          <input
                            id="bonoAmountInput"
                            type="number"
                            min="0"
                            step="0.01"
                            value={bonoAmount}
                            onChange={(e) => setBonoAmount(Math.max(0, parseFloat(e.target.value)) || 0)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      
                      {/* Price Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Precio Base Departamento:</span>
                            <span className="text-sm font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                          </div>
                          
                          {precioDescuentoDepartamento > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Descuento ({formatCurrency(discountAmount)}%):</span>
                              <span className="text-sm font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                            </div>
                          )}
                           {bonoAmount > 0 && (quotationType === 'bono' || quotationType === 'mix') && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Bono Adicional Aplicado:</span>
                              <span className="text-sm font-medium text-red-600">-{formatCurrency(bonoAmount)} UF</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Precio Depto. con Ajustes:</span>
                            <span className="text-sm font-medium">{formatCurrency(precioDepartamentoConDescuento - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0) )} UF</span>
                          </div>
                          
                          {precioTotalSecundarios > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Precio Unidades Secundarias:</span>
                              <span className="text-sm font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="text-base font-medium text-gray-700">Precio Total Escrituración:</span>
                            <span className="text-base font-bold">{formatCurrency(totalEscritura - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0))} UF</span>
                          </div>
                          
                          {ufValue && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Equivalente en Pesos:</span>
                              <span className="text-sm text-gray-500">{formatCLP((totalEscritura - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0)) * ufValue)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Payment Form Card */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Calculator className="h-5 w-5 text-blue-500 mr-2" />
                      Forma de Pago
                    </h2>
                    
                    <div className="space-y-4">
                      {/* Reservation Payment */}
                      <div>
                        <label htmlFor="pagoReservaInput" className="block text-sm font-medium text-gray-700 mb-1">
                          Reserva (UF)
                        </label>
                        <input
                          id="pagoReservaInput"
                          type="number"
                          min="0"
                          step="0.01"
                          value={pagoReserva}
                          onChange={(e) => setPagoReserva(Math.max(0, parseFloat(e.target.value)) || 0)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      
                      {/* Promise Payment */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Promesa
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={pagoPromesaPct}
                                onChange={(e) => handlePromesaPctChange(parseFloat(e.target.value) || 0)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                              <span className="ml-2">%</span>
                            </div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={pagoPromesa}
                              onChange={(e) => handlePromesaChange(parseFloat(e.target.value) || 0)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Down Payment */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pie
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={pagoPiePct}
                                onChange={(e) => handlePiePctChange(parseFloat(e.target.value) || 0)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                              <span className="ml-2">%</span>
                            </div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={pagoPie}
                              onChange={(e) => handlePieChange(parseFloat(e.target.value) || 0)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Bono Pie */}
                      {commercialPolicy && commercialPolicy.bono_pie_max_pct > 0 && (
                        <div>
                          <label htmlFor="pagoBonoPieInput" className="block text-sm font-medium text-gray-700 mb-1">
                             Bono Pie Inmobiliaria (UF) - Máx {commercialPolicy.bono_pie_max_pct > 0 && totalEscritura > 0 ? formatCurrency(totalEscritura * commercialPolicy.bono_pie_max_pct) : '0.00'} UF ({(commercialPolicy.bono_pie_max_pct * 100).toFixed(2)}%)
                          </label>
                          <input
                            id="pagoBonoPieInput"
                            type="number"
                            min="0"
                            max={totalEscritura > 0 && commercialPolicy.bono_pie_max_pct > 0 ? parseFloat((totalEscritura * commercialPolicy.bono_pie_max_pct).toFixed(2)) : 0}
                            step="0.01"
                            value={pagoBonoPieCotizacion}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              const maxBono = totalEscritura > 0 && commercialPolicy.bono_pie_max_pct > 0 ? parseFloat((totalEscritura * commercialPolicy.bono_pie_max_pct).toFixed(2)) : 0;
                              setPagoBonoPieCotizacion(Math.min(Math.max(0, value), maxBono));
                            }}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                           {pagoBonoPieCotizacion > 0 && totalEscritura > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                              {((pagoBonoPieCotizacion / totalEscritura) * 100).toFixed(2)}% del total
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Mortgage Credit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Crédito Hipotecario (UF)
                        </label>
                        <input
                          type="number"
                          value={formatCurrency(pagoCreditoHipotecarioCalculado)} 
                          className="block w-full rounded-md bg-gray-100 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          readOnly
                        />
                         {pagoCreditoHipotecarioCalculado > 0 && totalEscritura > 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            {((pagoCreditoHipotecarioCalculado / (totalEscritura- ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0) - pagoBonoPieCotizacion)) * 100).toFixed(2)}% del monto a financiar
                          </p>
                        )}
                      </div>
                      
                      {/* Payment Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Total Forma de Pago:</span>
                          <span className="font-bold text-lg">{formatCurrency(totalFormaDePago - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0) - pagoBonoPieCotizacion)} UF</span>
                        </div>
                        
                        {Math.abs(totalFormaDePago - (totalEscritura + ((quotationType === 'descuento' || quotationType === 'mix') ? 0 : bonoAmount) + pagoBonoPieCotizacion)) > 0.01 && ( 
                          <div className="mt-2 p-2 bg-red-50 text-red-600 rounded-md text-sm">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                              <span>
                                La forma de pago no coincide con el precio total. 
                                Diferencia: {formatCurrency(Math.abs(totalFormaDePago - (totalEscritura + ((quotationType === 'descuento' || quotationType === 'mix') ? 0 : bonoAmount))))} UF
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Generate PDF Button */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      Generar Cotización
                    </h2>
                    
                    {clientName && clientRut && selectedUnidad && Math.abs(totalFormaDePago - (totalEscritura + ((quotationType === 'descuento' || quotationType === 'mix') ? 0 : bonoAmount) + pagoBonoPieCotizacion )) <= 0.01 ? (
                      <PDFDownloadLink
                        document={
                          <BrokerQuotePDF
                            cliente={clientName}
                            rut={clientRut}
                            ufValue={ufValue || 0} // Pass ufValue, ensure it's not null
                            selectedUnidad={selectedUnidad}
                            addedSecondaryUnits={addedSecondaryUnits}
                            quotationType={quotationType}
                            discountAmount={discountAmount} // This is the % applied by broker
                            bonoAmount={bonoAmount} // This is UF amount for bono
                            pagoReserva={pagoReserva}
                            pagoPromesa={pagoPromesa}
                            pagoPromesaPct={pagoPromesaPct}
                            pagoPie={pagoPie}
                            pagoPiePct={pagoPiePct}
                            pagoBonoPieCotizacion={pagoBonoPieCotizacion}
                            precioBaseDepartamento={precioBaseDepartamento}
                            precioDescuentoDepartamento={precioDescuentoDepartamento} // Calculated discount amount in UF
                            precioDepartamentoConDescuento={precioDepartamentoConDescuento}
                            precioTotalSecundarios={precioTotalSecundarios}
                            totalEscritura={totalEscritura} // This is price before client-side bonos
                            pagoCreditoHipotecarioCalculado={pagoCreditoHipotecarioCalculado}
                            totalFormaDePago={totalFormaDePago}
                            brokerName={broker.name}
                            commercialPolicy={commercialPolicy}
                          />
                        }
                        fileName={`Cotizacion_${selectedUnidad.proyecto_nombre}_${selectedUnidad.unidad}_${clientName.replace(/\s/g, '_')}.pdf`}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {({ loading: pdfLoading }) => (
                          <>
                            <Download className="h-5 w-5 mr-2" />
                            {pdfLoading ? 'Generando PDF...' : 'Descargar Cotización PDF'}
                          </>
                        )}
                      </PDFDownloadLink>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        Descargar Cotización PDF
                      </button>
                    )}
                    
                    {(!clientName || !clientRut) && (
                      <p className="mt-2 text-xs text-amber-600">
                        Debe ingresar el nombre y RUT del cliente.
                      </p>
                    )}
                     {!selectedUnidad && (
                      <p className="mt-2 text-xs text-amber-600">
                        Debe seleccionar una unidad principal.
                      </p>
                    )}
                    
                    {selectedUnidad && Math.abs(totalFormaDePago - (totalEscritura + ((quotationType === 'descuento' || quotationType === 'mix') ? 0 : bonoAmount) + pagoBonoPieCotizacion)) > 0.01 && (
                      <p className="mt-2 text-xs text-red-600">
                        La forma de pago ({formatCurrency(totalFormaDePago)}) no coincide con el precio total a pagar por el cliente ({formatCurrency(totalEscritura - ((quotationType === 'bono' || quotationType === 'mix') ? bonoAmount : 0) - pagoBonoPieCotizacion )}).
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} {broker.business_name}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BrokerQuotePage;