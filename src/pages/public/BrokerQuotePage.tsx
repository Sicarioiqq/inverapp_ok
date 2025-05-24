import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useParams } from 'react-router-dom';
import { useUFStore } from '../../stores/ufStore';
import { 
  Search, 
  Building, 
  Home, 
  DollarSign, 
  Calendar, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown,
  Check,
  X,
  Plus,
  Minus,
  FileText,
  Settings
} from 'lucide-react';

// Definición de tipos
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
}

interface ProjectCommercialPolicy {
  project_name: string;
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
  observaciones: string | null;
}

type TabType = 'principales' | 'secundarios' | 'configuracion';

const BrokerQuotePage: React.FC = () => {
  // Parámetros de la URL
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  
  // UF Store
  const { ufValue, fetchUFValue } = useUFStore();
  
  // Estados para datos
  const [broker, setBroker] = useState<any>(null);
  const [stockUnidades, setStockUnidades] = useState<StockUnidad[]>([]);
  const [filteredUnidades, setFilteredUnidades] = useState<StockUnidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnidad[]>([]);
  const [commercialPolicy, setCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
  
  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({
    key: 'valor_lista',
    direction: 'asc'
  });
  const [activeTab, setActiveTab] = useState<TabType>('principales');
  
  // Estados para cotización
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bonoAmount, setBonoAmount] = useState(0);
  const [pagoReserva, setPagoReserva] = useState(0);
  const [pagoPromesa, setPagoPromesa] = useState(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState(0);
  const [pagoPie, setPagoPie] = useState(0);
  const [pagoPiePct, setPagoPiePct] = useState(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState(0);
  
  // Validación inicial del broker
  useEffect(() => {
    validateBroker();
  }, [brokerSlug, accessToken]);
  
  // Cargar valor UF
  useEffect(() => {
    fetchUFValue();
  }, [fetchUFValue]);
  
  // Actualizar unidades filtradas cuando cambian los filtros
  useEffect(() => {
    filterUnidades();
  }, [stockUnidades, searchTerm, selectedProject, selectedTipologia, sortConfig, activeTab]);
  
  // Actualizar política comercial cuando se selecciona una unidad
  useEffect(() => {
    if (selectedUnidad) {
      fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
    }
  }, [selectedUnidad]);
  
  // Actualizar valores de pago cuando cambia la política comercial o la unidad seleccionada
  useEffect(() => {
    if (selectedUnidad && commercialPolicy) {
      // Establecer valor de reserva desde la política comercial
      if (commercialPolicy.monto_reserva_pesos && ufValue) {
        const reservaUF = commercialPolicy.monto_reserva_pesos / ufValue;
        setPagoReserva(parseFloat(reservaUF.toFixed(2)));
      }
      
      // Calcular porcentajes y montos por defecto
      const precioTotal = calcularPrecioTotal();
      
      // Por defecto, promesa es 10%
      const promesaPct = 10;
      setPagoPromesaPct(promesaPct);
      setPagoPromesa(parseFloat((precioTotal * promesaPct / 100).toFixed(2)));
      
      // Por defecto, pie es 10%
      const piePct = 10;
      setPagoPiePct(piePct);
      setPagoPie(parseFloat((precioTotal * piePct / 100).toFixed(2)));
      
      // Bono pie según política comercial
      if (commercialPolicy.bono_pie_max_pct > 0) {
        const bonoPieMax = precioTotal * commercialPolicy.bono_pie_max_pct;
        setPagoBonoPieCotizacion(parseFloat(bonoPieMax.toFixed(2)));
      } else {
        setPagoBonoPieCotizacion(0);
      }
    }
  }, [selectedUnidad, commercialPolicy, ufValue]);
  
  // Validar broker por slug y token
  const validateBroker = async () => {
    try {
      setLoading(true);
      
      if (!brokerSlug || !accessToken) {
        throw new Error('Parámetros de acceso incompletos');
      }
      
      // Buscar broker por slug y token
      const { data: brokerData, error: brokerError } = await supabase
        .from('brokers')
        .select('*')
        .eq('slug', brokerSlug)
        .eq('public_access_token', accessToken)
        .single();
      
      if (brokerError) {
        throw new Error('Error de validación:\n\nAcceso denegado: token inválido');
      }
      
      setBroker(brokerData);
      
      // Cargar stock de unidades disponibles
      await fetchStockUnidades();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar stock de unidades
  const fetchStockUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('*')
        .eq('estado_unidad', 'Disponible')
        .order('valor_lista', { ascending: true });
      
      if (error) throw error;
      setStockUnidades(data || []);
    } catch (err) {
      console.error('Error al cargar stock:', err);
      setError('Error al cargar el stock de unidades');
    }
  };
  
  // Obtener política comercial del proyecto
  const fetchCommercialPolicy = async (projectName: string) => {
    try {
      const { data, error } = await supabase
        .from('project_commercial_policies')
        .select('*')
        .eq('project_name', projectName)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setCommercialPolicy(data);
      } else {
        // Política por defecto si no existe
        setCommercialPolicy({
          project_name: projectName,
          monto_reserva_pesos: 500000,
          bono_pie_max_pct: 0,
          fecha_tope: null,
          observaciones: null
        });
      }
    } catch (err) {
      console.error('Error al cargar política comercial:', err);
    }
  };
  
  // Filtrar unidades según criterios
  const filterUnidades = () => {
    let filtered = [...stockUnidades];
    
    // Filtrar por tipo de bien según la pestaña activa
    if (activeTab === 'principales') {
      filtered = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');
    } else if (activeTab === 'secundarios') {
      filtered = filtered.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
    }
    
    // Filtrar por proyecto
    if (selectedProject) {
      filtered = filtered.filter(u => u.proyecto_nombre === selectedProject);
    }
    
    // Filtrar por tipología
    if (selectedTipologia) {
      filtered = filtered.filter(u => u.tipologia === selectedTipologia);
    }
    
    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.proyecto_nombre?.toLowerCase().includes(term) ||
        u.unidad?.toLowerCase().includes(term) ||
        u.tipologia?.toLowerCase().includes(term) ||
        u.piso?.toLowerCase().includes(term) ||
        u.orientacion?.toLowerCase().includes(term)
      );
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof StockUnidad];
      const bValue = b[sortConfig.key as keyof StockUnidad];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }
      return 0;
    });
    
    setFilteredUnidades(filtered);
  };
  
  // Cambiar ordenamiento
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  // Seleccionar unidad principal
  const handleSelectUnit = (unidad: StockUnidad) => {
    setSelectedUnidad(unidad);
    // Cambiar a la pestaña de configuración cuando se selecciona una unidad
    setActiveTab('configuracion');
  };
  
  // Agregar unidad secundaria
  const handleAddSecondaryUnit = (unidad: StockUnidad) => {
    if (!addedSecondaryUnits.some(u => u.id === unidad.id)) {
      setAddedSecondaryUnits([...addedSecondaryUnits, unidad]);
    }
  };
  
  // Eliminar unidad secundaria
  const handleRemoveSecondaryUnit = (id: string) => {
    setAddedSecondaryUnits(addedSecondaryUnits.filter(u => u.id !== id));
  };
  
  // Calcular precio total (unidad principal + secundarias)
  const calcularPrecioTotal = () => {
    const precioPrincipal = selectedUnidad?.valor_lista || 0;
    const precioSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
    return precioPrincipal + precioSecundarios;
  };
  
  // Calcular precio con descuento
  const calcularPrecioConDescuento = () => {
    if (!selectedUnidad) return 0;
    
    let precioBase = selectedUnidad.valor_lista || 0;
    
    if (quotationType === 'descuento' || quotationType === 'mix') {
      precioBase = precioBase * (1 - discountAmount / 100);
    }
    
    return precioBase;
  };
  
  // Calcular descuento en UF
  const calcularDescuentoUF = () => {
    if (!selectedUnidad) return 0;
    
    const precioLista = selectedUnidad.valor_lista || 0;
    const precioConDescuento = calcularPrecioConDescuento();
    
    return precioLista - precioConDescuento;
  };
  
  // Calcular crédito hipotecario
  const calcularCreditoHipotecario = () => {
    const totalEscritura = calcularPrecioTotal();
    const totalPagos = pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion;
    return totalEscritura - totalPagos;
  };
  
  // Obtener proyectos únicos para el filtro
  const proyectos = useMemo(() => {
    const proyectosUnicos = Array.from(new Set(stockUnidades.map(u => u.proyecto_nombre)));
    return proyectosUnicos.sort();
  }, [stockUnidades]);
  
  // Obtener tipologías únicas para el filtro (dependiente del proyecto seleccionado)
  const tipologias = useMemo(() => {
    let unidadesFiltradas = stockUnidades;
    
    if (selectedProject) {
      unidadesFiltradas = unidadesFiltradas.filter(u => u.proyecto_nombre === selectedProject);
    }
    
    const tipologiasUnicas = Array.from(new Set(unidadesFiltradas
      .filter(u => u.tipo_bien === 'DEPARTAMENTO')
      .map(u => u.tipologia)));
    
    return tipologiasUnicas.sort();
  }, [stockUnidades, selectedProject]);
  
  // Formatear valores monetarios
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0,00';
    return amount.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  // Convertir UF a pesos
  const ufToPesos = (uf: number): string => {
    if (!ufValue) return '$ 0';
    const pesos = uf * ufValue;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(pesos);
  };
  
  // Calcular valores para el PDF
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  const precioDescuentoDepartamento = calcularDescuentoUF();
  const precioDepartamentoConDescuento = calcularPrecioConDescuento();
  const precioTotalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
  const pagoCreditoHipotecarioCalculado = calcularCreditoHipotecario();
  const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;
  
  // Si hay error, mostrar mensaje
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-red-600 text-xl font-bold mb-4">Error</div>
          <div className="whitespace-pre-line">{error}</div>
        </div>
      </div>
    );
  }
  
  // Si está cargando, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cotizador {broker?.name}</h1>
            <p className="text-gray-600">Cotiza unidades disponibles y genera PDF para tus clientes</p>
          </div>
          {selectedUnidad && (
            <PDFDownloadLink
              document={
                <BrokerQuotePDF
                  cliente={cliente}
                  rut={rut}
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
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors mt-4 md:mt-0"
            >
              {({ loading }) => (
                <>
                  {loading ? 'Generando...' : (
                    <>
                      <FileText className="h-5 w-5 mr-2" />
                      Descargar Cotización
                    </>
                  )}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
        
        {/* Datos del Cliente */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cliente" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Cliente
              </label>
              <input
                type="text"
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ingrese nombre"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="rut" className="block text-sm font-medium text-gray-700 mb-1">
                RUT del Cliente
              </label>
              <input
                type="text"
                id="rut"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="Ingrese RUT"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Pestañas */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('principales')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'principales'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Home className="h-5 w-5 inline-block mr-1" />
                Principales
              </button>
              <button
                onClick={() => setActiveTab('secundarios')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'secundarios'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Building className="h-5 w-5 inline-block mr-1" />
                Secundarios
              </button>
              <button
                onClick={() => setActiveTab('configuracion')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'configuracion'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="h-5 w-5 inline-block mr-1" />
                Configuración Cotización
              </button>
            </nav>
          </div>
          
          <div className="p-4 md:p-6">
            {/* Contenido de la pestaña Principales o Secundarios */}
            {(activeTab === 'principales' || activeTab === 'secundarios') && (
              <>
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="searchTerm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar unidad..."
                        className="w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="projectFilter" className="block text-sm font-medium text-gray-700 mb-1">
                      Proyecto
                    </label>
                    <select
                      id="projectFilter"
                      value={selectedProject}
                      onChange={(e) => {
                        setSelectedProject(e.target.value);
                        setSelectedTipologia('');
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Todos los proyectos</option>
                      {proyectos.map((proyecto) => (
                        <option key={proyecto} value={proyecto}>
                          {proyecto}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {activeTab === 'principales' && (
                    <div>
                      <label htmlFor="tipologiaFilter" className="block text-sm font-medium text-gray-700 mb-1">
                        Tipología
                      </label>
                      <select
                        id="tipologiaFilter"
                        value={selectedTipologia}
                        onChange={(e) => setSelectedTipologia(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        disabled={!selectedProject}
                      >
                        <option value="">Todas las tipologías</option>
                        {tipologias.map((tipologia) => (
                          <option key={tipologia} value={tipologia}>
                            {tipologia}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="flex items-end">
                    <p className="text-sm text-gray-600">
                      {filteredUnidades.length} unidades encontradas
                    </p>
                  </div>
                </div>
                
                {/* Tabla de Stock */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('proyecto_nombre')}
                        >
                          <div className="flex items-center">
                            Proyecto
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('unidad')}
                        >
                          <div className="flex items-center">
                            N° Unidad
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('tipo_bien')}
                        >
                          <div className="flex items-center">
                            Tipo
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('tipologia')}
                        >
                          <div className="flex items-center">
                            Tipología
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('piso')}
                        >
                          <div className="flex items-center">
                            Piso
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('orientacion')}
                        >
                          <div className="flex items-center">
                            Orientación
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('sup_util')}
                        >
                          <div className="flex items-center justify-end">
                            Sup. Útil
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th 
                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => requestSort('valor_lista')}
                        >
                          <div className="flex items-center justify-end">
                            Precio UF
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUnidades.map((unidad) => (
                        <tr 
                          key={unidad.id} 
                          className={`hover:bg-gray-50 ${selectedUnidad?.id === unidad.id ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.proyecto_nombre}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.unidad}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.tipo_bien}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.tipologia}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.piso}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                            {unidad.orientacion}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
                            {formatCurrency(unidad.sup_util)} m²
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
                            {formatCurrency(unidad.valor_lista)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-center">
                            {activeTab === 'principales' ? (
                              <button
                                onClick={() => handleSelectUnit(unidad)}
                                className={`px-2 py-1 text-xs rounded ${
                                  selectedUnidad?.id === unidad.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                {selectedUnidad?.id === unidad.id ? (
                                  <Check className="h-3 w-3 inline mr-1" />
                                ) : null}
                                Seleccionar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAddSecondaryUnit(unidad)}
                                disabled={addedSecondaryUnits.some(u => u.id === unidad.id) || !selectedUnidad}
                                className={`px-2 py-1 text-xs rounded ${
                                  !selectedUnidad
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : addedSecondaryUnits.some(u => u.id === unidad.id)
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                {addedSecondaryUnits.some(u => u.id === unidad.id) ? (
                                  <>
                                    <Check className="h-3 w-3 inline mr-1" />
                                    Agregado
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3 inline mr-1" />
                                    Agregar
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            
            {/* Contenido de la pestaña Configuración */}
            {activeTab === 'configuracion' && selectedUnidad && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Información de la Unidad */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Información de la Unidad</h3>
                    <div className="mt-2 bg-gray-50 p-3 rounded-md">
                      <p className="text-sm"><span className="font-medium">Proyecto:</span> {selectedUnidad.proyecto_nombre}</p>
                      <p className="text-sm"><span className="font-medium">N° Unidad:</span> {selectedUnidad.unidad}</p>
                      <p className="text-sm"><span className="font-medium">Tipología:</span> {selectedUnidad.tipologia}</p>
                      <p className="text-sm"><span className="font-medium">Piso:</span> {selectedUnidad.piso}</p>
                      <p className="text-sm"><span className="font-medium">Orientación:</span> {selectedUnidad.orientacion}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Superficies</h3>
                    <div className="mt-2 bg-gray-50 p-3 rounded-md">
                      <p className="text-sm"><span className="font-medium">Sup. Útil:</span> {formatCurrency(selectedUnidad.sup_util)} m²</p>
                      <p className="text-sm"><span className="font-medium">Sup. Terraza:</span> {formatCurrency(selectedUnidad.sup_terraza)} m²</p>
                      <p className="text-sm"><span className="font-medium">Sup. Total:</span> {formatCurrency(selectedUnidad.sup_total)} m²</p>
                    </div>
                  </div>
                  
                  {/* Unidades Secundarias */}
                  {addedSecondaryUnits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Unidades Secundarias</h3>
                      <div className="mt-2">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tipo
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                N° Unidad
                              </th>
                              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Precio UF
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acción
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {addedSecondaryUnits.map((unidad) => (
                              <tr key={unidad.id}>
                                <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {unidad.tipo_bien}
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {unidad.unidad}
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
                                  {formatCurrency(unidad.valor_lista)} UF
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-xs text-center">
                                  <button
                                    onClick={() => handleRemoveSecondaryUnit(unidad.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <X className="h-4 w-4" />
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
                
                {/* Precios y Descuentos */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Precios y Descuentos</h3>
                    <div className="mt-2">
                      <div className="flex justify-between mb-2">
                        <label className="text-sm">Tipo de Cotización:</label>
                        <div className="flex space-x-2">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="descuento"
                              checked={quotationType === 'descuento'}
                              onChange={() => setQuotationType('descuento')}
                              className="form-radio h-3 w-3 text-blue-600"
                            />
                            <span className="ml-1 text-xs">Descuento</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="bono"
                              checked={quotationType === 'bono'}
                              onChange={() => setQuotationType('bono')}
                              className="form-radio h-3 w-3 text-blue-600"
                            />
                            <span className="ml-1 text-xs">Bono</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              value="mix"
                              checked={quotationType === 'mix'}
                              onChange={() => setQuotationType('mix')}
                              className="form-radio h-3 w-3 text-blue-600"
                            />
                            <span className="ml-1 text-xs">Mixto</span>
                          </label>
                        </div>
                      </div>
                      
                      {(quotationType === 'descuento' || quotationType === 'mix') && (
                        <div className="mb-2">
                          <label htmlFor="discountAmount" className="block text-sm">
                            Descuento (%):
                          </label>
                          <input
                            type="number"
                            id="discountAmount"
                            min="0"
                            max="100"
                            step="0.01"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      )}
                      
                      {(quotationType === 'bono' || quotationType === 'mix') && (
                        <div className="mb-2">
                          <label htmlFor="bonoAmount" className="block text-sm">
                            Bono (UF):
                          </label>
                          <input
                            type="number"
                            id="bonoAmount"
                            min="0"
                            step="0.01"
                            value={bonoAmount}
                            onChange={(e) => setBonoAmount(parseFloat(e.target.value) || 0)}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="flex justify-between text-sm">
                      <span>Precio Lista:</span>
                      <span>{formatCurrency(selectedUnidad.valor_lista)} UF</span>
                    </div>
                    
                    {(quotationType === 'descuento' || quotationType === 'mix') && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Descuento ({discountAmount}%):</span>
                          <span>-{formatCurrency(calcularDescuentoUF())} UF</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-200">
                      <span>Precio Departamento:</span>
                      <span>{formatCurrency(calcularPrecioConDescuento())} UF</span>
                    </div>
                    
                    {addedSecondaryUnits.length > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Unidades Secundarias:</span>
                        <span>{formatCurrency(precioTotalSecundarios)} UF</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-200">
                      <span>Total Escrituración:</span>
                      <span>{formatCurrency(totalEscritura)} UF</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      Equivalente a {ufToPesos(totalEscritura)}
                    </div>
                  </div>
                  
                  {/* Política Comercial */}
                  {commercialPolicy && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Política Comercial</h3>
                      <div className="mt-2 bg-gray-50 p-3 rounded-md">
                        <p className="text-sm"><span className="font-medium">Proyecto:</span> {commercialPolicy.project_name}</p>
                        <p className="text-sm"><span className="font-medium">Monto Reserva:</span> ${commercialPolicy.monto_reserva_pesos.toLocaleString('es-CL')}</p>
                        <p className="text-sm"><span className="font-medium">Bono Pie Máximo:</span> {(commercialPolicy.bono_pie_max_pct * 100).toFixed(1)}%</p>
                        {commercialPolicy.fecha_tope && (
                          <p className="text-sm"><span className="font-medium">Fecha Tope:</span> {new Date(commercialPolicy.fecha_tope).toLocaleDateString('es-CL')}</p>
                        )}
                        {commercialPolicy.observaciones && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm font-medium">Observaciones:</p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{commercialPolicy.observaciones}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Forma de Pago */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Forma de Pago</h3>
                    <div className="mt-2 space-y-2">
                      <div>
                        <label htmlFor="pagoReserva" className="block text-sm">
                          Reserva (UF):
                        </label>
                        <input
                          type="number"
                          id="pagoReserva"
                          min="0"
                          step="0.01"
                          value={pagoReserva}
                          onChange={(e) => setPagoReserva(parseFloat(e.target.value) || 0)}
                          className="w-full p-1 text-sm border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="pagoPromesaPct" className="block text-sm">
                            Promesa (%):
                          </label>
                          <input
                            type="number"
                            id="pagoPromesaPct"
                            min="0"
                            max="100"
                            step="0.01"
                            value={pagoPromesaPct}
                            onChange={(e) => {
                              const pct = parseFloat(e.target.value) || 0;
                              setPagoPromesaPct(pct);
                              setPagoPromesa(parseFloat((totalEscritura * pct / 100).toFixed(2)));
                            }}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label htmlFor="pagoPromesa" className="block text-sm">
                            Monto (UF):
                          </label>
                          <input
                            type="number"
                            id="pagoPromesa"
                            min="0"
                            step="0.01"
                            value={pagoPromesa}
                            onChange={(e) => {
                              const monto = parseFloat(e.target.value) || 0;
                              setPagoPromesa(monto);
                              setPagoPromesaPct(parseFloat(((monto / totalEscritura) * 100).toFixed(2)));
                            }}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="pagoPiePct" className="block text-sm">
                            Pie (%):
                          </label>
                          <input
                            type="number"
                            id="pagoPiePct"
                            min="0"
                            max="100"
                            step="0.01"
                            value={pagoPiePct}
                            onChange={(e) => {
                              const pct = parseFloat(e.target.value) || 0;
                              setPagoPiePct(pct);
                              setPagoPie(parseFloat((totalEscritura * pct / 100).toFixed(2)));
                            }}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label htmlFor="pagoPie" className="block text-sm">
                            Monto (UF):
                          </label>
                          <input
                            type="number"
                            id="pagoPie"
                            min="0"
                            step="0.01"
                            value={pagoPie}
                            onChange={(e) => {
                              const monto = parseFloat(e.target.value) || 0;
                              setPagoPie(monto);
                              setPagoPiePct(parseFloat(((monto / totalEscritura) * 100).toFixed(2)));
                            }}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      {commercialPolicy?.bono_pie_max_pct > 0 && (
                        <div>
                          <label htmlFor="pagoBonoPieCotizacion" className="block text-sm">
                            Bono Pie (UF):
                          </label>
                          <input
                            type="number"
                            id="pagoBonoPieCotizacion"
                            min="0"
                            max={totalEscritura * commercialPolicy.bono_pie_max_pct}
                            step="0.01"
                            value={pagoBonoPieCotizacion}
                            onChange={(e) => setPagoBonoPieCotizacion(parseFloat(e.target.value) || 0)}
                            className="w-full p-1 text-sm border border-gray-300 rounded-md"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Máximo: {formatCurrency(totalEscritura * commercialPolicy.bono_pie_max_pct)} UF 
                            ({(commercialPolicy.bono_pie_max_pct * 100).toFixed(1)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="flex justify-between text-sm">
                      <span>Reserva:</span>
                      <span>{formatCurrency(pagoReserva)} UF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Promesa ({pagoPromesaPct}%):</span>
                      <span>{formatCurrency(pagoPromesa)} UF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Pie ({pagoPiePct}%):</span>
                      <span>{formatCurrency(pagoPie)} UF</span>
                    </div>
                    {pagoBonoPieCotizacion > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Bono Pie:</span>
                        <span>{formatCurrency(pagoBonoPieCotizacion)} UF</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Crédito Hipotecario:</span>
                      <span>{formatCurrency(pagoCreditoHipotecarioCalculado)} UF</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-200">
                      <span>Total:</span>
                      <span>{formatCurrency(totalFormaDePago)} UF</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerQuotePage;