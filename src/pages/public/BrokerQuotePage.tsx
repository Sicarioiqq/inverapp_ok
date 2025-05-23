import React, { useState, useEffect, useMemo } from 'react'; // Importar useMemo
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer'; // Importar PDFDownloadLink
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF'; // Importar el componente PDF

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
  Wallet, // Icono para forma de pago
  Download // Icono para descarga
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
  const [discountAmount, setDiscountAmount] = useState<number>(0); // El descuento en % del departamento
  const [bonoAmount, setBonoAmount] = useState<number>(0); // El monto de bono en UF para la CONFIGURACION
  const [bonoAmountPct, setBonoAmountPct] = useState<number>(0); // El porcentaje de bono para la CONFIGURACION
  // Estado temporal para el input del bono pie en modo mix
  const [tempBonoAmountPctInput, setTempBonoAmountPctInput] = useState<string>('');

  const [initialTotalAvailableBono, setInitialTotalAvailableBono] = useState<number>(0); // Total disponible en Bono Pie (en UF)

  // NUEVOS ESTADOS para unidades secundarias del proyecto
  const [projectSecondaryUnits, setProjectSecondaryUnits] = useState<Unidad[]>([]);
  const [selectedSecondaryUnitToAdd, setSelectedSecondaryUnitToAdd] = useState<string>(''); // ID de la unidad seleccionada en el dropdown
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]); // Lista de unidades secundarias añadidas a la cotización

  // NUEVOS ESTADOS para la forma de pago de la cotización
  const [pagoReserva, setPagoReserva] = useState<number>(0);
  const [pagoPromesa, setPagoPromesa] = useState<number>(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState<number>(0); // Nuevo estado para el % de promesa
  const [pagoPie, setPagoPie] = useState<number>(0);
  const [pagoPiePct, setPagoPiePct] = useState<number>(0); // Nuevo estado para el % de pie
  // pagoCreditoHipotecario se calculará automáticamente
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0); // Este es el monto del bono pie en UF que aparece en la sección "Forma de Pago"

  // Estado para el ID de usuario de Supabase
  const [userId, setUserId] = useState<string | null>(null);

  // Constante para el valor fijo de la reserva en pesos
  const VALOR_RESERVA_PESOS = 100000;


  // Validar broker y autenticar usuario
  useEffect(() => {
    const validateAndAuth = async () => {
      if (!brokerSlug || !accessToken) { // accessToken is still needed for broker validation
        setError('Acceso inválido: No se proporcionó el slug del broker o el token de acceso.');
        setIsValidating(false);
        return;
      }

      try {
        // 1. Validar el broker usando el slug y el token de acceso público
        const { data, error: fe } = await supabase
          .from('brokers')
          .select('id, name')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken) // Usar accessToken para validación del broker
          .single();

        if (fe || !data) {
          throw new Error('No autorizado: Broker o token inválido.');
        }
        setBrokerInfo(data as BrokerInfo);

        // 2. Autenticar en Supabase de forma anónima para obtener un user_id para guardar la cotización
        // Esto no requiere un login explícito del usuario final.
        const { data: anonymousAuthData, error: anonymousAuthError } = await supabase.auth.signInAnonymously();
        if (anonymousAuthError) {
          throw new Error(`Error al iniciar sesión anónimamente para guardar cotizaciones: ${anonymousAuthError.message}`);
        }
        setUserId(anonymousAuthData.user?.id || null);

      } catch (e: any) {
        console.error("Error en validación del broker o autenticación anónima:", e.message);
        setError(e.message);
        // Si hay un error crítico aquí (ej. broker inválido), no se debería permitir continuar
        // Pero si es solo un error de signInAnonymously, podemos intentar continuar sin userId para guardar
        // aunque el requisito es tener un userId. Así que el error debería ser fatal si no se obtiene userId.
      } finally {
        setIsValidating(false);
      }
    };
    validateAndAuth();

    // El listener de auth state change sigue siendo útil para reaccionar a cambios si ocurren,
    // aunque con signInAnonymously el user_id debería ser estable.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [brokerSlug, accessToken]); // Dependencias: brokerSlug y accessToken

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

      // Calcular el descuento ajustado inicial
      const initialAdjustedDiscount = calculateAdjustedDiscount(
        selectedUnidad.valor_lista,
        selectedUnidad.descuento,
        selectedUnidad.proyecto_nombre
      );

      // Calcular el bono total disponible basado en el descuento ajustado inicial (en UF)
      const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
      setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
      
      // Resetear la forma de pago al cambiar de unidad
      setPagoReserva(0);
      setPagoPromesa(0);
      setPagoPromesaPct(0);
      setPagoPie(0);
      setPagoPiePct(0);


      if (quotationType === 'descuento') {
        setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2)));  
        setBonoAmount(0); // Restablecer bono UF en este modo
        setBonoAmountPct(0); // Restablecer bono % en este modo
        setTempBonoAmountPctInput('0.00'); // Resetear input temporal
        setPagoBonoPieCotizacion(0); // Restablecer bono en forma de pago
      } else if (quotationType === 'bono') {
        setDiscountAmount(0); // Restablecer descuento en modo bono
        setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2))); // Bono total disponible UF
        // bonoAmountPct se calculará en el useEffect que depende de totalEscritura
        setBonoAmountPct(0); // Inicializar a 0, se actualizará en el useEffect principal
        setTempBonoAmountPctInput('0.00'); // Resetear input temporal
        setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2))); // Sincronizar con forma de pago
      } else if (quotationType === 'mix') {
        // Al seleccionar mix, inicialmente todo el "bono" se muestra como tal.
        setDiscountAmount(0); // Descuento inicial 0, ya que todo está en bono
        setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2))); // Bono inicial disponible UF
        // bonoAmountPct se calculará en el useEffect principal
        setBonoAmountPct(0); // Inicializar a 0, se actualizará en el useEffect principal
        setTempBonoAmountPctInput('0.00'); // Resetear input temporal
        setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2))); // También inicializar el bono en forma de pago
      }
    } else {
      // Resetear estados si no hay unidad seleccionada
      setProjectSecondaryUnits([]);
      setAddedSecondaryUnits([]);
      setDiscountAmount(0);
      setBonoAmount(0);
      setBonoAmountPct(0);
      setTempBonoAmountPctInput('0.00'); // Resetear input temporal
      setInitialTotalAvailableBono(0);
      setPagoReserva(0);
      setPagoPromesa(0);
      setPagoPromesaPct(0);
      setPagoPie(0);
      setPagoPiePct(0);
      setPagoBonoPieCotizacion(0);
    }
  }, [selectedUnidad, quotationType, brokerCommissions, brokerInfo]);

  // Cálculos para la nueva sección de Cotización usando useMemo
  const {
    precioBaseDepartamento,
    precioDescuentoDepartamento,
    precioDepartamentoConDescuento,
    precioTotalSecundarios,
    totalEscritura, // Definido dentro de useMemo
    pagoCreditoHipotecarioCalculado,
    totalFormaDePago
  } = useMemo(() => {
    const pBaseDepto = selectedUnidad?.valor_lista || 0;
    let pDescuentoDepto = 0;
    let pDeptoConDescuento = pBaseDepto;

    // Utiliza el discountAmount actual del estado para el cálculo del descuento
    if (quotationType === 'descuento' || quotationType === 'mix') {
      pDescuentoDepto = (pBaseDepto * discountAmount) / 100;
      pDeptoConDescuento = pBaseDepto - pDescuentoDepto;
    } else {
      pDescuentoDepto = 0;
      pDeptoConDescuento = pBaseDepto;
    }

    const pTotalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
    const tEscritura = pDeptoConDescuento + pTotalSecundarios;

    const pCreditoHipotecarioCalculado = tEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion);
    const tFormaDePago = pagoReserva + pagoPromesa + pagoPie + pCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

    return {
      precioBaseDepartamento: parseFloat(pBaseDepto.toFixed(2)),
      precioDescuentoDepartamento: parseFloat(pDescuentoDepto.toFixed(2)),
      precioDepartamentoConDescuento: parseFloat(pDeptoConDescuento.toFixed(2)),
      precioTotalSecundarios: parseFloat(pTotalSecundarios.toFixed(2)),
      totalEscritura: parseFloat(tEscritura.toFixed(2)),
      pagoCreditoHipotecarioCalculado: parseFloat(pCreditoHipotecarioCalculado.toFixed(2)),
      totalFormaDePago: parseFloat(tFormaDePago.toFixed(2))
    };
  }, [selectedUnidad, quotationType, discountAmount, addedSecondaryUnits,
      pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion]);


  // Efecto para inicializar el pago de reserva (en UF) y para sincronizar el bono pie de configuración con el de cotización
  // Este useEffect también maneja la lógica inversa para el modo 'mix'
  useEffect(() => {
    if (ufValue !== null) {
      setPagoReserva(parseFloat((VALOR_RESERVA_PESOS / ufValue).toFixed(2))); // Redondear a 2 decimales
    }
    
    // Asegurarse de que selectedUnidad sea válido antes de proceder con cálculos complejos
    if (!selectedUnidad) {
        // Si no hay unidad seleccionada, resetear los valores relacionados con la cotización
        setBonoAmount(0);
        setBonoAmountPct(0);
        setTempBonoAmountPctInput('0.00'); // Resetear input temporal
        setPagoBonoPieCotizacion(0);
        setDiscountAmount(0); // También resetear descuento si no hay unidad
        return;
    }

    // Si estamos en mix, y el bono de cotización se ha editado (o inicializado con total disponible)
    if (quotationType === 'mix') {
        // Bono en UF que el usuario está "usando" en la forma de pago (o que se inicializó)
        const currentBonoUsedUF = pagoBonoPieCotizacion;

        // Calcular el porcentaje de este bono respecto al totalEscritura
        const bonoPct = (totalEscritura > 0) ? (currentBonoUsedUF / totalEscritura) * 100 : 0;
        setBonoAmountPct(parseFloat(bonoPct.toFixed(2))); // Sincronizar bono % de configuración con el de la forma de pago
        setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString()); // Sincronizar input temporal
        setBonoAmount(parseFloat(currentBonoUsedUF.toFixed(2))); // Sincronizar bono UF de configuración

        // Calcular el descuento "restante" como la diferencia entre el bono total disponible inicial y el bono usado.
        const remainingBonoForDiscountUF = Math.max(0, initialTotalAvailableBono - currentBonoUsedUF);
        
        // Convertir el bono restante en un porcentaje de descuento del VALOR_LISTA del departamento
        let newDiscountPercentage = 0;
        if (selectedUnidad.valor_lista && selectedUnidad.valor_lista > 0) {
            newDiscountPercentage = (remainingBonoForDiscountUF / selectedUnidad.valor_lista) * 100;
        }
        setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2))); // Actualizar el descuento en %
        
    } else if (quotationType === 'bono') {
      // Para 'bono' (no mix), el bonoAmount (UF en config) es el que manda.
      // Aquí, bonoAmount representa el bono total disponible de la unidad.
      setPagoBonoPieCotizacion(parseFloat(bonoAmount.toFixed(2))); // El bono en la forma de pago es el total disponible
      const bonoPct = (totalEscritura > 0) ? (bonoAmount / totalEscritura) * 100 : 0;
      setBonoAmountPct(parseFloat(bonoPct.toFixed(2)));
      setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString()); // Sincronizar input temporal
    } else {
      setPagoBonoPieCotizacion(0); // Si es solo descuento, el bono pie de la cotización es 0
      setBonoAmountPct(0);
      setTempBonoAmountPctInput('0.00'); // Resetear input temporal
      setBonoAmount(0);
    }
  }, [ufValue, quotationType, pagoBonoPieCotizacion, initialTotalAvailableBono, selectedUnidad, totalEscritura, bonoAmount]);


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

  // Funciones para manejar la edición bidireccional de Promesa y Pie
  const handlePromesaChange = (type: 'uf' | 'pct', value: string) => {
    const numValue = parseFloat(value);  
    
    // Si el valor ingresado no es un número válido o es infinito, se trata como 0
    const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

    if (totalEscritura === 0) { // Si el total escritura es 0, no se puede calcular porcentaje, solo se actualiza el UF si es directo
      setPagoPromesa(parseFloat(finalValue.toFixed(2))); // Asegurar 2 decimales
      // El porcentaje se calculará via useEffect si totalEscritura deja de ser 0
      return;
    }

    if (type === 'uf') {
      setPagoPromesa(parseFloat(finalValue.toFixed(2))); // Asegurar 2 decimales
      // El porcentaje se calculará y actualizará vía useEffect
    } else { // type === 'pct'
      setPagoPromesaPct(parseFloat(finalValue.toFixed(2))); // Actualiza el estado del porcentaje directamente, asegurando 2 decimales
      setPagoPromesa(parseFloat(((finalValue / 100) * totalEscritura).toFixed(2))); // Calcular y redondear a 2 decimales
    }
  };

  const handlePieChange = (type: 'uf' | 'pct', value: string) => {
    const numValue = parseFloat(value);
    
    // Si el valor ingresado no es un número válido o es infinito, se trata como 0
    const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

    if (totalEscritura === 0) {
      setPagoPie(parseFloat(finalValue.toFixed(2))); // Asegurar 2 decimales
      // El porcentaje se calculará via useEffect si totalEscritura deja de ser 0
      return;
    }

    if (type === 'uf') {
      setPagoPie(parseFloat(finalValue.toFixed(2))); // Asegurar 2 decimales
      // El porcentaje se calculará y actualizará vía useEffect
    } else { // type === 'pct'
      setPagoPiePct(parseFloat(finalValue.toFixed(2))); // Actualiza el estado del porcentaje directamente, asegurando 2 decimales
      setPagoPie(parseFloat(((finalValue / 100) * totalEscritura).toFixed(2))); // Calcular y redondear a 2 decimales
    }
  };

  // Función para aplicar los cambios del input temporal del Bono Pie (%)
  const applyBonoPieConfigChange = (value: string) => {
    const numValue = parseFloat(value);
    const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

    let limitedBonoPct = Math.min(100, Math.max(0, finalValue));

    if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
        setBonoAmountPct(parseFloat(limitedBonoPct.toFixed(2)));
        setBonoAmount(0);
        setPagoBonoPieCotizacion(0);
        setDiscountAmount(0);
        // setTempBonoAmountPctInput(parseFloat(limitedBonoPct.toFixed(2)).toString()); // No actualizar aquí para no interferir con la escritura
        return;
    }

    const bonoUFFromPct = (limitedBonoPct / 100) * totalEscritura;
    
    const finalBonoUF = Math.min(bonoUFFromPct, initialTotalAvailableBono);
    
    if (totalEscritura > 0 && bonoUFFromPct !== finalBonoUF) {
      limitedBonoPct = (finalBonoUF / totalEscritura) * 100;
    }

    setBonoAmountPct(parseFloat(limitedBonoPct.toFixed(2)));
    setBonoAmount(parseFloat(finalBonoUF.toFixed(2)));
    setPagoBonoPieCotizacion(parseFloat(finalBonoUF.toFixed(2)));
    // setTempBonoAmountPctInput(parseFloat(limitedBonoPct.toFixed(2)).toString()); // No actualizar aquí para no interferir con la escritura

    const remainingBonoForDiscount = Math.max(0, initialTotalAvailableBono - finalBonoUF);
    let newDiscountPercentage = 0;
    if (selectedUnidad.valor_lista > 0) {
        newDiscountPercentage = (remainingBonoForDiscount / selectedUnidad.valor_lista) * 100;
    }
    setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2)));
  };


  // Función para formatear moneda (siempre con 2 decimales)
  const formatCurrency = (amount: number | null): string => {
    // Manejar null, NaN, Infinity explícitamente para evitar problemas de visualización
    if (amount === null || isNaN(amount) || !isFinite(amount)) return '0.00';  
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Función para convertir UF a Pesos (con 0 decimales para pesos)
  const ufToPesos = (uf: number | null, ufValue: number | null): string => {
    // Manejar null, NaN, Infinity explícitamente
    if (uf === null || ufValue === null || isNaN(uf) || !isFinite(uf) || isNaN(ufValue) || !isFinite(ufValue)) return '$ 0';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(uf * ufValue);
  };

  // Memoized value for the max percentage allowed for Bono Pie in mix mode.
  const maxBonoPctAllowed = useMemo(() => {
    if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
        return 100;  
    }
    const calculatedMaxPct = (initialTotalAvailableBono / totalEscritura) * 100;
    return parseFloat(calculatedMaxPct.toFixed(2));
  }, [initialTotalAvailableBono, totalEscritura, selectedUnidad]);

  // Función para guardar la cotización en Supabase
  const saveQuotation = async () => {
    if (!brokerInfo || !userId || !selectedUnidad) {
      console.error("Cannot save quotation: Missing broker info, user ID, or selected unit.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quotations')
        .insert([
          {
            broker_id: brokerInfo.id,
            user_id: userId,
            client_name: cliente,
            client_rut: rut,
            uf_value: ufValue,
            selected_unit: selectedUnidad, // JSONB
            added_secondary_units: addedSecondaryUnits, // JSONB
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
            total_payment_form: totalFormaDePago,
          },
        ]);

      if (error) {
        throw error;
      }
      console.log('Cotización guardada exitosamente:', data);
    } catch (error: any) {
      console.error('Error al guardar la cotización:', error.message);
      // Aquí podrías mostrar un mensaje al usuario sobre el error
    }
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
            {userId && (
              <span className="ml-4 text-sm text-gray-500">User ID: {userId}</span>
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
              <div className="bg-white shadow rounded p-6 mt-6">
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
                                          const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
                                          
                                          setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2))); // Siempre calcular y guardar este

                                          if (newQuotationType === 'descuento') {
                                              setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2)));  
                                              setBonoAmount(0);
                                              setBonoAmountPct(0);
                                              setTempBonoAmountPctInput('0.00'); // Resetear input temporal
                                              setPagoBonoPieCotizacion(0);
                                          } else if (newQuotationType === 'bono') {
                                              setDiscountAmount(0);
                                              setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                              // bonoAmountPct se calculará en el useEffect principal
                                              setBonoAmountPct(0);  
                                              setTempBonoAmountPctInput('0.00'); // Resetear input temporal
                                              setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                          } else if (newQuotationType === 'mix') {
                                              setDiscountAmount(0); // Al inicio en mix, descuento es 0, todo es bono
                                              setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                              // bonoAmountPct se calculará en el useEffect principal
                                              setBonoAmountPct(0);
                                              setTempBonoAmountPctInput('0.00'); // Resetear input temporal
                                              setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
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
                                          readOnly={true} // Se hace readOnly para que refleje el valor automático
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                                          focus:border-blue-500 focus:ring-blue-500
                                          bg-gray-100 cursor-not-allowed"  
                                          step="0.01" // Permite input de 2 decimales
                                      />
                                  </div>
                              )}
                              {quotationType === 'bono' && (
                                  <div>
                                      <label htmlFor="bonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (UF)</label>
                                      <input
                                          type="number"
                                          id="bonoInput"
                                          value={parseFloat(bonoAmount.toFixed(2))} // Asegurar 2 decimales para la visualización
                                          readOnly={true} // Se hace readOnly para que refleje el valor automático
                                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed"
                                          step="0.01"
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
                                              readOnly={true} // El descuento en mix es readOnly
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500
                                              bg-gray-100 cursor-not-allowed"  
                                              step="0.01"
                                          />
                                      </div>
                                      <div>
                                          <label htmlFor="mixBonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (%)</label> {/* Etiqueta cambiada a % */}
                                          <input
                                              type="number"
                                              id="mixBonoInput"
                                              value={tempBonoAmountPctInput} // Usa el estado temporal
                                              onChange={e => {
                                                  setTempBonoAmountPctInput(e.target.value); // Siempre actualiza el estado temporal
                                                  // Aplica el cálculo inmediatamente si el valor es un número completo (flechas o finalización de escritura)
                                                  // La regex ` /^-?\d*\.?\d*$/ ` verifica si la cadena es un número válido o una entrada parcial como "1.", ".5".
                                                  // Si no termina en un punto flotante (indicando entrada incompleta de decimal), y no es solo un guion, se aplica el cálculo.
                                                  const isPartialInput = e.target.value.endsWith('.') || e.target.value === '-' || e.target.value === '';
                                                  if (!isPartialInput && !isNaN(parseFloat(e.target.value))) {
                                                      applyBonoPieConfigChange(e.target.value);
                                                  }
                                              }}
                                              onBlur={e => applyBonoPieConfigChange(e.target.value)} // Aplica cambios al perder el foco
                                              onKeyDown={e => { // Aplica cambios al presionar Enter
                                                  if (e.key === 'Enter') {
                                                      applyBonoPieConfigChange(e.currentTarget.value);
                                                      e.currentTarget.blur(); // Quita el foco después de Enter
                                                  }
                                              }}
                                              min="0" // Limitar para que no sea negativo
                                              max={maxBonoPctAllowed} // Usar el valor memoizado para el máximo
                                              step="0.01"
                                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                                    <span className="text-right">{ufToPesos(pagoReserva, ufValue)}</span>
                                    <div className="flex justify-end">
                                        {/* Ahora es un input type="text" con el valor formateado */}
                                        <input
                                            type="text"
                                            value={formatCurrency(pagoReserva)}
                                            readOnly
                                            className="w-24 text-right border rounded-md px-2 py-1 bg-gray-100 cursor-not-allowed font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Fila: Promesa */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Promesa:</span>
                                    {/* Input de porcentaje */}
                                    <div className="flex justify-end items-center">
                                        <input
                                            type="number"
                                            value={parseFloat(pagoPromesaPct.toFixed(2))} // Mostrar con 2 decimales
                                            onChange={e => handlePromesaChange('pct', e.target.value)}
                                            className="w-20 text-right border rounded-md px-2 py-1" // Ajuste de ancho
                                            step="0.01"
                                        />
                                        <span className="ml-1">%</span>
                                    </div>
                                    <span className="text-right">{ufToPesos(pagoPromesa, ufValue)}</span>
                                    {/* Input de UF */}
                                    <div className="flex justify-end">
                                        <input
                                            type="text" // Cambiado a text para mostrar el formato
                                            value={formatCurrency(pagoPromesa)} // Usar formatCurrency para la visualización
                                            onChange={e => handlePromesaChange('uf', e.target.value)}
                                            className="w-24 text-right border rounded-md px-2 py-1"
                                            // No usar step con type="text", el formateo lo maneja great
                                        />
                                    </div>
                                </div>

                                {/* Fila: Pie */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Pie:</span>
                                    {/* Input de porcentaje */}
                                    <div className="flex justify-end items-center">
                                        <input
                                            type="number"
                                            value={parseFloat(pagoPiePct.toFixed(2))} // Mostrar con 2 decimales
                                            onChange={e => handlePieChange('pct', e.target.value)}
                                            className="w-20 text-right border rounded-md px-2 py-1" // Ajuste de ancho
                                            step="0.01"
                                        />
                                        <span className="ml-1">%</span>
                                    </div>
                                    <span className="text-right">{ufToPesos(pagoPie, ufValue)}</span>
                                    {/* Input de UF */}
                                    <div className="flex justify-end">
                                        <input
                                            type="text" // Cambiado a text para mostrar el formato
                                            value={formatCurrency(pagoPie)} // Usar formatCurrency para la visualización
                                            onChange={e => handlePieChange('uf', e.target.value)}
                                            className="w-24 text-right border rounded-md px-2 py-1"
                                            // No usar step con type="text", el formateo lo maneja great
                                        />
                                    </div>
                                </div>

                                {/* Fila: Crédito Hipotecario (ajustable automáticamente) */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Crédito Hipotecario:</span>
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoCreditoHipotecarioCalculado, ufValue)}</span>
                                    <div className="flex justify-end">
                                        {/* Ahora es un input type="text" con el valor formateado */}
                                        <input
                                            type="text"
                                            value={formatCurrency(pagoCreditoHipotecarioCalculado)}
                                            readOnly
                                            className="w-24 text-right border rounded-md px-2 py-1 bg-gray-100 cursor-not-allowed font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Fila: Bono Pie */}
                                <div className="grid grid-cols-5 items-center">
                                    <span className="col-span-2">Bono Pie:</span>
                                    {/* Porcentaje de Bono Pie en la Forma de Pago */}
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((pagoBonoPieCotizacion / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(pagoBonoPieCotizacion, ufValue)}</span>
                                    <div className="flex justify-end">
                                        <input
                                            type="text" // Cambiado a text para usar formatCurrency
                                            value={formatCurrency(pagoBonoPieCotizacion)} // Usar formatCurrency para mostrar 2 decimales
                                            // Solo editable si es 'bono' puro. En 'mix', el valor se sincroniza desde la configuración.
                                            readOnly={quotationType === 'mix'}  
                                            className={`w-24 text-right border rounded-md px-2 py-1 ${quotationType === 'mix' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            // El onChange de este input ya no es necesario si se controla desde la configuración en 'mix'
                                            // Si `quotationType === 'bono'`, este input sí es editable y no necesita un handler para afectar otros campos.
                                            // Si `quotationType === 'descuento'`, el valor es 0 y es readOnly.
                                            // La sincronización en 'mix' se maneja desde el `useEffect` y `applyBonoPieConfigChange`.
                                        />
                                    </div>
                                </div>
                                
                                {/* Total Forma de Pago */}
                                <div className="grid grid-cols-5 items-center font-bold border-t pt-2 mt-2">
                                    <span className="col-span-2">Total:</span>
                                    {/* El porcentaje y pesos deben basarse en totalEscritura */}
                                    <span className="text-right">{totalEscritura > 0 ? formatCurrency((totalFormaDePago / totalEscritura) * 100) : formatCurrency(0)}%</span>
                                    <span className="text-right">{ufToPesos(totalFormaDePago, ufValue)}</span>
                                    <span className="text-right">{formatCurrency(totalFormaDePago)} UF</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Botón para generar PDF */}
                    <div className="mt-8 text-center">
                        {selectedUnidad && ( // Solo habilitar si hay una unidad seleccionada
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
                                fileName={`Cotizacion_${cliente.replace(/\s/g, '_') || 'Cliente'}_${selectedUnidad.unidad}.pdf`}
                                // Al hacer clic en el enlace de descarga, también guardamos la cotización
                                onClick={saveQuotation}
                            >
                                {({ blob, url, loading, error }) => (
                                    <button
                                        className="bg-green-600 text-white px-6 py-3 rounded-md shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center mx-auto"
                                        disabled={loading || !selectedUnidad}
                                    >
                                        <Download className="h-5 w-5 mr-2" />
                                        {loading ? 'Generando PDF...' : 'Generar Cotización PDF'}
                                    </button>
                                )}
                            </PDFDownloadLink>
                        )}
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
