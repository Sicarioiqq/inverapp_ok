import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { Home, ParkingMeter as Parking, Package, Settings, Download, Plus, Trash2 } from 'lucide-react';

// Definición de tipos
interface StockUnidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipo_bien: string;
  tipologia: string;
  piso: string;
  orientacion: string;
  valor_lista: number;
  sup_util: number;
  sup_terraza: number;
  sup_total: number;
  estado_unidad: string;
}

interface ProjectCommercialPolicy {
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
}

interface BrokerCommissionRate {
  commission_rate: number;
}

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  
  // Estado para datos del broker
  const [broker, setBroker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para stock y filtros
  const [stockUnidades, setStockUnidades] = useState<StockUnidad[]>([]);
  const [proyectos, setProyectos] = useState<string[]>([]);
  const [tipologias, setTipologias] = useState<string[]>([]);
  const [filtroProyecto, setFiltroProyecto] = useState<string>('');
  const [filtroTipologia, setFiltroTipologia] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('valor_lista');
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(true);
  
  // Estado para la cotización
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnidad[]>([]);
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [bonoAmount, setBonoAmount] = useState<number>(0);
  const [ufValue, setUFValue] = useState<number | null>(null);
  
  // Estado para cliente
  const [clientName, setClientName] = useState<string>('');
  const [clientRut, setClientRut] = useState<string>('');
  
  // Estado para forma de pago
  const [pagoReserva, setPagoReserva] = useState<number>(0);
  const [pagoPromesa, setPagoPromesa] = useState<number>(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState<number>(0);
  const [pagoPie, setPagoPie] = useState<number>(0);
  const [pagoPiePct, setPagoPiePct] = useState<number>(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0);
  
  // Estado para pestañas
  const [activeTab, setActiveTab] = useState<'principales' | 'secundarios' | 'configuracion'>('principales');
  
  // Políticas comerciales
  const [commercialPolicies, setCommercialPolicies] = useState<Record<string, ProjectCommercialPolicy>>({});
  const [commissionRates, setCommissionRates] = useState<Record<string, BrokerCommissionRate>>({});

  // Validar acceso del broker
  useEffect(() => {
    const validateBrokerAccess = async () => {
      try {
        setLoading(true);
        
        // Verificar que el broker existe y tiene el token de acceso correcto
        const { data: brokerData, error: brokerError } = await supabase
          .from('brokers')
          .select('*')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken)
          .single();
        
        if (brokerError) {
          throw new Error('Broker no encontrado o token inválido');
        }
        
        setBroker(brokerData);
        
        // Cargar datos necesarios
        await Promise.all([
          fetchStockUnidades(),
          fetchCommercialPolicies(),
          fetchCommissionRates(brokerData.id),
          fetchUFValue()
        ]);
        
      } catch (err: any) {
        console.error('Error validando acceso:', err);
        setError(err.message || 'Error al validar acceso');
      } finally {
        setLoading(false);
      }
    };
    
    validateBrokerAccess();
  }, [brokerSlug, accessToken]);

  // Cargar valor UF
  const fetchUFValue = async () => {
    try {
      const { data, error } = await supabase
        .from('valores_financieros')
        .select('valor')
        .eq('nombre', 'UF')
        .order('fecha', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setUFValue(data[0].valor);
      } else {
        throw new Error('No se encontró valor UF');
      }
    } catch (err: any) {
      console.error('Error al obtener valor UF:', err);
      setError('Error al obtener valor UF: ' + err.message);
    }
  };

  // Cargar stock de unidades
  const fetchStockUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('*')
        .eq('estado_unidad', 'Disponible');
      
      if (error) throw error;
      
      if (data) {
        setStockUnidades(data);
        
        // Extraer proyectos únicos
        const uniqueProyectos = Array.from(new Set(data.map(u => u.proyecto_nombre)));
        setProyectos(uniqueProyectos);
        
        // Extraer tipologías únicas (solo para departamentos)
        const uniqueTipologias = Array.from(
          new Set(
            data
              .filter(u => u.tipo_bien === 'DEPARTAMENTO')
              .map(u => u.tipologia)
          )
        );
        setTipologias(uniqueTipologias);
      }
    } catch (err: any) {
      console.error('Error al cargar stock:', err);
      setError('Error al cargar stock: ' + err.message);
    }
  };

  // Cargar políticas comerciales
  const fetchCommercialPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('project_commercial_policies')
        .select('*');
      
      if (error) throw error;
      
      if (data) {
        // Convertir a un objeto para fácil acceso por nombre de proyecto
        const policiesMap: Record<string, ProjectCommercialPolicy> = {};
        data.forEach(policy => {
          policiesMap[policy.project_name] = {
            monto_reserva_pesos: policy.monto_reserva_pesos || 0,
            bono_pie_max_pct: policy.bono_pie_max_pct || 0,
            fecha_tope: policy.fecha_tope
          };
        });
        
        setCommercialPolicies(policiesMap);
      }
    } catch (err: any) {
      console.error('Error al cargar políticas comerciales:', err);
      setError('Error al cargar políticas comerciales: ' + err.message);
    }
  };

  // Cargar tasas de comisión del broker
  const fetchCommissionRates = async (brokerId: string) => {
    try {
      const { data, error } = await supabase
        .from('broker_project_commissions')
        .select('*')
        .eq('broker_id', brokerId);
      
      if (error) throw error;
      
      if (data) {
        // Convertir a un objeto para fácil acceso por nombre de proyecto
        const ratesMap: Record<string, BrokerCommissionRate> = {};
        data.forEach(rate => {
          ratesMap[rate.project_name] = {
            commission_rate: rate.commission_rate || 0
          };
        });
        
        setCommissionRates(ratesMap);
      }
    } catch (err: any) {
      console.error('Error al cargar tasas de comisión:', err);
      setError('Error al cargar tasas de comisión: ' + err.message);
    }
  };

  // Filtrar y ordenar unidades
  const filteredUnidades = useMemo(() => {
    let filtered = [...stockUnidades];
    
    // Filtrar por tipo según la pestaña activa
    if (activeTab === 'principales') {
      filtered = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');
    } else if (activeTab === 'secundarios') {
      filtered = filtered.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
    }
    
    // Aplicar filtros adicionales
    if (filtroProyecto) {
      filtered = filtered.filter(u => u.proyecto_nombre === filtroProyecto);
    }
    
    if (filtroTipologia && activeTab === 'principales') {
      filtered = filtered.filter(u => u.tipologia === filtroTipologia);
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (ordenarPor) {
        case 'valor_lista':
          comparison = (a.valor_lista || 0) - (b.valor_lista || 0);
          break;
        case 'proyecto_nombre':
          comparison = (a.proyecto_nombre || '').localeCompare(b.proyecto_nombre || '');
          break;
        case 'unidad':
          comparison = (a.unidad || '').localeCompare(b.unidad || '');
          break;
        case 'tipologia':
          comparison = (a.tipologia || '').localeCompare(b.tipologia || '');
          break;
        case 'sup_util':
          comparison = (a.sup_util || 0) - (b.sup_util || 0);
          break;
        default:
          comparison = (a.valor_lista || 0) - (b.valor_lista || 0);
      }
      
      return ordenAscendente ? comparison : -comparison;
    });
    
    return filtered;
  }, [stockUnidades, filtroProyecto, filtroTipologia, ordenarPor, ordenAscendente, activeTab]);

  // Manejar selección de unidad principal
  const handleSelectUnit = (unidad: StockUnidad) => {
    setSelectedUnidad(unidad);
    
    // Obtener política comercial del proyecto
    const policy = commercialPolicies[unidad.proyecto_nombre];
    
    // Establecer monto de reserva
    if (policy && policy.monto_reserva_pesos && ufValue) {
      const reservaUF = policy.monto_reserva_pesos / ufValue;
      setPagoReserva(parseFloat(reservaUF.toFixed(2)));
    } else {
      setPagoReserva(0);
    }
    
    // Cambiar a la pestaña de configuración cuando se selecciona una unidad
    setActiveTab('configuracion');
  };

  // Manejar adición de unidad secundaria
  const handleAddSecondaryUnit = (unidad: StockUnidad) => {
    // Verificar que no esté ya agregada
    if (!addedSecondaryUnits.some(u => u.id === unidad.id)) {
      setAddedSecondaryUnits([...addedSecondaryUnits, unidad]);
    }
  };

  // Manejar eliminación de unidad secundaria
  const handleRemoveSecondaryUnit = (unidadId: string) => {
    setAddedSecondaryUnits(addedSecondaryUnits.filter(u => u.id !== unidadId));
  };

  // Calcular precios
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  
  // Calcular descuento según tipo de cotización
  const precioDescuentoDepartamento = useMemo(() => {
    if (!selectedUnidad) return 0;
    
    if (quotationType === 'descuento') {
      return (precioBaseDepartamento * discountAmount) / 100;
    } else if (quotationType === 'mix') {
      return (precioBaseDepartamento * discountAmount) / 100;
    }
    
    return 0;
  }, [selectedUnidad, quotationType, discountAmount, precioBaseDepartamento]);
  
  // Precio con descuento
  const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
  
  // Precio total de unidades secundarias
  const precioTotalSecundarios = addedSecondaryUnits.reduce((total, unit) => total + (unit.valor_lista || 0), 0);
  
  // Precio total de escrituración
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
  
  // Calcular crédito hipotecario
  const pagoCreditoHipotecarioCalculado = totalEscritura - pagoReserva - pagoPromesa - pagoPie - pagoBonoPieCotizacion;
  
  // Total forma de pago
  const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

  // Actualizar porcentajes cuando cambian los montos
  useEffect(() => {
    if (totalEscritura > 0) {
      setPagoPromesaPct(parseFloat(((pagoPromesa / totalEscritura) * 100).toFixed(2)));
      setPagoPiePct(parseFloat(((pagoPie / totalEscritura) * 100).toFixed(2)));
    }
  }, [pagoPromesa, pagoPie, totalEscritura]);

  // Actualizar montos cuando cambian los porcentajes
  const handlePromesaPctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    setPagoPromesaPct(pct);
    if (totalEscritura > 0) {
      setPagoPromesa(parseFloat(((pct / 100) * totalEscritura).toFixed(2)));
    }
  };

  const handlePiePctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    setPagoPiePct(pct);
    if (totalEscritura > 0) {
      setPagoPie(parseFloat(((pct / 100) * totalEscritura).toFixed(2)));
    }
  };

  // Formatear montos
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error de Acceso</h1>
          <p className="text-gray-700">{error || 'No se pudo validar el acceso al cotizador'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logoinversiones.png" alt="Logo" className="h-12" />
            <div className="ml-4">
              <h1 className="text-xl font-bold text-gray-900">Cotizador {broker.name}</h1>
              <p className="text-sm text-gray-600">{broker.business_name}</p>
            </div>
          </div>
          {ufValue && (
            <div className="bg-blue-50 px-4 py-2 rounded-md">
              <span className="text-sm font-medium text-blue-700">
                UF: $ {ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 mb-6">
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
              <Parking className="h-5 w-5 inline-block mr-1" />
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

        {/* Principales & Secundarios Tabs Content */}
        {(activeTab === 'principales' || activeTab === 'secundarios') && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-wrap gap-4 mb-6">
              {/* Filtro por Proyecto */}
              <div className="w-full md:w-64">
                <label htmlFor="proyecto" className="block text-sm font-medium text-gray-700 mb-1">
                  Proyecto
                </label>
                <select
                  id="proyecto"
                  value={filtroProyecto}
                  onChange={(e) => setFiltroProyecto(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Todos los proyectos</option>
                  {proyectos.map((proyecto) => (
                    <option key={proyecto} value={proyecto}>
                      {proyecto}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Tipología (solo para Principales) */}
              {activeTab === 'principales' && (
                <div className="w-full md:w-64">
                  <label htmlFor="tipologia" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipología
                  </label>
                  <select
                    id="tipologia"
                    value={filtroTipologia}
                    onChange={(e) => setFiltroTipologia(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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

              {/* Ordenar por */}
              <div className="w-full md:w-64">
                <label htmlFor="ordenar" className="block text-sm font-medium text-gray-700 mb-1">
                  Ordenar por
                </label>
                <select
                  id="ordenar"
                  value={ordenarPor}
                  onChange={(e) => setOrdenarPor(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="valor_lista">Precio</option>
                  <option value="proyecto_nombre">Proyecto</option>
                  <option value="unidad">Número</option>
                  <option value="tipologia">Tipología</option>
                  <option value="sup_util">Superficie Útil</option>
                </select>
              </div>

              {/* Orden ascendente/descendente */}
              <div className="w-full md:w-64">
                <label htmlFor="orden" className="block text-sm font-medium text-gray-700 mb-1">
                  Orden
                </label>
                <select
                  id="orden"
                  value={ordenAscendente ? 'asc' : 'desc'}
                  onChange={(e) => setOrdenAscendente(e.target.value === 'asc')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>
            </div>

            {/* Tabla de unidades */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proyecto
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      N° Unidad
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    {activeTab === 'principales' && (
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipología
                      </th>
                    )}
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Piso
                    </th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sup. Útil
                    </th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sup. Total
                    </th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio UF
                    </th>
                    <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUnidades.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-gray-500">
                        No hay unidades disponibles con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredUnidades.map((unidad) => (
                      <tr key={unidad.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {unidad.proyecto_nombre}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {unidad.unidad}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {unidad.tipo_bien}
                        </td>
                        {activeTab === 'principales' && (
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {unidad.tipologia}
                          </td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {unidad.piso}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {unidad.sup_util?.toFixed(2)} m²
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {unidad.sup_total?.toFixed(2)} m²
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {unidad.valor_lista?.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {activeTab === 'principales' ? (
                            <button
                              onClick={() => handleSelectUnit(unidad)}
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Seleccionar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddSecondaryUnit(unidad)}
                              disabled={!selectedUnidad}
                              className={`inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded ${
                                selectedUnidad
                                  ? 'text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                                  : 'text-gray-500 bg-gray-200 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Agregar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Configuración Cotización Tab Content */}
        {activeTab === 'configuracion' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna 1: Información de Unidades */}
            <div className="space-y-6">
              {/* Unidad Principal */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Unidad Principal</h2>
                
                {selectedUnidad ? (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Proyecto:</span>
                      <span className="font-medium">{selectedUnidad.proyecto_nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Unidad:</span>
                      <span className="font-medium">{selectedUnidad.unidad}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipología:</span>
                      <span className="font-medium">{selectedUnidad.tipologia}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Piso:</span>
                      <span className="font-medium">{selectedUnidad.piso}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Superficie Útil:</span>
                      <span className="font-medium">{selectedUnidad.sup_util?.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Superficie Terraza:</span>
                      <span className="font-medium">{selectedUnidad.sup_terraza?.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Superficie Total:</span>
                      <span className="font-medium">{selectedUnidad.sup_total?.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Precio Lista:</span>
                      <span className="font-medium">{formatCurrency(selectedUnidad.valor_lista || 0)} UF</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUnidad(null);
                        setAddedSecondaryUnits([]);
                        setActiveTab('principales');
                      }}
                      className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cambiar Unidad
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No hay unidad seleccionada</p>
                    <button
                      onClick={() => setActiveTab('principales')}
                      className="mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Seleccionar Unidad
                    </button>
                  </div>
                )}
              </div>

              {/* Unidades Secundarias */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Unidades Secundarias</h2>
                
                {addedSecondaryUnits.length > 0 ? (
                  <div className="space-y-4">
                    {addedSecondaryUnits.map((unit) => (
                      <div key={unit.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                        <div>
                          <p className="font-medium">{unit.tipo_bien} {unit.unidad}</p>
                          <p className="text-sm text-gray-600">{formatCurrency(unit.valor_lista || 0)} UF</p>
                        </div>
                        <button
                          onClick={() => handleRemoveSecondaryUnit(unit.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between pt-3 border-t">
                      <span className="font-medium">Total Secundarios:</span>
                      <span className="font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('secundarios')}
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Agregar Más
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">No hay unidades secundarias agregadas</p>
                    <button
                      onClick={() => setActiveTab('secundarios')}
                      disabled={!selectedUnidad}
                      className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium ${
                        selectedUnidad
                          ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                          : 'text-gray-500 bg-gray-200 cursor-not-allowed'
                      }`}
                    >
                      Agregar Unidades Secundarias
                    </button>
                  </div>
                )}
              </div>

              {/* Información del Cliente */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Cliente</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="clientRut" className="block text-sm font-medium text-gray-700 mb-1">
                      RUT
                    </label>
                    <input
                      type="text"
                      id="clientRut"
                      value={clientRut}
                      onChange={(e) => setClientRut(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Columna 2: Precios y Descuentos */}
            <div className="space-y-6">
              {/* Tipo de Cotización */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Cotización</h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        id="descuento"
                        name="quotationType"
                        type="radio"
                        checked={quotationType === 'descuento'}
                        onChange={() => setQuotationType('descuento')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="descuento" className="ml-2 block text-sm text-gray-700">
                        Descuento
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="bono"
                        name="quotationType"
                        type="radio"
                        checked={quotationType === 'bono'}
                        onChange={() => setQuotationType('bono')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="bono" className="ml-2 block text-sm text-gray-700">
                        Bono
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="mix"
                        name="quotationType"
                        type="radio"
                        checked={quotationType === 'mix'}
                        onChange={() => setQuotationType('mix')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="mix" className="ml-2 block text-sm text-gray-700">
                        Mixto
                      </label>
                    </div>
                  </div>

                  {/* Campos según tipo de cotización */}
                  {(quotationType === 'descuento' || quotationType === 'mix') && (
                    <div>
                      <label htmlFor="discountAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Porcentaje de Descuento (%)
                      </label>
                      <input
                        type="number"
                        id="discountAmount"
                        min="0"
                        max="100"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {(quotationType === 'bono' || quotationType === 'mix') && (
                    <div>
                      <label htmlFor="bonoAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Monto Bono Pie (UF)
                      </label>
                      <input
                        type="number"
                        id="bonoAmount"
                        min="0"
                        step="0.01"
                        value={bonoAmount}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setBonoAmount(value);
                          setPagoBonoPieCotizacion(value);
                        }}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de Precios */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Precios</h2>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Precio Base Departamento:</span>
                    <span className="font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                  </div>
                  
                  {precioDescuentoDepartamento > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Descuento ({discountAmount}%):</span>
                      <span className="font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Precio Departamento con Descuento:</span>
                    <span className="font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                  </div>
                  
                  {precioTotalSecundarios > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Precio Unidades Secundarias:</span>
                      <span className="font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-3 border-t">
                    <span className="font-semibold">Total Escrituración:</span>
                    <span className="font-semibold">{formatCurrency(totalEscritura)} UF</span>
                  </div>
                  
                  {ufValue && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Equivalente en pesos:</span>
                      <span>$ {(totalEscritura * ufValue).toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comisión Broker */}
              {selectedUnidad && commissionRates[selectedUnidad.proyecto_nombre] && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Comisión Broker</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tasa de Comisión:</span>
                      <span className="font-medium">{commissionRates[selectedUnidad.proyecto_nombre].commission_rate.toFixed(3)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monto Comisión:</span>
                      <span className="font-medium">
                        {formatCurrency((totalEscritura * commissionRates[selectedUnidad.proyecto_nombre].commission_rate) / 100)} UF
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Columna 3: Forma de Pago */}
            <div className="space-y-6">
              {/* Forma de Pago */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pago</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="pagoReserva" className="block text-sm font-medium text-gray-700 mb-1">
                      Reserva (UF)
                    </label>
                    <input
                      type="number"
                      id="pagoReserva"
                      min="0"
                      step="0.01"
                      value={pagoReserva}
                      onChange={(e) => setPagoReserva(parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pagoPromesa" className="block text-sm font-medium text-gray-700 mb-1">
                        Promesa (UF)
                      </label>
                      <input
                        type="number"
                        id="pagoPromesa"
                        min="0"
                        step="0.01"
                        value={pagoPromesa}
                        onChange={(e) => setPagoPromesa(parseFloat(e.target.value) || 0)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pagoPromesaPct" className="block text-sm font-medium text-gray-700 mb-1">
                        Promesa (%)
                      </label>
                      <input
                        type="number"
                        id="pagoPromesaPct"
                        min="0"
                        max="100"
                        step="0.01"
                        value={pagoPromesaPct}
                        onChange={handlePromesaPctChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pagoPie" className="block text-sm font-medium text-gray-700 mb-1">
                        Pie (UF)
                      </label>
                      <input
                        type="number"
                        id="pagoPie"
                        min="0"
                        step="0.01"
                        value={pagoPie}
                        onChange={(e) => setPagoPie(parseFloat(e.target.value) || 0)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pagoPiePct" className="block text-sm font-medium text-gray-700 mb-1">
                        Pie (%)
                      </label>
                      <input
                        type="number"
                        id="pagoPiePct"
                        min="0"
                        max="100"
                        step="0.01"
                        value={pagoPiePct}
                        onChange={handlePiePctChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  {(quotationType === 'bono' || quotationType === 'mix') && (
                    <div>
                      <label htmlFor="pagoBonoPie" className="block text-sm font-medium text-gray-700 mb-1">
                        Bono Pie (UF)
                      </label>
                      <input
                        type="number"
                        id="pagoBonoPie"
                        min="0"
                        step="0.01"
                        value={pagoBonoPieCotizacion}
                        onChange={(e) => setPagoBonoPieCotizacion(parseFloat(e.target.value) || 0)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="pagoCreditoHipotecario" className="block text-sm font-medium text-gray-700 mb-1">
                      Crédito Hipotecario (UF)
                    </label>
                    <input
                      type="number"
                      id="pagoCreditoHipotecario"
                      readOnly
                      value={pagoCreditoHipotecarioCalculado}
                      className="block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                    />
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Forma de Pago:</span>
                      <span className="font-semibold">{formatCurrency(totalFormaDePago)} UF</span>
                    </div>
                    
                    {totalFormaDePago !== totalEscritura && (
                      <div className="mt-2 text-sm text-red-600">
                        La forma de pago no coincide con el total de escrituración ({formatCurrency(totalEscritura)} UF)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>
                <div className="space-y-4">
                  {selectedUnidad && (
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
                      {({ blob, url, loading, error }) =>
                        loading ? 'Generando PDF...' : (
                          <>
                            <Download className="h-5 w-5 mr-2" />
                            Descargar Cotización PDF
                          </>
                        )
                      }
                    </PDFDownloadLink>
                  )}
                  
                  <button
                    onClick={() => {
                      // Limpiar formulario
                      setSelectedUnidad(null);
                      setAddedSecondaryUnits([]);
                      setClientName('');
                      setClientRut('');
                      setQuotationType('descuento');
                      setDiscountAmount(0);
                      setBonoAmount(0);
                      setPagoReserva(0);
                      setPagoPromesa(0);
                      setPagoPromesaPct(0);
                      setPagoPie(0);
                      setPagoPiePct(0);
                      setPagoBonoPieCotizacion(0);
                      setActiveTab('principales');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Limpiar y Comenzar Nueva Cotización
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} {broker.name}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BrokerQuotePage;