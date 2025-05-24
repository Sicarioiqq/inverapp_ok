import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useUFStore } from '../../stores/ufStore';
import { Building, Home, DollarSign, Calculator, Download, Check, X, Search, ChevronDown, ChevronUp, Percent, Plus, AlertTriangle } from 'lucide-react';

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
  descuento?: number; // Added for broker commission rate
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

    if (error && error.code !== 'PGRST116') {
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

// Format deadline date
const formatDeadlineDate = (dateString: string | null): string => {
  if (!dateString) return 'No especificada';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  
  // If date is today or in the past, return "INMEDIATA"
  if (date <= today) {
    return "INMEDIATA";
  }
  
  // Otherwise, format the date
  return new Intl.DateTimeFormat('es-CL').format(date);
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
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');
  const [sortField, setSortField] = useState<string>('unidad');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [brokerCommissions, setBrokerCommissions] = useState<Record<string, number>>({});
  
  // Form state
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
        await fetchAllUnits(validatedBroker.id);
        
      } catch (err: any) {
        console.error('Error initializing page:', err);
        setError(err.message || 'Error al cargar la página');
      } finally {
        setLoading(false);
      }
    };
    
    initializePage();
  }, [brokerSlug, accessToken]);
  
  // Fetch all units with pagination
  const fetchAllUnits = async (brokerId: string) => {
    try {
      const PAGE_SIZE = 1000;
      let allUnits: StockUnidad[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabase
          .from('stock_unidades')
          .select('*')
          .eq('estado_unidad', 'Disponible')
          .range(from, to);
          
        if (error) throw error;
        
        if (data.length === 0) {
          hasMore = false;
        } else {
          // Fetch commission rates for each project
          const projectNames = Array.from(new Set(data.map(unit => unit.proyecto_nombre)));
          const commissionRates: Record<string, number> = {};
          
          for (const projectName of projectNames) {
            const rate = await fetchBrokerCommissionRate(brokerId, projectName);
            if (rate !== null) {
              commissionRates[projectName] = rate;
            }
          }
          
          // Add commission rates to units
          const unitsWithCommission = data.map(unit => ({
            ...unit,
            descuento: commissionRates[unit.proyecto_nombre] || 0
          }));
          
          allUnits = [...allUnits, ...unitsWithCommission];
          page++;
        }
      }
      
      setBrokerCommissions(Object.fromEntries(
        allUnits
          .filter((unit, index, self) => 
            index === self.findIndex(u => u.proyecto_nombre === unit.proyecto_nombre)
          )
          .map(unit => [unit.proyecto_nombre, unit.descuento || 0])
      ));
      
      setUnidades(allUnits);
    } catch (error) {
      console.error('Error fetching units:', error);
      throw error;
    }
  };
  
  // Fetch commercial policy when a unit is selected
  useEffect(() => {
    const fetchPolicy = async () => {
      if (selectedUnidad) {
        const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
        setCommercialPolicy(policy);
        
        // Set default values based on policy
        if (policy) {
          // Convert monto_reserva_pesos to UF if UF value is available
          if (ufValue && policy.monto_reserva_pesos) {
            setPagoReserva(parseFloat((policy.monto_reserva_pesos / ufValue).toFixed(2)));
          }
          
          // Set default discount based on broker commission rate
          if (selectedUnidad.descuento) {
            setDiscountAmount(selectedUnidad.descuento);
          }
          
          // Set default bono pie max percentage
          if (policy.bono_pie_max_pct) {
            // This is stored as decimal in DB (e.g., 0.15 for 15%)
            const maxBonoPct = policy.bono_pie_max_pct * 100;
            setPagoBonoPieCotizacion(0); // Initialize to 0, user can adjust up to max
          }
        }
      }
    };
    
    fetchPolicy();
  }, [selectedUnidad, ufValue]);
  
  // Filter units based on search term, project and tipologia
  const filteredUnidades = useMemo(() => {
    let filtered = unidades;
    
    if (selectedProject) {
      filtered = filtered.filter(unidad => unidad.proyecto_nombre === selectedProject);
    }
    
    if (selectedTipologia) {
      filtered = filtered.filter(unidad => unidad.tipologia === selectedTipologia);
    }
    
    if (searchTerm.trim()) {
      filtered = filtered.filter(unidad => 
        unidad.proyecto_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unidad.unidad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unidad.tipologia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unidad.tipo_bien.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [unidades, searchTerm, selectedProject, selectedTipologia]);
  
  // Filter main units (departamentos)
  const principalesUnidades = useMemo(() => {
    return filteredUnidades.filter(unidad => unidad.tipo_bien === 'DEPARTAMENTO');
  }, [filteredUnidades]);
  
  // Filter secondary units (parking, storage)
  const secundariosUnidades = useMemo(() => {
    return filteredUnidades.filter(unidad => unidad.tipo_bien !== 'DEPARTAMENTO');
  }, [filteredUnidades]);
  
  // Filter secondary units based on selected unit's project
  const availableSecondaryUnits = useMemo(() => {
    if (!selectedUnidad) return [];
    
    return unidades.filter(unidad => 
      unidad.proyecto_nombre === selectedUnidad.proyecto_nombre &&
      unidad.tipo_bien !== 'DEPARTAMENTO' &&
      !addedSecondaryUnits.some(added => added.id === unidad.id)
    );
  }, [unidades, selectedUnidad, addedSecondaryUnits]);
  
  // Get unique projects
  const proyectos = useMemo(() => {
    return Array.from(new Set(unidades.map(u => u.proyecto_nombre)));
  }, [unidades]);
  
  // Get unique tipologias for selected project
  const tipologias = useMemo(() => {
    if (!selectedProject) return [];
    return Array.from(new Set(
      unidades
        .filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO' && u.tipologia)
        .map(u => u.tipologia as string)
    ));
  }, [unidades, selectedProject]);
  
  // Calculate prices
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  
  // Calculate discount based on quotation type
  const precioDescuentoDepartamento = useMemo(() => {
    if (!selectedUnidad) return 0;
    
    if (quotationType === 'descuento' || quotationType === 'mix') {
      return precioBaseDepartamento * (discountAmount / 100);
    }
    return 0;
  }, [selectedUnidad, quotationType, discountAmount, precioBaseDepartamento]);
  
  // Calculate final department price after discount
  const precioDepartamentoConDescuento = useMemo(() => {
    return precioBaseDepartamento - precioDescuentoDepartamento;
  }, [precioBaseDepartamento, precioDescuentoDepartamento]);
  
  // Calculate total price of secondary units
  const precioTotalSecundarios = useMemo(() => {
    return addedSecondaryUnits.reduce((total, unit) => total + (unit.valor_lista || 0), 0);
  }, [addedSecondaryUnits]);
  
  // Calculate total price for deed
  const totalEscritura = useMemo(() => {
    return precioDepartamentoConDescuento + precioTotalSecundarios;
  }, [precioDepartamentoConDescuento, precioTotalSecundarios]);
  
  // Calculate mortgage credit amount
  const pagoCreditoHipotecarioCalculado = useMemo(() => {
    const totalPagos = pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion;
    return Math.max(0, totalEscritura - totalPagos);
  }, [totalEscritura, pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion]);
  
  // Calculate total payment form
  const totalFormaDePago = useMemo(() => {
    return pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;
  }, [pagoReserva, pagoPromesa, pagoPie, pagoCreditoHipotecarioCalculado, pagoBonoPieCotizacion]);
  
  // Handle unit selection
  const handleSelectUnidad = (unidad: StockUnidad) => {
    setSelectedUnidad(unidad);
    setShowUnidadesDropdown(false);
    setSearchTerm('');
    setActiveTab('configuracion');
    
    // Reset payment values when changing unit
    setPagoReserva(0);
    setPagoPromesa(0);
    setPagoPromesaPct(0);
    setPagoPie(0);
    setPagoPiePct(0);
    setPagoBonoPieCotizacion(0);
    setAddedSecondaryUnits([]);
    
    // Set discount to the broker's commission rate for this project
    if (unidad.descuento) {
      setDiscountAmount(unidad.descuento);
    }
  };
  
  // Add secondary unit
  const handleAddSecondaryUnit = (unit: StockUnidad) => {
    setAddedSecondaryUnits(prev => [...prev, unit]);
    setShowSecondaryUnitsDropdown(false);
    setActiveTab('configuracion');
  };
  
  // Remove secondary unit
  const handleRemoveSecondaryUnit = (unitId: string) => {
    setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
  };
  
  // Handle payment percentage changes
  const handlePromesaPctChange = (value: number) => {
    setPagoPromesaPct(value);
    setPagoPromesa(parseFloat((totalEscritura * (value / 100)).toFixed(2)));
  };
  
  const handlePiePctChange = (value: number) => {
    setPagoPiePct(value);
    setPagoPie(parseFloat((totalEscritura * (value / 100)).toFixed(2)));
  };
  
  // Handle payment amount changes
  const handlePromesaChange = (value: number) => {
    setPagoPromesa(value);
    setPagoPromesaPct(parseFloat(((value / totalEscritura) * 100).toFixed(2)));
  };
  
  const handlePieChange = (value: number) => {
    setPagoPie(value);
    setPagoPiePct(parseFloat(((value / totalEscritura) * 100).toFixed(2)));
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Format currency in CLP
  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Sort units
  const sortedPrincipales = useMemo(() => {
    return [...principalesUnidades].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'proyecto_nombre':
          comparison = a.proyecto_nombre.localeCompare(b.proyecto_nombre);
          break;
        case 'unidad':
          comparison = a.unidad.localeCompare(b.unidad);
          break;
        case 'tipologia':
          comparison = (a.tipologia || '').localeCompare(b.tipologia || '');
          break;
        case 'piso':
          comparison = (a.piso || '').localeCompare(b.piso || '');
          break;
        case 'sup_util':
          comparison = (a.sup_util || 0) - (b.sup_util || 0);
          break;
        case 'valor_lista':
          comparison = (a.valor_lista || 0) - (b.valor_lista || 0);
          break;
        case 'descuento':
          comparison = (a.descuento || 0) - (b.descuento || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [principalesUnidades, sortField, sortDirection]);
  
  const sortedSecundarios = useMemo(() => {
    return [...secundariosUnidades].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'proyecto_nombre':
          comparison = a.proyecto_nombre.localeCompare(b.proyecto_nombre);
          break;
        case 'unidad':
          comparison = a.unidad.localeCompare(b.unidad);
          break;
        case 'tipo_bien':
          comparison = a.tipo_bien.localeCompare(b.tipo_bien);
          break;
        case 'valor_lista':
          comparison = (a.valor_lista || 0) - (b.valor_lista || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [secundariosUnidades, sortField, sortDirection]);
  
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
          <nav className="-mb-px flex space-x-8">
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
        
        {/* Tab Content */}
        {activeTab === 'principales' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Home className="h-5 w-5 text-blue-500 mr-2" />
                Unidades Principales
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Project filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proyecto
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value);
                      setSelectedTipologia('');
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Todos los proyectos</option>
                    {proyectos.map(proyecto => (
                      <option key={proyecto} value={proyecto}>{proyecto}</option>
                    ))}
                  </select>
                </div>
                
                {/* Tipologia filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipología
                  </label>
                  <select
                    value={selectedTipologia}
                    onChange={(e) => setSelectedTipologia(e.target.value)}
                    disabled={!selectedProject}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">Todas las tipologías</option>
                    {tipologias.map(tipologia => (
                      <option key={tipologia} value={tipologia}>{tipologia}</option>
                    ))}
                  </select>
                </div>
                
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar unidad..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('proyecto_nombre')}
                      >
                        Proyecto
                        {sortField === 'proyecto_nombre' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('unidad')}
                      >
                        N° Unidad
                        {sortField === 'unidad' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('tipologia')}
                      >
                        Tipología
                        {sortField === 'tipologia' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('piso')}
                      >
                        Piso
                        {sortField === 'piso' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('sup_util')}
                      >
                        Sup. Útil
                        {sortField === 'sup_util' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('valor_lista')}
                      >
                        Valor UF
                        {sortField === 'valor_lista' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('descuento')}
                      >
                        Descuento
                        {sortField === 'descuento' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedPrincipales.map((unidad) => (
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
                          {formatCurrency(unidad.sup_util || 0)} m²
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(unidad.valor_lista || 0)} UF
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div className="flex items-center justify-end">
                            <Percent className="h-4 w-4 text-blue-500 mr-1" />
                            {formatCurrency(unidad.descuento || 0)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleSelectUnidad(unidad)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-md"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {sortedPrincipales.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No se encontraron unidades que coincidan con los filtros.
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'secundarios' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Home className="h-5 w-5 text-blue-500 mr-2" />
                Unidades Secundarias
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Project filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proyecto
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Todos los proyectos</option>
                    {proyectos.map(proyecto => (
                      <option key={proyecto} value={proyecto}>{proyecto}</option>
                    ))}
                  </select>
                </div>
                
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar unidad secundaria..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('proyecto_nombre')}
                      >
                        Proyecto
                        {sortField === 'proyecto_nombre' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('unidad')}
                      >
                        N° Unidad
                        {sortField === 'unidad' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('tipo_bien')}
                      >
                        Tipo
                        {sortField === 'tipo_bien' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('valor_lista')}
                      >
                        Valor UF
                        {sortField === 'valor_lista' && (
                          <span className="ml-1 inline-block">
                            {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                          </span>
                        )}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedSecundarios.map((unidad) => (
                      <tr key={unidad.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {unidad.proyecto_nombre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {unidad.unidad}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {unidad.tipo_bien}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(unidad.valor_lista || 0)} UF
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              if (selectedUnidad) {
                                if (unidad.proyecto_nombre === selectedUnidad.proyecto_nombre) {
                                  handleAddSecondaryUnit(unidad);
                                } else {
                                  alert('Solo puede agregar unidades secundarias del mismo proyecto que la unidad principal');
                                }
                              } else {
                                alert('Primero debe seleccionar una unidad principal');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-md"
                          >
                            Agregar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {sortedSecundarios.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No se encontraron unidades secundarias que coincidan con los filtros.
                </div>
              )}
            </div>
          </div>
        )}
        
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidad Principal
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={selectedUnidad ? `${selectedUnidad.proyecto_nombre} - ${selectedUnidad.unidad} (${selectedUnidad.tipologia || selectedUnidad.tipo_bien})` : ''}
                        onClick={() => setShowUnidadesDropdown(true)}
                        placeholder="Seleccione una unidad..."
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                        readOnly
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                    
                    {showUnidadesDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
                        <div className="p-2 sticky top-0 bg-white border-b">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                              type="text"
                              placeholder="Buscar unidad..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        
                        <ul className="py-1">
                          {principalesUnidades.map(unidad => (
                            <li key={unidad.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectUnidad(unidad)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                              >
                                <div className="font-medium">{unidad.proyecto_nombre} - {unidad.unidad}</div>
                                <div className="text-sm text-gray-500">
                                  {unidad.tipologia || unidad.tipo_bien} | {formatCurrency(unidad.valor_lista)} UF
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                          onClick={() => setShowSecondaryUnitsDropdown(!showSecondaryUnitsDropdown)}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                          disabled={availableSecondaryUnits.length === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </button>
                      </div>
                      
                      {showSecondaryUnitsDropdown && availableSecondaryUnits.length > 0 && (
                        <div className="relative z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-40 overflow-auto">
                          <ul className="py-1">
                            {availableSecondaryUnits.map(unit => (
                              <li key={unit.id}>
                                <button
                                  type="button"
                                  onClick={() => handleAddSecondaryUnit(unit)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100"
                                >
                                  <div className="font-medium">{unit.tipo_bien} {unit.unidad}</div>
                                  <div className="text-sm text-gray-500">
                                    {formatCurrency(unit.valor_lista)} UF
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
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
                        <p className="text-sm text-gray-500 italic">No hay unidades secundarias seleccionadas</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Cliente
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ingrese nombre"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RUT del Cliente
                    </label>
                    <input
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
                    <Home className="h-5 w-5 text-blue-500 mr-2" />
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
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Descuento Disponible
                      </label>
                      <div className="mt-1 text-gray-900 flex items-center">
                        <Percent className="h-4 w-4 text-blue-500 mr-1" />
                        {formatCurrency(selectedUnidad.descuento || 0)}%
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
                    Política Comercial
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Monto Reserva
                      </label>
                      <div className="mt-1 text-gray-900">
                        {formatCLP(commercialPolicy.monto_reserva_pesos)}
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
                          Fecha Tope
                        </label>
                        <div className="mt-1 text-gray-900">
                          {formatDeadlineDate(commercialPolicy.fecha_tope)}
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
                        Observaciones
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Porcentaje de Descuento (Máx. {formatCurrency(selectedUnidad.descuento || 0)}%)
                          </label>
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0"
                              max={selectedUnidad.descuento || 100}
                              step="0.01"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <span className="ml-2">%</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Bono Amount */}
                      {(quotationType === 'bono' || quotationType === 'mix') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto Bono (UF)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={bonoAmount}
                            onChange={(e) => setBonoAmount(parseFloat(e.target.value) || 0)}
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
                              <span className="text-sm text-gray-500">Descuento ({discountAmount}%):</span>
                              <span className="text-sm font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Precio Departamento con Descuento:</span>
                            <span className="text-sm font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                          </div>
                          
                          {precioTotalSecundarios > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Precio Unidades Secundarias:</span>
                              <span className="text-sm font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="text-sm font-medium text-gray-700">Precio Total Escrituración:</span>
                            <span className="text-sm font-bold">{formatCurrency(totalEscritura)} UF</span>
                          </div>
                          
                          {ufValue && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Equivalente en Pesos:</span>
                              <span className="text-sm text-gray-500">{formatCLP(totalEscritura * ufValue)}</span>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reserva (UF)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pagoReserva}
                          onChange={(e) => setPagoReserva(parseFloat(e.target.value) || 0)}
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
                            <span className="text-xs text-gray-500">UF</span>
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
                            <span className="text-xs text-gray-500">UF</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Bono Pie */}
                      {commercialPolicy && commercialPolicy.bono_pie_max_pct > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bono Pie (UF) - Máx {(commercialPolicy.bono_pie_max_pct * 100).toFixed(2)}% o {formatCurrency(selectedUnidad.descuento || 0)}%
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={Math.min(
                              totalEscritura * commercialPolicy.bono_pie_max_pct,
                              totalEscritura * (selectedUnidad.descuento || 0) / 100
                            )}
                            step="0.01"
                            value={pagoBonoPieCotizacion}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              const maxBono = Math.min(
                                totalEscritura * commercialPolicy.bono_pie_max_pct,
                                totalEscritura * (selectedUnidad.descuento || 0) / 100
                              );
                              setPagoBonoPieCotizacion(Math.min(value, maxBono));
                            }}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          {pagoBonoPieCotizacion > 0 && (
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
                          value={pagoCreditoHipotecarioCalculado}
                          className="block w-full rounded-md bg-gray-100 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          readOnly
                        />
                        {pagoCreditoHipotecarioCalculado > 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            {((pagoCreditoHipotecarioCalculado / totalEscritura) * 100).toFixed(2)}% del total
                          </p>
                        )}
                      </div>
                      
                      {/* Payment Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Total Forma de Pago:</span>
                          <span className="font-bold text-lg">{formatCurrency(totalFormaDePago)} UF</span>
                        </div>
                        
                        {Math.abs(totalFormaDePago - totalEscritura) > 0.01 && (
                          <div className="mt-2 p-2 bg-red-50 text-red-600 rounded-md text-sm">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              <span>
                                La forma de pago no coincide con el precio total.
                                Diferencia: {formatCurrency(Math.abs(totalFormaDePago - totalEscritura))} UF
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
                    
                    {clientName && clientRut && Math.abs(totalFormaDePago - totalEscritura) <= 0.01 ? (
                      <PDFDownloadLink
                        document={
                          <BrokerQuotePDF
                            cliente={clientName}
                            rut={clientRut}
                            ufValue={ufValue}
                            selectedUnidad={selectedUnidad}
                            addedSecondaryUnits={addedSecondaryUnits}
                            quotationType={quotationType}
                            discountAmount={discountAmount}
                            bonoAmount={bonoAmount}
                            pagoReserva={pagoReserva}
                            pagoPromesa={pagoPromesa}
                            pagoPromesaPct={pagoPromesaPct}
                            pagoPie={pagoPie}
                            pagoPiePct={pagoPiePct}
                            pagoBonoPieCotizacion={pagoBonoPieCotizacion}
                            precioBaseDepartamento={precioBaseDepartamento}
                            precioDescuentoDepartamento={precioDescuentoDepartamento}
                            precioDepartamentoConDescuento={precioDepartamentoConDescuento}
                            precioTotalSecundarios={precioTotalSecundarios}
                            totalEscritura={totalEscritura}
                            pagoCreditoHipotecarioCalculado={pagoCreditoHipotecarioCalculado}
                            totalFormaDePago={totalFormaDePago}
                          />
                        }
                        fileName={`Cotizacion_${selectedUnidad.proyecto_nombre}_${selectedUnidad.unidad}.pdf`}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {({ blob, url, loading, error }) => (
                          <>
                            <Download className="h-5 w-5 mr-2" />
                            {loading ? 'Generando PDF...' : 'Descargar Cotización PDF'}
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
                      <p className="mt-2 text-sm text-amber-600">
                        Debe ingresar el nombre y RUT del cliente.
                      </p>
                    )}
                    
                    {Math.abs(totalFormaDePago - totalEscritura) > 0.01 && (
                      <p className="mt-2 text-sm text-red-600">
                        La forma de pago debe coincidir con el precio total.
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