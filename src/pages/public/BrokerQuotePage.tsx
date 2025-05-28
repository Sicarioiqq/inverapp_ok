import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useUFStore } from '../../stores/ufStore';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { Loader2, Calculator, Download, Plus, Minus, Building, Home, DollarSign } from 'lucide-react';

interface BrokerQuotePageProps {}

interface Unidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipologia: string;
  piso: string;
  orientacion: string | null;
  valor_lista: number | null;
  sup_util: number | null;
  sup_terraza: number | null;
  sup_total: number | null;
  tipo_bien: string | null;
}

interface Broker {
  id: string;
  name: string;
  business_name: string;
  slug: string;
  public_access_token: string;
}

interface ProjectPolicy {
  project_name: string;
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
}

const BrokerQuotePage: React.FC<BrokerQuotePageProps> = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();
  const { ufValue, fetchUFValue } = useUFStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broker, setBroker] = useState<Broker | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [filteredUnidades, setFilteredUnidades] = useState<Unidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]);
  const [projectPolicies, setProjectPolicies] = useState<Record<string, ProjectPolicy>>({});
  
  // Filtros
  const [proyectoFilter, setProyectoFilter] = useState<string>('');
  const [tipologiaFilter, setTipologiaFilter] = useState<string>('');
  
  // Datos de cotización
  const [clientName, setClientName] = useState<string>('');
  const [clientRut, setClientRut] = useState<string>('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [bonoAmount, setBonoAmount] = useState<number>(0);
  
  // Forma de pago
  const [pagoReserva, setPagoReserva] = useState<number>(0);
  const [pagoPromesa, setPagoPromesa] = useState<number>(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState<number>(0);
  const [pagoPie, setPagoPie] = useState<number>(0);
  const [pagoPiePct, setPagoPiePct] = useState<number>(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0);
  
  // Valores calculados
  const [precioBaseDepartamento, setPrecioBaseDepartamento] = useState<number>(0);
  const [precioDescuentoDepartamento, setPrecioDescuentoDepartamento] = useState<number>(0);
  const [precioDepartamentoConDescuento, setPrecioDepartamentoConDescuento] = useState<number>(0);
  const [precioTotalSecundarios, setPrecioTotalSecundarios] = useState<number>(0);
  const [totalEscritura, setTotalEscritura] = useState<number>(0);
  const [pagoCreditoHipotecarioCalculado, setPagoCreditoHipotecarioCalculado] = useState<number>(0);
  const [totalFormaDePago, setTotalFormaDePago] = useState<number>(0);
  
  // Proyectos y tipologías disponibles
  const [proyectosDisponibles, setProyectosDisponibles] = useState<string[]>([]);
  const [tipologiasDisponibles, setTipologiasDisponibles] = useState<string[]>([]);
  
  // Validación de token
  useEffect(() => {
    const validateToken = async () => {
      try {
        setLoading(true);
        
        if (!brokerSlug || !accessToken) {
          throw new Error('Parámetros de URL incompletos');
        }
        
        // Buscar el broker por slug y token
        const { data: brokerData, error: brokerError } = await supabase
          .from('brokers')
          .select('id, name, business_name, slug, public_access_token')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken)
          .single();
        
        if (brokerError || !brokerData) {
          console.error('Error validando token:', brokerError);
          throw new Error('Acceso denegado: token inválido');
        }
        
        setBroker(brokerData);
        
        // Cargar unidades disponibles
        await fetchUnidades();
        
        // Cargar políticas comerciales
        await fetchProjectPolicies();
        
        // Cargar valor UF
        fetchUFValue();
      } catch (err: any) {
        console.error('Error en validación:', err);
        setError(err.message || 'Error de validación');
      } finally {
        setLoading(false);
      }
    };
    
    validateToken();
  }, [brokerSlug, accessToken]);
  
  // Cargar unidades disponibles
  const fetchUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('*')
        .eq('estado_unidad', 'Disponible')
        .order('proyecto_nombre', { ascending: true })
        .order('unidad', { ascending: true });
      
      if (error) throw error;
      
      setUnidades(data || []);
      setFilteredUnidades(data || []);
      
      // Extraer proyectos disponibles
      const proyectos = [...new Set(data?.map(u => u.proyecto_nombre) || [])];
      setProyectosDisponibles(proyectos);
      
      // Extraer tipologías disponibles (solo para departamentos)
      const tipologias = [...new Set(
        data?.filter(u => u.tipo_bien === 'DEPARTAMENTO')
            .map(u => u.tipologia)
            .filter(Boolean) || []
      )];
      setTipologiasDisponibles(tipologias as string[]);
    } catch (err: any) {
      console.error('Error cargando unidades:', err);
      setError('Error cargando unidades disponibles');
    }
  };
  
  // Cargar políticas comerciales de proyectos
  const fetchProjectPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('project_commercial_policies')
        .select('*');
      
      if (error) throw error;
      
      // Convertir a un objeto indexado por nombre de proyecto
      const policiesMap: Record<string, ProjectPolicy> = {};
      data?.forEach(policy => {
        policiesMap[policy.project_name] = {
          ...policy,
          bono_pie_max_pct: policy.bono_pie_max_pct * 100 // Convertir de decimal a porcentaje
        };
      });
      
      setProjectPolicies(policiesMap);
    } catch (err: any) {
      console.error('Error cargando políticas comerciales:', err);
    }
  };
  
  // Filtrar unidades cuando cambian los filtros
  useEffect(() => {
    let filtered = unidades;
    
    if (proyectoFilter) {
      filtered = filtered.filter(u => u.proyecto_nombre === proyectoFilter);
      
      // Actualizar tipologías disponibles para este proyecto
      const tipologiasProyecto = [...new Set(
        filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO')
               .map(u => u.tipologia)
               .filter(Boolean)
      )];
      setTipologiasDisponibles(tipologiasProyecto as string[]);
    }
    
    if (tipologiaFilter) {
      filtered = filtered.filter(u => u.tipologia === tipologiaFilter);
    }
    
    setFilteredUnidades(filtered);
  }, [proyectoFilter, tipologiaFilter, unidades]);
  
  // Calcular valores cuando cambia la unidad seleccionada o los parámetros
  useEffect(() => {
    if (selectedUnidad) {
      // Precio base del departamento
      const precioBase = selectedUnidad.valor_lista || 0;
      setPrecioBaseDepartamento(precioBase);
      
      // Calcular descuento según el tipo de cotización
      let descuentoUF = 0;
      if (quotationType === 'descuento' || quotationType === 'mix') {
        descuentoUF = (precioBase * discountAmount) / 100;
      }
      setPrecioDescuentoDepartamento(descuentoUF);
      
      // Precio con descuento
      const precioConDescuento = precioBase - descuentoUF;
      setPrecioDepartamentoConDescuento(precioConDescuento);
      
      // Precio total de unidades secundarias
      const totalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
      setPrecioTotalSecundarios(totalSecundarios);
      
      // Total escritura
      const totalEsc = precioConDescuento + totalSecundarios;
      setTotalEscritura(totalEsc);
      
      // Actualizar montos de pago según porcentajes
      const nuevaPromesa = (totalEsc * pagoPromesaPct) / 100;
      setPagoPromesa(nuevaPromesa);
      
      const nuevoPie = (totalEsc * pagoPiePct) / 100;
      setPagoPie(nuevoPie);
      
      // Bono pie (solo si es tipo bono o mix)
      let bonoPie = 0;
      if (quotationType === 'bono' || quotationType === 'mix') {
        bonoPie = bonoAmount;
      }
      setPagoBonoPieCotizacion(bonoPie);
      
      // Calcular crédito hipotecario (lo que falta para completar el total)
      const creditoHipotecario = totalEsc - pagoReserva - nuevaPromesa - nuevoPie - bonoPie;
      setPagoCreditoHipotecarioCalculado(Math.max(0, creditoHipotecario));
      
      // Total forma de pago
      const totalForma = pagoReserva + nuevaPromesa + nuevoPie + Math.max(0, creditoHipotecario) + bonoPie;
      setTotalFormaDePago(totalForma);
      
      // Si hay política comercial para este proyecto, aplicar monto de reserva
      if (selectedUnidad.proyecto_nombre && projectPolicies[selectedUnidad.proyecto_nombre]) {
        const policy = projectPolicies[selectedUnidad.proyecto_nombre];
        
        // Convertir monto de reserva de pesos a UF
        if (ufValue && policy.monto_reserva_pesos > 0) {
          const reservaUF = policy.monto_reserva_pesos / ufValue;
          setPagoReserva(reservaUF);
        }
        
        // Limitar bono pie al máximo permitido
        if (quotationType === 'bono' || quotationType === 'mix') {
          const maxBonoPieUF = (totalEsc * policy.bono_pie_max_pct) / 100;
          if (bonoPie > maxBonoPieUF) {
            setPagoBonoPieCotizacion(maxBonoPieUF);
          }
        }
      }
    }
  }, [
    selectedUnidad, 
    addedSecondaryUnits, 
    quotationType, 
    discountAmount, 
    bonoAmount, 
    pagoReserva, 
    pagoPromesaPct, 
    pagoPiePct,
    ufValue
  ]);
  
  // Seleccionar unidad
  const handleSelectUnidad = (unidad: Unidad) => {
    setSelectedUnidad(unidad);
    // Limpiar unidades secundarias al cambiar de departamento
    setAddedSecondaryUnits([]);
    
    // Establecer valores por defecto para forma de pago
    setPagoPromesaPct(10);
    setPagoPiePct(10);
    
    // Si hay política comercial para este proyecto, aplicar monto de reserva
    if (unidad.proyecto_nombre && projectPolicies[unidad.proyecto_nombre]) {
      const policy = projectPolicies[unidad.proyecto_nombre];
      
      // Convertir monto de reserva de pesos a UF
      if (ufValue && policy.monto_reserva_pesos > 0) {
        const reservaUF = policy.monto_reserva_pesos / ufValue;
        setPagoReserva(reservaUF);
      }
    } else {
      // Valor por defecto si no hay política
      setPagoReserva(10);
    }
  };
  
  // Agregar unidad secundaria
  const handleAddSecondaryUnit = (unidad: Unidad) => {
    // Verificar que no esté ya agregada
    if (!addedSecondaryUnits.some(u => u.id === unidad.id)) {
      setAddedSecondaryUnits([...addedSecondaryUnits, unidad]);
    }
  };
  
  // Quitar unidad secundaria
  const handleRemoveSecondaryUnit = (unidadId: string) => {
    setAddedSecondaryUnits(addedSecondaryUnits.filter(u => u.id !== unidadId));
  };
  
  // Formatear montos como moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Formatear montos como pesos chilenos
  const formatPesos = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Convertir UF a pesos
  const ufToPesos = (ufAmount: number) => {
    if (!ufValue) return 0;
    return ufAmount * ufValue;
  };
  
  // Guardar cotización
  const handleSaveQuote = async () => {
    if (!selectedUnidad || !broker) return;
    
    try {
      setLoading(true);
      
      // Crear objeto de cotización
      const quoteData = {
        broker_id: broker.id,
        client_name: clientName,
        client_rut: clientRut,
        uf_value: ufValue,
        selected_unit: selectedUnidad,
        added_secondary_units: addedSecondaryUnits,
        quotation_type: quotationType,
        discount_amount: discountAmount,
        bono_amount: bonoAmount,
        payment_reserve: pagoReserva,
        payment_promise: pagoPromesa,
        payment_promise_pct: pagoPromesaPct,
        payment_downpayment: pagoPie,
        payment_downpayment_pct: pagoPiePct,
        payment_bono_downpayment: pagoBonoPieCotizacion,
        base_department_price: precioBaseDepartamento,
        discount_department_price: precioDescuentoDepartamento,
        net_department_price: precioDepartamentoConDescuento,
        total_secondary_units_price: precioTotalSecundarios,
        total_deed_price: totalEscritura,
        calculated_mortgage_credit: pagoCreditoHipotecarioCalculado,
        total_payment_form: totalFormaDePago
      };
      
      // Guardar en Supabase
      const { error } = await supabase
        .from('quotations')
        .insert([quoteData]);
      
      if (error) throw error;
      
      // Mostrar mensaje de éxito
      alert('Cotización guardada exitosamente');
    } catch (err: any) {
      console.error('Error guardando cotización:', err);
      setError('Error al guardar la cotización');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700">Cargando cotizador...</h2>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">×</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Error de validación:</p>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!broker) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">×</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">No se pudo validar el acceso al cotizador.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cotizador {broker.name}</h1>
            <p className="text-sm text-gray-500">{broker.business_name}</p>
          </div>
          {ufValue && (
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">Valor UF:</p>
              <p className="text-lg font-semibold text-blue-700">{formatPesos(ufValue)}</p>
            </div>
          )}
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda - Filtros y selección */}
          <div className="lg:col-span-1 space-y-6">
            {/* Datos del cliente */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
                Datos del Cliente
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                  <input
                    type="text"
                    value={clientRut}
                    onChange={(e) => setClientRut(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="12.345.678-9"
                  />
                </div>
              </div>
            </div>
            
            {/* Filtros */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Building className="h-5 w-5 mr-2 text-blue-600" />
                Filtros
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <select
                    value={proyectoFilter}
                    onChange={(e) => {
                      setProyectoFilter(e.target.value);
                      setTipologiaFilter(''); // Reset tipología al cambiar proyecto
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Todos los proyectos</option>
                    {proyectosDisponibles.map(proyecto => (
                      <option key={proyecto} value={proyecto}>{proyecto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipología</label>
                  <select
                    value={tipologiaFilter}
                    onChange={(e) => setTipologiaFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled={!proyectoFilter}
                  >
                    <option value="">Todas las tipologías</option>
                    {tipologiasDisponibles.map(tipologia => (
                      <option key={tipologia} value={tipologia}>{tipologia}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Lista de unidades */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Home className="h-5 w-5 mr-2 text-blue-600" />
                Unidades Disponibles
              </h2>
              
              {filteredUnidades.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay unidades disponibles con los filtros seleccionados</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredUnidades
                    .filter(u => u.tipo_bien === 'DEPARTAMENTO')
                    .map(unidad => (
                      <div 
                        key={unidad.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedUnidad?.id === unidad.id 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => handleSelectUnidad(unidad)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{unidad.unidad} - {unidad.tipologia}</p>
                            <p className="text-sm text-gray-600">{unidad.proyecto_nombre}</p>
                            <p className="text-xs text-gray-500">
                              {unidad.sup_util && `${unidad.sup_util} m² útiles`}
                              {unidad.sup_terraza && ` | ${unidad.sup_terraza} m² terraza`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-blue-600">{formatCurrency(unidad.valor_lista || 0)} UF</p>
                            {ufValue && (
                              <p className="text-xs text-gray-500">{formatPesos(ufToPesos(unidad.valor_lista || 0))}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            {/* Unidades secundarias */}
            {selectedUnidad && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Home className="h-5 w-5 mr-2 text-blue-600" />
                  Unidades Secundarias
                </h2>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {filteredUnidades
                    .filter(u => 
                      u.tipo_bien !== 'DEPARTAMENTO' && 
                      u.proyecto_nombre === selectedUnidad.proyecto_nombre
                    )
                    .map(unidad => (
                      <div 
                        key={unidad.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 border-gray-200 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{unidad.tipo_bien} {unidad.unidad}</p>
                          <p className="text-sm text-gray-600">{unidad.proyecto_nombre}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="font-semibold text-blue-600">{formatCurrency(unidad.valor_lista || 0)} UF</p>
                          
                          {addedSecondaryUnits.some(u => u.id === unidad.id) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSecondaryUnit(unidad.id);
                              }}
                              className="mt-1 text-xs px-2 py-1 bg-red-100 text-red-600 rounded flex items-center"
                            >
                              <Minus className="h-3 w-3 mr-1" />
                              Quitar
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSecondaryUnit(unidad);
                              }}
                              className="mt-1 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded flex items-center"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                  {filteredUnidades.filter(u => 
                    u.tipo_bien !== 'DEPARTAMENTO' && 
                    u.proyecto_nombre === selectedUnidad.proyecto_nombre
                  ).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No hay unidades secundarias disponibles</p>
                  )}
                </div>
                
                {addedSecondaryUnits.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="font-medium text-gray-700 mb-2">Unidades Agregadas</h3>
                    <div className="space-y-2">
                      {addedSecondaryUnits.map(unit => (
                        <div key={unit.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <span>{unit.tipo_bien} {unit.unidad}</span>
                          <span className="font-medium">{formatCurrency(unit.valor_lista || 0)} UF</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-2 bg-blue-100 rounded">
                        <span className="font-medium">Total Secundarios:</span>
                        <span className="font-semibold">{formatCurrency(precioTotalSecundarios)} UF</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Columna derecha - Cotización */}
          <div className="lg:col-span-2 space-y-6">
            {selectedUnidad ? (
              <>
                {/* Detalles de la unidad seleccionada */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Building className="h-6 w-6 mr-2 text-blue-600" />
                    {selectedUnidad.proyecto_nombre} - {selectedUnidad.unidad}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Tipología</p>
                      <p className="font-medium">{selectedUnidad.tipologia}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Piso</p>
                      <p className="font-medium">{selectedUnidad.piso}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Orientación</p>
                      <p className="font-medium">{selectedUnidad.orientacion || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Superficie Útil</p>
                      <p className="font-medium">{selectedUnidad.sup_util} m²</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Superficie Terraza</p>
                      <p className="font-medium">{selectedUnidad.sup_terraza} m²</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500">Superficie Total</p>
                      <p className="font-medium">{selectedUnidad.sup_total} m²</p>
                    </div>
                  </div>
                  
                  {/* Tipo de cotización */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-2">Tipo de Cotización</h3>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={quotationType === 'descuento'}
                          onChange={() => setQuotationType('descuento')}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">Descuento</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={quotationType === 'bono'}
                          onChange={() => setQuotationType('bono')}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">Bono Pie</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={quotationType === 'mix'}
                          onChange={() => setQuotationType('mix')}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">Mixto</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Parámetros según tipo de cotización */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {(quotationType === 'descuento' || quotationType === 'mix') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descuento (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    )}
                    
                    {(quotationType === 'bono' || quotationType === 'mix') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bono Pie (UF)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={bonoAmount}
                          onChange={(e) => setBonoAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        
                        {selectedUnidad.proyecto_nombre && 
                         projectPolicies[selectedUnidad.proyecto_nombre] && 
                         projectPolicies[selectedUnidad.proyecto_nombre].bono_pie_max_pct > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Máximo permitido: {projectPolicies[selectedUnidad.proyecto_nombre].bono_pie_max_pct}% 
                            ({formatCurrency((totalEscritura * projectPolicies[selectedUnidad.proyecto_nombre].bono_pie_max_pct) / 100)} UF)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Resumen de precios */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-2">Resumen de Precios</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio Lista Departamento:</span>
                        <span>{formatCurrency(precioBaseDepartamento)} UF</span>
                      </div>
                      
                      {(quotationType === 'descuento' || quotationType === 'mix') && precioDescuentoDepartamento > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Descuento ({discountAmount}%):</span>
                          <span>-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-medium">
                        <span>Precio Departamento con Descuento:</span>
                        <span>{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                      </div>
                      
                      {precioTotalSecundarios > 0 && (
                        <div className="flex justify-between">
                          <span>Unidades Secundarias:</span>
                          <span>{formatCurrency(precioTotalSecundarios)} UF</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-200">
                        <span>Total Escrituración:</span>
                        <span>{formatCurrency(totalEscritura)} UF</span>
                      </div>
                      
                      {ufValue && (
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Equivalente en pesos:</span>
                          <span>{formatPesos(ufToPesos(totalEscritura))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Forma de pago */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Forma de Pago</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reserva (UF)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={pagoReserva}
                          onChange={(e) => setPagoReserva(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Promesa (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={pagoPromesaPct}
                          onChange={(e) => setPagoPromesaPct(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Equivale a {formatCurrency(pagoPromesa)} UF
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pie (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={pagoPiePct}
                          onChange={(e) => setPagoPiePct(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Equivale a {formatCurrency(pagoPie)} UF
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Crédito Hipotecario (UF)
                        </label>
                        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md">
                          {formatCurrency(pagoCreditoHipotecarioCalculado)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {pagoCreditoHipotecarioCalculado > 0 
                            ? `${((pagoCreditoHipotecarioCalculado / totalEscritura) * 100).toFixed(1)}% del total`
                            : 'No requiere crédito hipotecario'}
                        </p>
                      </div>
                      
                      {(quotationType === 'bono' || quotationType === 'mix') && pagoBonoPieCotizacion > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bono Pie (UF)
                          </label>
                          <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md">
                            {formatCurrency(pagoBonoPieCotizacion)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total Forma de Pago:</span>
                        <span>{formatCurrency(totalFormaDePago)} UF</span>
                      </div>
                      
                      {ufValue && (
                        <div className="flex justify-between text-sm text-gray-600 mt-1">
                          <span>Equivalente en pesos:</span>
                          <span>{formatPesos(ufToPesos(totalFormaDePago))}</span>
                        </div>
                      )}
                      
                      {Math.abs(totalFormaDePago - totalEscritura) > 0.01 && (
                        <div className="mt-2 text-sm text-red-600">
                          ⚠️ La forma de pago no coincide con el total de escrituración. 
                          Ajuste los valores para que coincidan.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={handleSaveQuote}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Save className="h-5 w-5 mr-2" />
                      Guardar Cotización
                    </button>
                    
                    {/* PDF Download Link */}
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
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                      >
                        {({ loading }) => (
                          loading ? 
                            <span className="flex items-center">
                              <Loader2 className="animate-spin h-5 w-5 mr-2" />
                              Generando PDF...
                            </span> : 
                            <span className="flex items-center">
                              <Download className="h-5 w-5 mr-2" />
                              Descargar PDF
                            </span>
                        )}
                      </PDFDownloadLink>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Building className="h-16 w-16 text-blue-200 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Seleccione una Unidad</h2>
                <p className="text-gray-600">
                  Para comenzar, seleccione un departamento de la lista de unidades disponibles.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Cotizador {broker.name}</h3>
              <p className="text-sm text-gray-400">{broker.business_name}</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} - Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BrokerQuotePage;