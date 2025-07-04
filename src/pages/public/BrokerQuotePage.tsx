import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useUFStore } from '../../stores/ufStore';
import { PDFDownloadLink, BlobProvider } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { Loader2, Calculator, Download, Plus, Minus, Building, Home, DollarSign, Save, Home as HomeIcon, ArrowLeft, ChevronUp, ChevronDown, Wrench, Check, X, Folder } from 'lucide-react';
import logoinversiones from './logoinversiones.png';
import { Dialog, Tab } from '@headlessui/react';
import * as XLSX from 'xlsx';

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
  descuento?: number;
  commission_rate?: number;
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
  comuna: string | null;
  commission_rate: number;
  observaciones?: string;
  habilitacion?: boolean;
  real_estate_agency_id?: string;
}

interface BrokerProjectCommission {
  id: string;
  broker_id: string;
  project_name: string;
  commission_rate: number;
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
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [tipoCotizacionWizard, setTipoCotizacionWizard] = useState<'descuento' | 'bono' | null>(null);
  
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
  const [pagoCreditoHipotecarioCalculado, setPagoCreditoHipotecarioCalculado] = useState<number>(0);
  const [totalFormaDePago, setTotalFormaDePago] = useState<number>(0);
  
  // Proyectos y tipologías disponibles
  const [proyectosDisponibles, setProyectosDisponibles] = useState<string[]>([]);
  const [tipologiasDisponibles, setTipologiasDisponibles] = useState<string[]>([]);
  
  const [fechaUF, setFechaUF] = useState<string | null>(null);
  
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedProyecto, setSelectedProyecto] = useState<string>('');
  
  // Estado para ordenamiento de columnas
  const [sortColumn, setSortColumn] = useState<string>('unidad');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Filtros para la tabla de unidades en el paso 3
  const [tablaTipologiaFilter, setTablaTipologiaFilter] = useState<string>('');
  const [tablaOrientacionFilter, setTablaOrientacionFilter] = useState<string>('');
  
  const [brokerCommissions, setBrokerCommissions] = useState<BrokerProjectCommission[]>([]);
  
  // Filtro para tipo_bien en unidades secundarias
  const [tipoBienSecundario, setTipoBienSecundario] = useState<string>('');
  
  // Nuevo estado para porcentaje de crédito hipotecario
  const [pagoCreditoHipotecarioPct, setPagoCreditoHipotecarioPct] = useState<number>(0);
  
  // Nuevo estado para total de escrituración final
  const [totalEscrituraFinal, setTotalEscrituraFinal] = useState<number>(0);
  
  // Nuevo estado para totalEscritura_2dec
  const [totalEscritura_2dec, setTotalEscritura_2dec] = useState<number>(0);
  
  // 1. Estados raw para inputs editables
  const [promesaRaw, setPromesaRaw] = useState<number | null>(null);
  const [pieRaw, setPieRaw] = useState<number | null>(null);
  const [creditoRaw, setCreditoRaw] = useState<number | null>(null);
  
  // Agregar estado para bonoAmount
  const [bonoAmount, setBonoAmount] = useState<number>(0);
  
  // Estados para inputs de porcentaje editables (para UX fluida)
  const [promesaPctInput, setPromesaPctInput] = useState<string>(pagoPromesaPct.toFixed(2));
  const [piePctInput, setPiePctInput] = useState<string>(pagoPiePct.toFixed(2));
  const [creditoPctInput, setCreditoPctInput] = useState<string>(pagoCreditoHipotecarioPct.toFixed(2));

  // 1. Agrega un estado para la inmobiliaria seleccionada
  const [realEstateAgency, setRealEstateAgency] = useState<any>(null);
  const [montoReservaPesos, setMontoReservaPesos] = useState<number | null>(null);

  // 1. Agrega un estado para el número de cotización y la carga de guardado
  const [numeroCotizacion, setNumeroCotizacion] = useState<number | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [saveQuoteError, setSaveQuoteError] = useState<string | null>(null);

  useEffect(() => { setPromesaPctInput(pagoPromesaPct.toFixed(2)); }, [pagoPromesaPct]);
  useEffect(() => { setPiePctInput(pagoPiePct.toFixed(2)); }, [pagoPiePct]);
  useEffect(() => { setCreditoPctInput(pagoCreditoHipotecarioPct.toFixed(2)); }, [pagoCreditoHipotecarioPct]);
  
  // Obtener la fecha de actualización del stock (fecha_carga más reciente)
  useEffect(() => {
    const fetchFechaUF = async () => {
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('fecha_carga')
        .order('fecha_carga', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setFechaUF(data[0].fecha_carga);
      }
    };
    fetchFechaUF();
  }, []);
  
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
      // Traer todas las unidades disponibles con paginación
      const BATCH = 1000;
      let allUnidades: Unidad[] = [];
      for (let from = 0; ; from += BATCH) {
        const { data: chunk, error: chunkErr } = await supabase
          .from('stock_unidades')
          .select('*')
          .eq('estado_unidad', 'Disponible')
          .order('proyecto_nombre', { ascending: true })
          .order('unidad', { ascending: true })
          .range(from, from + BATCH - 1);
        if (chunkErr) throw chunkErr;
        if (!chunk?.length) break;
        allUnidades = allUnidades.concat(chunk);
        if (chunk.length < BATCH) break;
      }
      // Filtrar unidades SOLO por proyectos habilitados en la política comercial
      const unidadesFiltradas = allUnidades.filter((u: Unidad) => proyectosHabilitadosPolitica.includes(u.proyecto_nombre));
      setUnidades(unidadesFiltradas);
      setFilteredUnidades(unidadesFiltradas);
      // Proyectos únicos habilitados (ya no se usa aquí, lo maneja fetchProjectPolicies)
      // Tipologías
      const tipologias = [...new Set(
        (unidadesFiltradas || []).filter((u: Unidad) => u.tipo_bien === 'DEPARTAMENTO')
          .map((u: Unidad) => u.tipologia)
          .filter(Boolean)
      )];
      setTipologiasDisponibles(tipologias as string[]);
    } catch (err: any) {
      console.error('Error cargando unidades o proyectos:', err);
      setError('Error cargando unidades o proyectos disponibles');
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
      const policiesMap: Record<string, ProjectPolicy & { habilitacion?: boolean }> = {};
      const proyectosHabilitados: string[] = [];
      data?.forEach(policy => {
        policiesMap[policy.project_name] = {
          ...policy,
          bono_pie_max_pct: policy.bono_pie_max_pct * 100 // Convertir de decimal a porcentaje
        };
        if (policy.habilitacion) {
          proyectosHabilitados.push(policy.project_name);
        }
      });
      setProjectPolicies(policiesMap);
      setProyectosDisponibles(proyectosHabilitados.sort());
      setProyectosHabilitadosPolitica(proyectosHabilitados);
    } catch (err: any) {
      console.error('Error cargando políticas comerciales:', err);
    }
  };
  
  // Cargar comisiones de broker por proyecto
  useEffect(() => {
    const fetchBrokerCommissions = async () => {
      if (!broker) return;
      const { data, error } = await supabase
        .from('broker_project_commissions')
        .select('*')
        .eq('broker_id', broker.id);
      if (!error && data) {
        setBrokerCommissions(data);
      }
    };
    fetchBrokerCommissions();
  }, [broker]);
  
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
      const precioBase = selectedUnidad.valor_lista || 0;
      setPrecioBaseDepartamento(precioBase);

      let descuentoUF = 0;
      if (tipoCotizacionWizard === 'descuento') {
        // Calcular descuento ajustado con comisión del broker
        const valorLista = selectedUnidad.valor_lista || 0;
        const descuentoUnidad = selectedUnidad.descuento || 0;
        const commissionRate = getCommissionRate(selectedUnidad.proyecto_nombre);
        const valorConDescuento = valorLista * (1 - descuentoUnidad);
        const comisionBroker = valorConDescuento * (commissionRate / 100);
        const montoDescuento = valorLista * descuentoUnidad;
        const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista);
        const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 1000) / 10;
        descuentoUF = valorLista * (porcentajeRedondeado / 100);
      } else if (tipoCotizacionWizard === 'bono') {
        // Calcular descuento real SOLO aquí
        const { descuentoAplicableUF } = calculateBonoPieYDescuento(
          selectedUnidad,
          totalEscrituraFinal,
          projectPolicies
        );
        descuentoUF = descuentoAplicableUF;
      }
      setPrecioDescuentoDepartamento(descuentoUF);

      const precioConDescuento = precioBase - descuentoUF;
      setPrecioDepartamentoConDescuento(precioConDescuento);

      const totalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
      setPrecioTotalSecundarios(totalSecundarios);
    }
  }, [selectedUnidad, addedSecondaryUnits, discountAmount, tipoCotizacionWizard, totalEscrituraFinal, projectPolicies]);
  
  // Mover getCommissionRate aquí antes de calculateBonoPie
  const getCommissionRate = (proyecto: string) => {
    const commission = brokerCommissions.find(c => c.project_name === proyecto);
    return commission?.commission_rate ?? 0;
  };

  // Nueva función para calcular bono pie y descuento considerando la política comercial
  const calculateBonoPieYDescuento = (unidad: Unidad | null, totalEscritura: number, projectPolicies: Record<string, ProjectPolicy>) => {
    if (!unidad || tipoCotizacionWizard !== 'bono') return {
      bonoPieAplicableUF: 0,
      bonoPieAplicablePct: 0,
      descuentoAplicableUF: 0,
      descuentoAplicablePct: 0,
      bonoPieMaximoUF: 0,
      bonoPieMaximoPct: 0,
      bonoPieCalculadoUF: 0,
      bonoPieCalculadoPct: 0,
    };
    const valorLista = unidad.valor_lista || 0;
    const descuentoUnidad = unidad.descuento || 0;
    const commissionRate = getCommissionRate(unidad.proyecto_nombre);
    const valorConDescuento = valorLista * (1 - descuentoUnidad);
    const comisionBroker = valorConDescuento * (commissionRate / 100);
    const montoDescuento = valorLista * descuentoUnidad;
    const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista);
    const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 1000) / 10;
    const bonoPieCalculadoUF = valorLista * (porcentajeRedondeado / 100);
    const bonoPieCalculadoPct = porcentajeRedondeado;
    // Restricción de política comercial
    const policy = projectPolicies[unidad.proyecto_nombre];
    const bonoPieMaximoPct = policy?.bono_pie_max_pct || 0;
    const bonoPieMaximoUF = totalEscritura * (bonoPieMaximoPct / 100);
    // Aplicar restricción
    const bonoPieAplicableUF = Math.min(bonoPieCalculadoUF, bonoPieMaximoUF);
    const bonoPieAplicablePct = totalEscritura > 0 ? (bonoPieAplicableUF / totalEscritura) * 100 : 0;
    const descuentoAplicableUF = bonoPieCalculadoUF - bonoPieAplicableUF;
    const descuentoAplicablePct = valorLista > 0 ? (descuentoAplicableUF / valorLista) * 100 : 0;
    return {
      bonoPieAplicableUF,
      bonoPieAplicablePct,
      descuentoAplicableUF,
      descuentoAplicablePct,
      bonoPieMaximoUF,
      bonoPieMaximoPct,
      bonoPieCalculadoUF,
      bonoPieCalculadoPct,
    };
  };

  // Usar la función en el flujo de bono pie
  const bonoPieYDescuento = calculateBonoPieYDescuento(selectedUnidad, totalEscrituraFinal, projectPolicies);

  // useEffect para totalEscritura_2dec
  useEffect(() => {
    setTotalEscritura_2dec(Number(totalEscrituraFinal.toFixed(2)));
  }, [totalEscrituraFinal]);
  
  // Función auxiliar para redondear a 2 decimales
  const round2 = (x: number) => Math.round(x * 100) / 100;

  // 2. Función centralizada de cálculo y redondeo
  function calcularFormaPagoPrecisamente({
    valorListaUF,
    secundariosUF,
    bonoPieAplicableRaw, // El bono real, NO recalculado aquí
    policy,
    ufValue,
    promesaRaw,
    pieRaw,
    creditoRaw
  }: {
    valorListaUF: number,
    secundariosUF: number,
    bonoPieAplicableRaw: number,
    policy: any,
    ufValue: number,
    promesaRaw: number | null,
    pieRaw: number | null,
    creditoRaw: number | null
  }) {
    // 1. Total escrituración bruto
    const totalEscrituraRaw = valorListaUF + secundariosUF;

    // 2. Reserva
    let reservaRaw = 0;
    if (policy && policy.monto_reserva_pesos > 0 && ufValue > 0) {
      reservaRaw = policy.monto_reserva_pesos / ufValue;
    }

    // 3. Remanente para distribuir (ya restado reserva y bono)
    const remanente = totalEscrituraRaw - reservaRaw;

    // 4. Promesa, Pie, Crédito: si el usuario editó, usa el raw, si no, reparte 10/10/80 del remanente
    let promesaBruto = (promesaRaw !== null) ? promesaRaw : (0.10 * remanente);
    let pieBruto     = (pieRaw     !== null) ? pieRaw     : (0.10 * remanente);
    let creditoBruto = (creditoRaw !== null) ? creditoRaw : (remanente - promesaBruto - pieBruto);

    // 5. Redondeo en bloque
    const totalDisplay   = round2(totalEscrituraRaw);
    const reservaDisplay = round2(reservaRaw);
    const promesaDisplay = round2(promesaBruto);
    const pieDisplay     = round2(pieBruto);
    const bonoDisplay    = round2(bonoPieAplicableRaw);

    // 6. El residual lo absorbe el crédito
    const sumaCuatro = reservaDisplay + promesaDisplay + pieDisplay + bonoDisplay;
    const creditoDisplay = round2(totalDisplay - sumaCuatro);

    return {
      totalDisplay,
      reservaDisplay,
      promesaDisplay,
      pieDisplay,
      bonoDisplay,
      creditoDisplay
    };
  }

  // 4. Handlers de inputs editables
  const handlePromesaUFChange = (val: number) => {
    setPromesaRaw(val);
  };
  const handlePieUFChange = (val: number) => {
    setPieRaw(val);
  };
  const handleCreditoUFChange = (val: number) => {
    setCreditoRaw(val);
  };
  
  // Seleccionar unidad
  const handleSelectUnidad = async (unidad: Unidad) => {
    setSelectedUnidad({ ...unidad, commission_rate: getCommissionRate(unidad.proyecto_nombre) });
    setAddedSecondaryUnits([]);
    setPagoPromesaPct(10);
    setPagoPiePct(10);
    // Si hay política comercial para este proyecto, aplicar monto de reserva
    let realEstateAgencyId = null;
    if (unidad.proyecto_nombre && projectPolicies[unidad.proyecto_nombre]) {
      const policy = projectPolicies[unidad.proyecto_nombre];
      if (ufValue && policy.monto_reserva_pesos > 0) {
        const reservaUF = policy.monto_reserva_pesos / ufValue;
        setPagoReserva(Number(reservaUF.toFixed(2)));
      }
      setMontoReservaPesos(policy.monto_reserva_pesos);
      realEstateAgencyId = policy.real_estate_agency_id;
    } else {
      setPagoReserva(Number((10).toFixed(2)));
      setMontoReservaPesos(null);
    }
    // Obtener datos de la inmobiliaria desde la política comercial
    if (realEstateAgencyId) {
      const { data: agencyData, error: agencyError } = await supabase
        .from('real_estate_agencies')
        .select('business_name, rut, bank, account_type, account_number')
        .eq('id', realEstateAgencyId)
        .maybeSingle();
      setRealEstateAgency(agencyData || null);
    } else {
      setRealEstateAgency(null);
    }
    // ACTUALIZACIÓN: setear discountAmount automáticamente según la unidad seleccionada
    setDiscountAmount(unidad.descuento ? unidad.descuento * 100 : 0);
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
        quotation_type: tipoCotizacionWizard,
        discount_amount: discountAmount,
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
        total_deed_price: totalEscrituraFinal,
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
  
  // Función para ordenar
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Tipologías y orientaciones disponibles para el proyecto seleccionado (en cascada)
  const tipologiasProyecto = Array.from(new Set(filteredUnidades
    .filter(u => u.proyecto_nombre === selectedProyecto && u.tipo_bien === 'DEPARTAMENTO')
    .filter(u => tablaOrientacionFilter ? u.orientacion === tablaOrientacionFilter : true)
    .map(u => u.tipologia)
    .filter(Boolean)
  )).sort();
  const orientacionesProyecto = Array.from(new Set(filteredUnidades
    .filter(u => u.proyecto_nombre === selectedProyecto && u.tipo_bien === 'DEPARTAMENTO')
    .filter(u => tablaTipologiaFilter ? u.tipologia === tablaTipologiaFilter : true)
    .map(u => u.orientacion)
    .filter(Boolean)
  )).sort();

  // Unidades ordenadas y filtradas por los nuevos filtros
  const unidadesOrdenadas = filteredUnidades
    .filter(u => u.proyecto_nombre === selectedProyecto && u.tipo_bien === 'DEPARTAMENTO')
    .filter(u => (tablaTipologiaFilter ? u.tipologia === tablaTipologiaFilter : true))
    .filter(u => (tablaOrientacionFilter ? u.orientacion === tablaOrientacionFilter : true))
    .sort((a, b) => {
      if (sortColumn === 'bonoPiePct') {
        // Calcular porcentaje bono pie para cada unidad
        const getBonoPiePct = (unidad: Unidad) => {
          const valorLista = unidad.valor_lista || 0;
          const descuentoUnidad = unidad.descuento || 0;
          const commissionRate = getCommissionRate(unidad.proyecto_nombre);
          const valorConDescuento = valorLista * (1 - descuentoUnidad);
          const comisionBroker = valorConDescuento * (commissionRate / 100);
          const montoDescuento = valorLista * descuentoUnidad;
          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista);
          return Math.floor(descuentoDisponibleBroker * 1000) / 10;
        };
        const aVal = getBonoPiePct(a);
        const bVal = getBonoPiePct(b);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (sortColumn === 'bonoPieUF') {
        const getBonoPieUF = (unidad: Unidad) => {
          const valorLista = unidad.valor_lista || 0;
          const descuentoUnidad = unidad.descuento || 0;
          const commissionRate = getCommissionRate(unidad.proyecto_nombre);
          const valorConDescuento = valorLista * (1 - descuentoUnidad);
          const comisionBroker = valorConDescuento * (commissionRate / 100);
          const montoDescuento = valorLista * descuentoUnidad;
          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista);
          const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 1000) / 10;
          return valorLista * (porcentajeRedondeado / 100);
        };
        const aVal = getBonoPieUF(a);
        const bVal = getBonoPieUF(b);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (sortColumn === 'descuentoDisponibleBroker') {
        const getDescuentoDisponibleBroker = (unidad: Unidad) => {
          const valorLista = unidad.valor_lista || 0;
          const descuentoUnidad = unidad.descuento || 0;
          const commissionRate = getCommissionRate(unidad.proyecto_nombre);
          const valorConDescuento = valorLista * (1 - descuentoUnidad);
          const comisionBroker = valorConDescuento * (commissionRate / 100);
          const montoDescuento = valorLista * descuentoUnidad;
          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
          return Math.floor(descuentoDisponibleBroker * 10) / 10;
        };
        const aVal = getDescuentoDisponibleBroker(a);
        const bVal = getDescuentoDisponibleBroker(b);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (sortColumn === 'valorConDescuentoUF') {
        const getValorConDescuentoUF = (unidad: Unidad) => {
          const valorLista = unidad.valor_lista || 0;
          const descuentoUnidad = unidad.descuento || 0;
          const commissionRate = getCommissionRate(unidad.proyecto_nombre);
          const valorConDescuento = valorLista * (1 - descuentoUnidad);
          const comisionBroker = valorConDescuento * (commissionRate / 100);
          const montoDescuento = valorLista * descuentoUnidad;
          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
          const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
          return valorLista - (valorLista * (porcentajeRedondeado / 100));
        };
        const aVal = getValorConDescuentoUF(a);
        const bVal = getValorConDescuentoUF(b);
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      let aValue = a[sortColumn as keyof Unidad];
      let bValue = b[sortColumn as keyof Unidad];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      return 0;
    });
  
  // Calcular diferencia de ajuste
  const ajusteDiferencia = totalFormaDePago - totalEscrituraFinal;
  
  // Agregar efecto para limpiar la unidad seleccionada al cambiar de proyecto
  useEffect(() => {
    setSelectedUnidad(null);
  }, [selectedProyecto]);
  
  // Handlers de cambio de porcentaje para Promesa, Pie y Crédito
  const handlePromesaPctChange = (val: number) => {
    if (!totalEscrituraFinal || totalEscrituraFinal <= 0) return;
    setPromesaRaw((val / 100) * totalEscrituraFinal);
  };
  const handlePiePctChange = (val: number) => {
    if (!totalEscrituraFinal || totalEscrituraFinal <= 0) return;
    setPieRaw((val / 100) * totalEscrituraFinal);
  };
  const handleCreditoPctChange = (val: number) => {
    if (!totalEscrituraFinal || totalEscrituraFinal <= 0) return;
    setCreditoRaw((val / 100) * totalEscrituraFinal);
  };

  // Funciones de ajuste para cuadrar la suma
  const ajustarPromesa = () => {
    // Promesa necesaria para cuadrar el total
    const promesaNecesaria = totalEscrituraFinal - (pagoReserva + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion);
    setPromesaRaw(promesaNecesaria);
  };
  const ajustarPie = () => {
    const pieNecesario = totalEscrituraFinal - (pagoReserva + pagoPromesa + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion);
    setPieRaw(pieNecesario);
  };
  const ajustarCredito = () => {
    const creditoNecesario = totalEscrituraFinal - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion);
    setCreditoRaw(creditoNecesario);
  };
  
  // useEffect centralizado corregido: primero restamos descuento (o bono), luego repartimos
  useEffect(() => {
    if (!selectedUnidad) return;

    // 1) Valor lista del depto en UF
    const valorListaUF = selectedUnidad.valor_lista || 0;

    // 2) Suma de unidades secundarias (en UF)
    const secundariosUF = precioTotalSecundarios;

    // 3) Calcular "precio neto depto" según el tipo de cotización
    let precioNetoDeptoUF = 0;
    if (tipoCotizacionWizard === 'bono') {
      const { descuentoAplicableUF } = calculateBonoPieYDescuento(
        selectedUnidad,
        valorListaUF + secundariosUF,
        projectPolicies
      );
      precioNetoDeptoUF = valorListaUF - descuentoAplicableUF;
    } else {
      // Cálculo de descuento real para el broker
      const descuentoUnidad = selectedUnidad.descuento || 0;
      const commissionRate = getCommissionRate(selectedUnidad.proyecto_nombre);
      const valorConDescuento = valorListaUF * (1 - descuentoUnidad);
      const comisionBroker = valorConDescuento * (commissionRate / 100);
      const montoDescuento = valorListaUF * descuentoUnidad;
      const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorListaUF) * 100;
      const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
      const descuentoUF = valorListaUF * (porcentajeRedondeado / 100);
      precioNetoDeptoUF = valorListaUF - descuentoUF;
    }

    // 4) total base sobre el que se calcula bono (en flujo "bono")
    const totalBaseUF = precioNetoDeptoUF + secundariosUF;

    // 5) Recalculo bonoPieAplicableUF (si es flujo "bono")
    const { bonoPieAplicableUF } = calculateBonoPieYDescuento(
      selectedUnidad,
      totalBaseUF,
      projectPolicies
    );

    // 6) Recupero la política para la Reserva
    const policy = projectPolicies[selectedUnidad.proyecto_nombre] || {};

    // 7) Llamo a la función que reparte y redondea en bloque
    const resultados = calcularFormaPagoPrecisamente({
      valorListaUF: precioNetoDeptoUF,
      secundariosUF,
      bonoPieAplicableRaw: bonoPieAplicableUF,
      policy,
      ufValue: ufValue || 0,
      promesaRaw,
      pieRaw,
      creditoRaw
    });

    // 8) Actualizo TODOS los estados con valores coherentes con la misma base "totalDisplay":
    setPagoReserva(resultados.reservaDisplay);
    setPagoPromesa(resultados.promesaDisplay);
    setPagoPie(resultados.pieDisplay);
    setPagoBonoPieCotizacion(resultados.bonoDisplay);
    setPagoCreditoHipotecarioCalculado(resultados.creditoDisplay);

    // 9) Este "totalDisplay" es el número MAESTRO que alimenta:
    setTotalEscrituraFinal(resultados.totalDisplay);
    setTotalFormaDePago(resultados.totalDisplay);

    // 10) Recalculo los porcentajes de cada línea (para mostrarlos en los inputs)
    if (resultados.totalDisplay > 0) {
      setPagoPromesaPct((resultados.promesaDisplay / resultados.totalDisplay) * 100);
      setPagoPiePct((resultados.pieDisplay / resultados.totalDisplay) * 100);
      setPagoCreditoHipotecarioPct((resultados.creditoDisplay / resultados.totalDisplay) * 100);
    } else {
      setPagoPromesaPct(0);
      setPagoPiePct(0);
      setPagoCreditoHipotecarioPct(0);
    }

  }, [
    selectedUnidad,
    precioTotalSecundarios,
    projectPolicies,
    ufValue,
    promesaRaw,
    pieRaw,
    creditoRaw,
    discountAmount,
    tipoCotizacionWizard,
    bonoPieYDescuento.descuentoAplicableUF
  ]);
  
  // Actualizar bonoAmount cuando cambia el tipo de cotización
  useEffect(() => {
    if (tipoCotizacionWizard === 'bono') {
      setBonoAmount(bonoPieYDescuento.bonoPieAplicableUF);
    } else {
      setBonoAmount(0);
    }
  }, [tipoCotizacionWizard, bonoPieYDescuento.bonoPieAplicableUF]);
  
  // Estado para mostrar el modal de stock completo
  const [showStockModal, setShowStockModal] = useState(false);
  
  // Estados para filtros del modal de stock completo
  const [stockTab, setStockTab] = useState<'departamentos' | 'secundarios'>('departamentos');
  const [stockSearch, setStockSearch] = useState('');
  const [stockProyecto, setStockProyecto] = useState('');
  const [stockTipologia, setStockTipologia] = useState('');
  const [stockTipoBien, setStockTipoBien] = useState('');

  // Datos filtrados para departamentos
  const departamentos = unidades.filter(u => u.tipo_bien === 'DEPARTAMENTO');
  const departamentosFiltrados = departamentos.filter(u => {
    // Descuento calculado al broker
    const valorLista = u.valor_lista || 0;
    const descuentoUnidad = u.descuento || 0;
    const commissionRate = getCommissionRate(u.proyecto_nombre);
    const valorConDescuento = valorLista * (1 - descuentoUnidad);
    const comisionBroker = valorConDescuento * (commissionRate / 100);
    const montoDescuento = valorLista * descuentoUnidad;
    const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
    const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
    // Filtros
    if (porcentajeRedondeado < 0) return false;
    if (stockProyecto && u.proyecto_nombre !== stockProyecto) return false;
    if (stockTipologia && u.tipologia !== stockTipologia) return false;
    if (stockSearch) {
      const s = stockSearch.toLowerCase();
      if (!(
        (u.proyecto_nombre || '').toLowerCase().includes(s) ||
        (u.unidad || '').toLowerCase().includes(s) ||
        (u.tipologia || '').toLowerCase().includes(s) ||
        (u.piso || '').toString().includes(s) ||
        (u.orientacion || '').toLowerCase().includes(s) ||
        (u.sup_total || '').toString().includes(s)
      )) return false;
    }
    return true;
  });
  const proyectosDeptos = Array.from(new Set(departamentos.map(u => u.proyecto_nombre).filter(Boolean)));
  const tipologiasDeptos = Array.from(new Set(departamentos.map(u => u.tipologia).filter(Boolean)));

  // Datos filtrados para secundarios
  const secundarios = unidades.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
  const secundariosFiltrados = secundarios.filter(u => {
    if (stockProyecto && u.proyecto_nombre !== stockProyecto) return false;
    if (stockTipoBien && u.tipo_bien !== stockTipoBien) return false;
    if (stockSearch) {
      const s = stockSearch.toLowerCase();
      if (!(
        (u.proyecto_nombre || '').toLowerCase().includes(s) ||
        (u.unidad || '').toLowerCase().includes(s) ||
        (u.tipo_bien || '').toLowerCase().includes(s) ||
        (u.piso || '').toString().includes(s) ||
        (u.orientacion || '').toLowerCase().includes(s) ||
        (u.sup_total || '').toString().includes(s)
      )) return false;
    }
    return true;
  });
  const proyectosSecundarios = Array.from(new Set(secundarios.map(u => u.proyecto_nombre).filter(Boolean)));
  const tiposBienSecundarios = Array.from(new Set(secundarios.map(u => u.tipo_bien).filter(Boolean)));

  // Exportar a Excel
  const exportarStockExcel = async () => {
    // Departamentos
    const deptosData = departamentosFiltrados.map(u => {
      const valorLista = u.valor_lista || 0;
      const descuentoUnidad = u.descuento || 0;
      const commissionRate = getCommissionRate(u.proyecto_nombre);
      const valorConDescuento = valorLista * (1 - descuentoUnidad);
      const comisionBroker = valorConDescuento * (commissionRate / 100);
      const montoDescuento = valorLista * descuentoUnidad;
      const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
      const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
      const descuentoUF = valorLista * (porcentajeRedondeado / 100);
      const valorConDescuentoBroker = valorLista - descuentoUF;
      return {
        Proyecto: u.proyecto_nombre,
        Unidad: u.unidad,
        Tipología: u.tipologia,
        Piso: u.piso,
        Orientación: u.orientacion,
        'Sup. total': u.sup_total,
        'Valor lista (UF)': valorLista,
        'Descuento (%)': porcentajeRedondeado,
        'Descuento (UF)': descuentoUF,
        'Valor con Descuento (UF)': valorConDescuentoBroker,
      };
    });

    // Secundarios
    const secundariosData = secundariosFiltrados.map(u => ({
      Proyecto: u.proyecto_nombre,
      Unidad: u.unidad,
      'Tipo de bien': u.tipo_bien,
      Piso: u.piso,
      Orientación: u.orientacion,
      'Sup. total': u.sup_total,
      'Valor lista (UF)': u.valor_lista || 0,
    }));

    // Obtener políticas comerciales
    const { data: policiesData, error: policiesError } = await supabase
      .from('project_commercial_policies')
      .select('*');

    if (policiesError) {
      console.error('Error al obtener políticas comerciales:', policiesError);
      return;
    }

    // Datos de políticas comerciales
    const politicasData = policiesData.map(p => {
      const fechaTope = p.fecha_tope ? new Date(p.fecha_tope) : null;
      const hoy = new Date();
      const cuotas = fechaTope ? Math.max(1, Math.ceil((fechaTope.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;

      const row = {
        PROYECTO: p.project_name,
        'MONTO RESERVA': p.monto_reserva_pesos || 0,
        CUOTAS: cuotas,
        COMUNA: p.comuna || '',
        OBSERVACIONES: p.observaciones || ''
      };

      return row;
    });

    // Crear libro
    const wb = XLSX.utils.book_new();
    const wsDeptos = XLSX.utils.json_to_sheet(deptosData);
    XLSX.utils.book_append_sheet(wb, wsDeptos, 'Departamentos');
    const wsSecundarios = XLSX.utils.json_to_sheet(secundariosData);
    XLSX.utils.book_append_sheet(wb, wsSecundarios, 'Secundarios');
    const wsPoliticas = XLSX.utils.json_to_sheet(politicasData);
    XLSX.utils.book_append_sheet(wb, wsPoliticas, 'Política Comercial');
    XLSX.writeFile(wb, 'stock_completo.xlsx');
  };
  
  // Estados para el modal de gestión documental
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentos, setDocumentos] = useState({
    pre_aprobacion: false,
    cedula_identidad: false,
    certificado_afp: false,
    liquidaciones_sueldo: false,
    dicom_cmf: false,
    pep: false,
    dof: false,
    formulario_onu: false
  });

  // Función para guardar los estados de los documentos
  const guardarEstadosDocumentos = async () => {
    try {
      if (!selectedUnidad || !broker) return;

      const { error } = await supabase
        .from('reservations')
        .upsert({
          broker_id: broker.id,
          unidad_id: selectedUnidad.id,
          pre_aprobacion_estado: documentos.pre_aprobacion,
          cedula_identidad_estado: documentos.cedula_identidad,
          certificado_afp_estado: documentos.certificado_afp,
          liquidaciones_sueldo_estado: documentos.liquidaciones_sueldo,
          dicom_cmf_estado: documentos.dicom_cmf,
          pep_estado: documentos.pep,
          dof_estado: documentos.dof,
          formulario_onu_estado: documentos.formulario_onu,
          documentos_actualizados_at: new Date().toISOString()
        });

      if (error) throw error;

      // Mostrar mensaje de éxito
      alert('Estados de documentos guardados exitosamente');
      setShowDocumentModal(false);
    } catch (err: any) {
      console.error('Error guardando estados de documentos:', err);
      alert('Error al guardar los estados de los documentos');
    }
  };
  
  // 1. Guardar la lista de proyectos habilitados en un estado global
  const [proyectosHabilitadosPolitica, setProyectosHabilitadosPolitica] = useState<string[]>([]);

  // Asegurarse de que fetchUnidades se ejecute después de fetchProjectPolicies
  useEffect(() => {
    if (proyectosHabilitadosPolitica.length > 0) {
      fetchUnidades();
    }
    // eslint-disable-next-line
  }, [proyectosHabilitadosPolitica]);
  
  // 2. Nueva función para guardar la cotización y obtener el número
  const guardarCotizacionYObtenerNumero = async () => {
    if (!selectedUnidad || !broker) return null;
    setSavingQuote(true);
    setSaveQuoteError(null);
    try {
      // Construye el objeto según los campos de la tabla 'quotes'
      const quoteData = {
        broker_nombre: broker.name,
        broker_slug: broker.slug,
        broker_token: broker.public_access_token,
        cliente_nombre: clientName,
        cliente_rut: clientRut,
        proyecto: selectedUnidad.proyecto_nombre,
        unidad: selectedUnidad.unidad,
        tipologia: selectedUnidad.tipologia,
        monto_total: precioBaseDepartamento,
        descuentos: precioDescuentoDepartamento,
        precio_venta: precioDepartamentoConDescuento,
        total_escritura: totalEscrituraFinal,
        reserva: pagoReserva,
        promesa: pagoPromesa,
        pie: pagoPie,
        credito_hipotecario: pagoCreditoHipotecarioCalculado,
        bono_pie: bonoPieYDescuento.bonoPieAplicableUF,
        total: totalFormaDePago,
        detalle_json: {
          ufValue,
          addedSecondaryUnits,
          quotationType: tipoCotizacionWizard || 'descuento',
          discountAmount,
          bonoAmount,
          pagoPromesaPct,
          pagoPiePct,
          pagoBonoPieCotizacion: bonoPieYDescuento.bonoPieAplicableUF,
          precioTotalSecundarios,
          pagoCreditoHipotecarioCalculado,
          realEstateAgency,
          montoReservaPesos,
        }
      };
      const { data, error } = await supabase
        .from('quotes')
        .insert([quoteData])
        .select('numero_cotizacion')
        .single();
      if (error) throw error;
      setNumeroCotizacion(data.numero_cotizacion);
      return data.numero_cotizacion;
    } catch (err: any) {
      setSaveQuoteError('No se pudo guardar la cotización. Intenta nuevamente.');
      return null;
    } finally {
      setSavingQuote(false);
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
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setWizardStep(1)}
              className="hover:opacity-80 transition-opacity"
            >
              <img src={logoinversiones} alt="Logo" className="h-12 w-auto" />
            </button>
          <div>
              <h1 className="text-2xl font-bold text-gray-800">Cotizador <span className="text-blue-700">({broker.name})</span></h1>
            <p className="text-sm text-gray-500">{broker.business_name}</p>
          </div>
          </div>
          <div className="flex items-center gap-4">
            {wizardStep === 1 && (
              <>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md font-semibold hover:bg-blue-200 transition-colors border border-blue-200"
                  onClick={() => setShowStockModal(true)}
                >
                  <Building className="h-5 w-5" />
                  Ver el stock completo
                </button>
                <a
                  href="https://ecasa365-my.sharepoint.com/:f:/g/personal/claudio_soto_ecasa_cl/Eta7KfuDM_VBpSd2uYMwVP8BiQNlLdPm9TfUcBjO3RScEQ?e=DbOfDK"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md font-semibold hover:bg-green-200 transition-colors border border-green-200 ml-2"
                >
                  <Folder className="h-5 w-5" />
                  Carpetas Proyectos
                </a>
              </>
            )}
            {wizardStep > 1 && (
              <>
                <button
                  onClick={() => setWizardStep(1)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <HomeIcon className="h-5 w-5" />
                  <span>Inicio</span>
                </button>
                {wizardStep === 3 && (
                  <button
                    onClick={() => setWizardStep(1)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Cambiar Proyecto</span>
                  </button>
                )}
              </>
            )}
          {ufValue && (
              <div className="bg-blue-50 px-4 py-2 rounded-lg text-right">
              <p className="text-sm text-gray-600">Valor UF:</p>
                <p className="text-lg font-semibold text-blue-700">{ufValue.toFixed(2)}</p>
                {fechaUF && (
                  <p className="text-xs text-gray-500 mt-1">Actualizado: {new Date(fechaUF).toLocaleDateString('es-CL')}</p>
                )}
            </div>
          )}
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Wizard Paso 1: Bienvenida y selección de proyecto */}
        {wizardStep === 1 && (
          <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-3xl font-extrabold text-blue-700 mb-1 uppercase tracking-wide">BIENVENID@ AL COTIZADOR DE ECASA</h2>
            <p className="text-2xl font-bold text-blue-600 mb-6 tracking-wide">Canal Inversiones</p>
            {/* Aquí puedes agregar promociones del mes en el futuro */}
            <p className="text-lg text-gray-700 mt-2 mb-6">¿Qué Proyecto deseas cotizar hoy?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {proyectosDisponibles.map(proyecto => {
                const policy = projectPolicies[proyecto];
                const isInmediata = policy?.fecha_tope ? new Date(policy.fecha_tope) <= new Date() : false;
                
                return (
                  <button
                    key={proyecto}
                    className={`px-4 py-3 rounded-lg border font-semibold transition-colors w-full ${selectedProyecto === proyecto ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50'}`}
                    onClick={() => { setSelectedProyecto(proyecto); setWizardStep(2); }}
                  >
                    <div className="flex flex-col items-center">
                      <span>{proyecto}</span>
                      {policy?.comuna && (
                        <span className="text-xs mt-1 text-gray-500">
                          {policy.comuna}
                        </span>
                      )}
                      {policy?.fecha_tope && (
                        <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${isInmediata ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {isInmediata ? 'INMEDIATA' : 'FUTURO'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Wizard Paso 2: Selección de tipo de cotización */}
        {wizardStep === 2 && (
          <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Proyecto seleccionado:</h2>
            <p className="text-lg font-bold text-blue-700 mb-6">{selectedProyecto}</p>
            <p className="text-gray-700 mb-6">¿Deseas cotizar con descuento o bono pie?</p>
            <div className="flex justify-center gap-6 mb-6">
              <button
                className={`px-6 py-3 rounded-lg font-semibold border transition-colors ${tipoCotizacionWizard === 'descuento' ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50'}`}
                onClick={() => { setTipoCotizacionWizard('descuento'); setWizardStep(3); setProyectoFilter(selectedProyecto); }}
              >
                Descuento
              </button>
              <button
                className={`px-6 py-3 rounded-lg font-semibold border transition-colors ${tipoCotizacionWizard === 'bono' ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50'}`}
                onClick={() => { setTipoCotizacionWizard('bono'); setWizardStep(3); setProyectoFilter(selectedProyecto); }}
              >
                Bono Pie
              </button>
            </div>
            <button className="text-sm text-blue-600 underline mb-6" onClick={() => setWizardStep(1)}>Cambiar proyecto</button>
            {/* Mostrar política comercial si existe */}
            {selectedProyecto && projectPolicies[selectedProyecto]?.observaciones && (
              <div className="mb-6 p-4 bg-blue-50 rounded text-gray-700 text-sm text-left border border-blue-100">
                <span className="font-semibold text-blue-700">Política Comercial:</span><br />
                {projectPolicies[selectedProyecto].observaciones}
              </div>
            )}
          </div>
        )}
        {/* Wizard Paso 3: Flujo actual */}
        {wizardStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tarjeta con el nombre del proyecto */}
            <div className="lg:col-span-3 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <h2 className="text-2xl font-bold text-blue-700">{selectedProyecto}</h2>
              </div>
            </div>
            {/* Mostrar la tarjeta de unidades solo si no hay unidad seleccionada */}
            {!selectedUnidad && (
              <div className="lg:col-span-3 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Unidades Disponibles</h3>
                  {/* Filtros de tipología y orientación */}
                  <div className="flex flex-wrap gap-4 mb-6 items-end justify-between">
                    <div className="flex gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipología</label>
                        <select
                          value={tablaTipologiaFilter}
                          onChange={e => setTablaTipologiaFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Todas</option>
                          {tipologiasProyecto.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Orientación</label>
                        <select
                          value={tablaOrientacionFilter}
                          onChange={e => setTablaOrientacionFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Todas</option>
                          {orientacionesProyecto.map(o => (
                            <option key={o as string} value={o as string}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 transition-colors"
                      onClick={() => { setTablaTipologiaFilter(''); setTablaOrientacionFilter(''); }}
                    >
                      Borrar filtros
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('proyecto_nombre')}>
                            Proyecto
                            {sortColumn === 'proyecto_nombre' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('unidad')}>
                            Unidad
                            {sortColumn === 'unidad' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('tipologia')}>
                            Tipología
                            {sortColumn === 'tipologia' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('sup_total')}>
                            Sup. Total (m²)
                            {sortColumn === 'sup_total' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('piso')}>
                            Piso
                            {sortColumn === 'piso' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('orientacion')}>
                            Orientación
                            {sortColumn === 'orientacion' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('valor_lista')}>
                            Valor Lista (UF)
                            {sortColumn === 'valor_lista' && (
                              sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                            )}
                          </th>
                          {tipoCotizacionWizard === 'descuento' && (
                            <>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('descuentoDisponibleBroker')}>
                                Descuento
                                {sortColumn === 'descuentoDisponibleBroker' && (
                                  sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                                )}
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('valorConDescuentoUF')}>
                                Valor con Descuento (UF)
                                {sortColumn === 'valorConDescuentoUF' && (
                                  sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                                )}
                              </th>
                            </>
                          )}
                          {tipoCotizacionWizard === 'bono' && (
                            <>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('bonoPiePct')}>
                                BONO PIE DESDE (%)
                                {sortColumn === 'bonoPiePct' && (
                                  sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                                )}
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('bonoPieUF')}>
                                BONO PIE (UF)
                                {sortColumn === 'bonoPieUF' && (
                                  sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
                                )}
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {unidadesOrdenadas.filter(unidad => {
                          let mostrar = true;
                          if (tipoCotizacionWizard === 'descuento') {
                            // Calcula el descuentoDisponibleBroker como en el render
                            const valorLista = unidad.valor_lista || 0;
                            const descuentoUnidad = unidad.descuento || 0;
                            const commissionRate = getCommissionRate(unidad.proyecto_nombre) / 100;
                            const valorConDescuentoBase = valorLista * (1 - descuentoUnidad);
                            const comisionBroker = valorConDescuentoBase * commissionRate;
                            const valorConDescuentoYComision = valorConDescuentoBase + comisionBroker;
                            const descuentoDisponibleBroker = ((valorLista - valorConDescuentoYComision) / valorLista) * 100;
                            mostrar = descuentoDisponibleBroker > 0;
                          } else if (tipoCotizacionWizard === 'bono') {
                            // Calcula el bonoPiePctLocal como en el render
                            const valorLista = unidad.valor_lista || 0;
                            const descuentoUnidad = unidad.descuento || 0;
                            const commissionRate = getCommissionRate(unidad.proyecto_nombre) / 100;
                            const valorConDescuentoBase = valorLista * (1 - descuentoUnidad);
                            const comisionBroker = valorConDescuentoBase * commissionRate;
                            const valorConDescuentoYComision = valorConDescuentoBase + comisionBroker;
                            const descuentoDisponibleBroker = ((valorLista - valorConDescuentoYComision) / valorLista) * 100;
                            const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
                            mostrar = porcentajeRedondeado > 0;
                          }
                          return mostrar;
                        }).map(unidad => {
                          let descuento = 0;
                          let valorConDescuento = 0;
                          let descuentoDisponibleBroker = 0;
                          let porcentajeRedondeado = 0;
                          let bonoPieUFLocal = 0;
                          let bonoPiePctLocal = 0;
                          if (tipoCotizacionWizard === 'descuento' || tipoCotizacionWizard === 'bono') {
                            // Valores de las tablas
                            const valorLista = unidad.valor_lista || 0; // de stock_unidades
                            const descuentoUnidad = unidad.descuento || 0; // de stock_unidades
                            const commissionRate = getCommissionRate(unidad.proyecto_nombre) / 100; // de broker_project_commissions convertido a decimal

                            // Fórmula exacta: (valor_lista-(((valor_lista*(1-descuento))*commission_rate)+(valor_lista*(1-descuento))))/valor_lista
                            const valorConDescuentoBase = valorLista * (1 - descuentoUnidad);
                            const comisionBroker = valorConDescuentoBase * commissionRate;
                            const valorConDescuentoYComision = valorConDescuentoBase + comisionBroker;
                            descuentoDisponibleBroker = ((valorLista - valorConDescuentoYComision) / valorLista) * 100;
                            porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
                            bonoPieUFLocal = valorLista * (porcentajeRedondeado / 100);
                            bonoPiePctLocal = porcentajeRedondeado;
                            descuento = porcentajeRedondeado;
                            valorConDescuento = valorLista - (valorLista * (porcentajeRedondeado / 100));
                          }
                          return (
                            <tr key={unidad.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => handleSelectUnidad(unidad)}>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.proyecto_nombre}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.unidad}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.tipologia}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.sup_total}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.piso}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{unidad.orientacion || '-'}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(unidad.valor_lista || 0)}</td>
                              {tipoCotizacionWizard === 'descuento' && (
                                <>
                                  <td className="px-4 py-2 whitespace-nowrap">{descuentoDisponibleBroker.toFixed(1)}%</td>
                                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(valorConDescuento)} UF</td>
                                </>
                              )}
                              {tipoCotizacionWizard === 'bono' && (
                                <>
                                  <td className="px-4 py-2 whitespace-nowrap">{bonoPiePctLocal}%</td>
                                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(bonoPieUFLocal)} UF</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {unidadesOrdenadas.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No hay unidades disponibles para este proyecto</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Columna izquierda - Solo Datos del Cliente y Unidades Secundarias */}
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
            {/* Unidades secundarias */}
            {selectedUnidad && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Home className="h-5 w-5 mr-2 text-blue-600" />
                  Unidades Secundarias
              </h2>
                {/* Filtro por tipo_bien */}
                {(() => {
                  const tiposBien = Array.from(new Set(filteredUnidades
                    .filter(u =>
                      u.tipo_bien !== 'DEPARTAMENTO' &&
                      u.proyecto_nombre === selectedUnidad.proyecto_nombre
                    )
                    .map(u => u.tipo_bien)
                    .filter(Boolean)
                  ));
                  return tiposBien.length > 1 ? (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por tipo de bien</label>
                  <select
                        value={tipoBienSecundario}
                        onChange={e => setTipoBienSecundario(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                        <option value="">Todos</option>
                        {tiposBien.map(tipo => (
                          <option key={tipo as string} value={tipo as string}>{tipo}</option>
                    ))}
                  </select>
                </div>
                  ) : null;
                })()}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {filteredUnidades
                    .filter(u => 
                      u.tipo_bien !== 'DEPARTAMENTO' && 
                      u.proyecto_nombre === selectedUnidad.proyecto_nombre &&
                      (tipoBienSecundario ? u.tipo_bien === tipoBienSecundario : true)
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
                    u.proyecto_nombre === selectedUnidad.proyecto_nombre &&
                    (tipoBienSecundario ? u.tipo_bien === tipoBienSecundario : true)
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center justify-center">
                    <Building className="h-6 w-6 mr-2 text-blue-600" />
                    {selectedUnidad.proyecto_nombre} - {selectedUnidad.unidad}
                  </h2>
                    <button
                      className="ml-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md font-semibold hover:bg-blue-200 transition-colors border border-blue-200"
                      onClick={() => setSelectedUnidad(null)}
                    >
                      Seleccionar otra unidad
                    </button>
                  </div>
                  {/* Mostrar política comercial si existe */}
                  {selectedUnidad.proyecto_nombre && projectPolicies[selectedUnidad.proyecto_nombre]?.observaciones && (
                    <div className="mb-6 p-4 bg-blue-50 rounded text-gray-700 text-sm text-left border border-blue-100">
                      <span className="font-semibold text-blue-700">Política Comercial:</span><br />
                      {projectPolicies[selectedUnidad.proyecto_nombre].observaciones}
                    </div>
                  )}
                  
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
                  
                  {/* Eliminar Tipo de Cotización y dejar solo Descuento */}
                  {selectedUnidad && (
                  <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                        % Descuento Aplicado
                        </label>
                      <div className="flex items-center gap-2">
                        {tipoCotizacionWizard === 'descuento' && selectedUnidad && (() => {
                          const valorLista = selectedUnidad.valor_lista || 0;
                          const descuentoUnidad = selectedUnidad.descuento || 0;
                          const commissionRate = getCommissionRate(selectedUnidad.proyecto_nombre);
                          const valorConDescuento = valorLista * (1 - descuentoUnidad);
                          const comisionBroker = valorConDescuento * (commissionRate / 100);
                          const montoDescuento = valorLista * descuentoUnidad;
                          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
                          const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
                          return (
                            <input
                              type="text"
                              readOnly
                              value={`${porcentajeRedondeado}%`}
                              className="w-20 px-2 py-1 border border-gray-300 bg-gray-100 rounded-md text-right text-gray-700"
                            />
                          );
                        })()}
                      </div>
                      </div>
                    )}
                  
                  {/* Resumen de precios */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-2">Resumen de Precios</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Precio Lista Departamento:</span>
                        <span>{formatCurrency(selectedUnidad?.valor_lista ?? 0)} UF</span>
                      </div>
                      {tipoCotizacionWizard === 'descuento' && selectedUnidad && (
                        <>
                          {(() => {
                            const valorLista = selectedUnidad.valor_lista || 0;
                            const descuentoUnidad = selectedUnidad.descuento || 0;
                            const commissionRate = getCommissionRate(selectedUnidad.proyecto_nombre);
                            const valorConDescuento = valorLista * (1 - descuentoUnidad);
                            const comisionBroker = valorConDescuento * (commissionRate / 100);
                            const montoDescuento = valorLista * descuentoUnidad;
                            const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
                            const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
                            const descuentoUF = valorLista * (porcentajeRedondeado / 100);
                            const valorConDescuentoBroker = valorLista - descuentoUF;

                            return (
                              <>
                                <div className="flex justify-between text-red-600">
                                  <span>Descuento aplicado ({porcentajeRedondeado}%):</span>
                                  <span>-{formatCurrency(descuentoUF)} UF</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Precio Departamento con Descuento:</span>
                                  <span>{formatCurrency(valorConDescuentoBroker)} UF</span>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}
                      {tipoCotizacionWizard === 'bono' && (
                        <>
                          <div className="flex justify-between text-red-600">
                            <span>Descuento aplicado sobre depto:</span>
                            <span>-{formatCurrency(bonoPieYDescuento.descuentoAplicableUF)} UF</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Precio Departamento con Descuento:</span>
                            <span>{formatCurrency((selectedUnidad?.valor_lista ?? 0) - bonoPieYDescuento.descuentoAplicableUF)} UF</span>
                          </div>
                        </>
                      )}
                      {precioTotalSecundarios > 0 && (
                        <div className="flex justify-between">
                          <span>Unidades Secundarias:</span>
                          <span>{formatCurrency(precioTotalSecundarios)} UF</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-200">
                        <span>Total Escrituración:</span>
                        <span>{formatCurrency(totalEscrituraFinal)} UF</span>
                      </div>
                      {ufValue && (
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Equivalente en pesos:</span>
                          <span>{formatPesos(ufToPesos(totalEscrituraFinal))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Forma de pago */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Forma de Pago</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ítem</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Porcentaje</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pesos</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">UF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {/* Reserva */}
                          <tr>
                            <td className="px-4 py-2 whitespace-nowrap">Reserva</td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                        <input
                                type="text"
                                value={totalEscrituraFinal > 0 ? ((pagoReserva / totalEscrituraFinal) * 100).toFixed(2) + '%' : '-'}
                                readOnly
                                className="w-20 px-2 py-1 border border-gray-200 bg-gray-100 rounded-md text-right"
                        />
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{formatPesos(ufToPesos(pagoReserva))}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(pagoReserva)} UF</td>
                          </tr>
                          {/* Promesa */}
                          <tr>
                            <td className="px-4 py-2 whitespace-nowrap">Promesa</td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={promesaPctInput}
                          onChange={e => setPromesaPctInput(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(promesaPctInput.replace(',', '.'));
                            if (!isNaN(val)) handlePromesaPctChange(val);
                            else setPromesaPctInput(pagoPromesaPct.toFixed(2));
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right"
                        />
                              %
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{formatPesos(ufToPesos(pagoPromesa))}</td>
                            <td className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(pagoPromesa.toFixed(2))}
                                onChange={e => handlePromesaUFChange(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
                              />
                              UF
                              <button
                                type="button"
                                className={`ml-2 px-2 py-1 rounded ${ajusteDiferencia !== 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                disabled={ajusteDiferencia === 0}
                                title="Ajustar diferencia en Promesa"
                                onClick={ajustarPromesa}
                              >
                                <Wrench className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {/* Pie */}
                          <tr>
                            <td className="px-4 py-2 whitespace-nowrap">Pie</td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={piePctInput}
                          onChange={e => setPiePctInput(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(piePctInput.replace(',', '.'));
                            if (!isNaN(val)) handlePiePctChange(val);
                            else setPiePctInput(pagoPiePct.toFixed(2));
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right"
                        />
                              %
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{formatPesos(ufToPesos(pagoPie))}</td>
                            <td className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(pagoPie.toFixed(2))}
                                onChange={e => handlePieUFChange(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
                        />
                              UF
                              <button
                                type="button"
                                className={`ml-2 px-2 py-1 rounded ${ajusteDiferencia !== 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                disabled={ajusteDiferencia === 0}
                                title="Ajustar diferencia en Pie"
                                onClick={ajustarPie}
                              >
                                <Wrench className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {/* Crédito Hipotecario */}
                          <tr>
                            <td className="px-4 py-2 whitespace-nowrap">Crédito Hipotecario</td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={creditoPctInput}
                          onChange={e => setCreditoPctInput(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(creditoPctInput.replace(',', '.'));
                            if (!isNaN(val)) handleCreditoPctChange(val);
                            else setCreditoPctInput(pagoCreditoHipotecarioPct.toFixed(2));
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right"
                        />
                              %
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{formatPesos(ufToPesos(pagoCreditoHipotecarioCalculado))}</td>
                            <td className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(pagoCreditoHipotecarioCalculado.toFixed(2))}
                                onChange={e => handleCreditoUFChange(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
                              />
                              UF
                              <button
                                type="button"
                                className={`ml-2 px-2 py-1 rounded ${ajusteDiferencia !== 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                disabled={ajusteDiferencia === 0}
                                title="Ajustar diferencia en Crédito Hipotecario"
                                onClick={ajustarCredito}
                              >
                                <Wrench className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {/* Bono Pie solo si es flujo bono pie */}
                          {tipoCotizacionWizard === 'bono' && bonoPieYDescuento.bonoPieAplicableUF > 0 && (
                            <tr>
                              <td className="px-4 py-2 whitespace-nowrap font-semibold text-blue-700">Bono Pie</td>
                              <td className="px-4 py-2 whitespace-nowrap text-center">
                                {totalEscrituraFinal > 0
                                    ? ((bonoPieYDescuento.bonoPieAplicableUF / totalEscrituraFinal) * 100).toFixed(2)
                                    : '0.00'}%
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">{formatPesos(ufToPesos(bonoPieYDescuento.bonoPieAplicableUF))}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(bonoPieYDescuento.bonoPieAplicableUF)} UF</td>
                            </tr>
                          )}
                          {tipoCotizacionWizard === 'bono' && (
                            <div className="mb-4">
                              <div className="flex justify-between text-blue-700">
                                <span>
                                  Bono Pie hasta {bonoPieYDescuento.bonoPieMaximoPct}% ({formatCurrency(bonoPieYDescuento.bonoPieMaximoUF)} UF sobre total forma de pago):
                                </span>
                                <span>{formatCurrency(bonoPieYDescuento.bonoPieMaximoUF)} UF</span>
                      </div>
                              <div className="flex justify-between text-red-600">
                                <span>Descuento aplicado sobre depto:</span>
                                <span>-{formatCurrency(bonoPieYDescuento.descuentoAplicableUF)} UF</span>
                          </div>
                        </div>
                      )}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg mt-4">
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
                      {Math.abs(totalEscrituraFinal - totalFormaDePago) > 0.1 && (
                        <div className="mt-2 text-sm text-red-600">
                          ⚠️ La forma de pago no coincide con el total de escrituración. Ajuste los valores para que coincidan.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Sección de reserva */}
                  <div className="bg-white rounded-lg shadow p-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-800">Información de Reserva</h2>
                      
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Inmobiliaria</p>
                        <p className="font-medium">{realEstateAgency?.business_name || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Rut Inmobiliaria</p>
                        <p className="font-medium">{realEstateAgency?.rut || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Banco</p>
                        <p className="font-medium">{realEstateAgency?.bank || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Tipo Cuenta</p>
                        <p className="font-medium">{realEstateAgency?.account_type || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">N° de Cuenta</p>
                        <p className="font-medium">{realEstateAgency?.account_number || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">Monto Reserva</p>
                        <p className="font-medium">{montoReservaPesos !== null ? formatPesos(montoReservaPesos) : '-'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    {/* PDF Download Link */}
                    {selectedUnidad && !numeroCotizacion && (
                      <button
                        type="button"
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                        style={{ pointerEvents: savingQuote ? 'none' : 'auto', opacity: savingQuote ? 0.6 : 1 }}
                        onClick={async (e) => {
                          e.preventDefault();
                          const num = await guardarCotizacionYObtenerNumero();
                          if (num) setNumeroCotizacion(num);
                        }}
                        disabled={savingQuote}
                      >
                        {savingQuote ? (
                          <span className="flex items-center">
                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                            Guardando y generando PDF...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Download className="h-5 w-5 mr-2" />
                            Descargar PDF
                          </span>
                        )}
                      </button>
                    )}
                    {selectedUnidad && numeroCotizacion && (
                      <BlobProvider
                        document={
                          <BrokerQuotePDF
                            cliente={clientName}
                            rut={clientRut}
                            ufValue={ufValue}
                            selectedUnidad={selectedUnidad}
                            addedSecondaryUnits={addedSecondaryUnits}
                            quotationType={tipoCotizacionWizard || 'descuento'}
                            discountAmount={discountAmount}
                            bonoAmount={bonoAmount}
                            pagoReserva={pagoReserva}
                            pagoPromesa={pagoPromesa}
                            pagoPromesaPct={pagoPromesaPct}
                            pagoPie={pagoPie}
                            pagoPiePct={pagoPiePct}
                            pagoBonoPieCotizacion={bonoPieYDescuento.bonoPieAplicableUF}
                            precioBaseDepartamento={precioBaseDepartamento}
                            precioDescuentoDepartamento={precioDescuentoDepartamento}
                            precioDepartamentoConDescuento={precioDepartamentoConDescuento}
                            precioTotalSecundarios={precioTotalSecundarios}
                            totalEscritura={totalEscrituraFinal}
                            pagoCreditoHipotecarioCalculado={pagoCreditoHipotecarioCalculado}
                            totalFormaDePago={totalFormaDePago}
                            numeroCotizacion={numeroCotizacion}
                          />
                        }
                      >
                        {({ url, loading }) => {
                          React.useEffect(() => {
                            if (url && !loading) {
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Cotizacion_${selectedUnidad.proyecto_nombre}_${selectedUnidad.unidad}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              setNumeroCotizacion(null); // Limpia para permitir nuevas descargas
                            }
                          }, [url, loading]);
                          return null; // No muestra nada, solo dispara la descarga
                        }}
                      </BlobProvider>
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
        )}
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
      
      {/* Modal de Stock Completo */}
      <Dialog open={showStockModal} onClose={() => setShowStockModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
          <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full mx-auto p-6 z-10">
            <Dialog.Title className="text-2xl font-bold mb-4 text-blue-700">Stock Completo de Unidades</Dialog.Title>
            <div className="mb-4 flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
              <input
                type="text"
                placeholder="Buscar..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                className="border px-2 py-1 rounded w-full md:w-48"
              />
              <select
                value={stockProyecto || ''}
                onChange={e => setStockProyecto(e.target.value)}
                className="border px-2 py-1 rounded w-full md:w-48"
              >
                <option value="">Todos los proyectos</option>
                {stockTab === 'departamentos'
                  ? proyectosDeptos.map(p => <option key={p} value={p}>{p}</option>)
                  : proyectosSecundarios.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {stockTab === 'departamentos' ? (
                <select
                  value={stockTipologia || ''}
                  onChange={e => setStockTipologia(e.target.value)}
                  className="border px-2 py-1 rounded w-full md:w-48"
                >
                  <option value="">Todas las tipologías</option>
                  {tipologiasDeptos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <select
                  value={stockTipoBien || ''}
                  onChange={e => setStockTipoBien(e.target.value)}
                  className="border px-2 py-1 rounded w-full md:w-48"
                >
                  <option value="">Todos los tipos de bien</option>
                  {tiposBienSecundarios.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold ml-auto"
                onClick={exportarStockExcel}
              >
                Exportar a Excel
              </button>
            </div>
            <Tab.Group selectedIndex={stockTab === 'departamentos' ? 0 : 1} onChange={i => setStockTab(i === 0 ? 'departamentos' : 'secundarios')}>
              <Tab.List className="flex gap-2 mb-2">
                <Tab className={({ selected }) => selected ? 'px-4 py-2 bg-blue-600 text-white rounded font-semibold' : 'px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold'}>Departamentos</Tab>
                <Tab className={({ selected }) => selected ? 'px-4 py-2 bg-blue-600 text-white rounded font-semibold' : 'px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold'}>Secundarios</Tab>
              </Tab.List>
              <Tab.Panels>
                <Tab.Panel>
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">Proyecto</th>
                          <th className="px-2 py-2 text-left font-semibold">Unidad</th>
                          <th className="px-2 py-2 text-left font-semibold">Tipología</th>
                          <th className="px-2 py-2 text-left font-semibold">Piso</th>
                          <th className="px-2 py-2 text-left font-semibold">Orientación</th>
                          <th className="px-2 py-2 text-left font-semibold">Sup. total</th>
                          <th className="px-2 py-2 text-left font-semibold">Valor lista (UF)</th>
                          <th className="px-2 py-2 text-left font-semibold">Descuento (%)</th>
                          <th className="px-2 py-2 text-left font-semibold">Descuento (UF)</th>
                          <th className="px-2 py-2 text-left font-semibold">Valor con Descuento (UF)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {departamentosFiltrados.map((unidad) => {
                          const valorLista = unidad.valor_lista || 0;
                          const descuentoUnidad = unidad.descuento || 0;
                          const commissionRate = getCommissionRate(unidad.proyecto_nombre);
                          const valorConDescuento = valorLista * (1 - descuentoUnidad);
                          const comisionBroker = valorConDescuento * (commissionRate / 100);
                          const montoDescuento = valorLista * descuentoUnidad;
                          const descuentoDisponibleBroker = ((montoDescuento - comisionBroker) / valorLista) * 100;
                          const porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 10) / 10;
                          const descuentoUF = valorLista * (porcentajeRedondeado / 100);
                          const valorConDescuentoBroker = valorLista - descuentoUF;
                          return (
                            <tr key={unidad.id}>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.proyecto_nombre}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.unidad}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.tipologia}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.piso}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.orientacion || '-'}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{unidad.sup_total}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{formatCurrency(valorLista)}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{porcentajeRedondeado}%</td>
                              <td className="px-2 py-1 whitespace-nowrap">{formatCurrency(descuentoUF)}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{formatCurrency(valorConDescuentoBroker)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Tab.Panel>
                <Tab.Panel>
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">Proyecto</th>
                          <th className="px-2 py-2 text-left font-semibold">Unidad</th>
                          <th className="px-2 py-2 text-left font-semibold">Tipo de bien</th>
                          <th className="px-2 py-2 text-left font-semibold">Piso</th>
                          <th className="px-2 py-2 text-left font-semibold">Orientación</th>
                          <th className="px-2 py-2 text-left font-semibold">Sup. total</th>
                          <th className="px-2 py-2 text-left font-semibold">Valor lista (UF)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {secundariosFiltrados.map((unidad) => (
                          <tr key={unidad.id}>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.proyecto_nombre}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.unidad}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.tipo_bien}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.piso}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.orientacion || '-'}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{unidad.sup_total}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{formatCurrency(unidad.valor_lista || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
            <div className="flex justify-end mt-4">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                onClick={() => setShowStockModal(false)}
              >
                Cerrar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default BrokerQuotePage;