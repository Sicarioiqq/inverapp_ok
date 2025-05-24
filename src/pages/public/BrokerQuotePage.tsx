// src/pages/public/BrokerQuotePage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';

import {
  LayoutDashboard,
  Home,
  SlidersHorizontal,
  Loader2,
  ShieldX,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Trash2,
  DollarSign,
  Wallet,
  Download,
  Calendar, // Nuevo icono para fecha
  Tag // Nuevo icono para bono
} from 'lucide-react';

// Interfaces (asegúrate de que estas interfaces estén definidas en algún lugar accesible,
// o defínelas aquí si no lo están. Las he incluido como ejemplo de cómo podrían ser si no las tienes)
interface BrokerInfo {
    id: string;
    name: string;
    slug: string;
    // ... otras propiedades del broker
}

interface Unidad {
    id: string;
    unidad: string;
    proyecto_nombre: string;
    tipologia: string;
    valor_lista: number | null;
    descuento: number | null; // Descuento original del proyecto
    // ... otras propiedades de la unidad (ej: superficie_total, dormitorios, etc.)
}

interface BrokerProjectCommission {
    id: string;
    broker_id: string;
    project_name: string;
    commission_rate: number | null; // Tasa de comisión como porcentaje (ej: 2.5 para 2.5%)
}

// NUEVA INTERFAZ para la política comercial del proyecto (subset de la tabla completa)
interface ProjectCommercialPolicy {
    id: string;
    project_name: string;
    monto_reserva_pesos: number | null;
    bono_pie_max_pct: number | null; // Almacenado como decimal (ej: 0.15 para 15%)
    fecha_tope: string | null; // String en formato 'YYYY-MM-DD'
    observaciones: string | null;
    comuna: string | null;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';
type QuotationType = 'descuento' | 'bono' | 'mix';

const BrokerQuotePage: React.FC = () => {
    const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
    const navigate = useNavigate();

    const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
    const [isValidating, setIsValidating] = useState(true); // Para la validación inicial del broker
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('principales');

    const [stock, setStock] = useState<Unidad[]>([]);
    const [loadingStock, setLoadingStock] = useState(false);
    const [stockLoadDate, setStockLoadDate] = useState<string | null>(null);

    const [brokerCommissions, setBrokerCommissions] = useState<BrokerProjectCommission[]>([]);
    const [loadingCommissions, setLoadingCommissions] = useState(false);

    // NUEVO ESTADO para la política comercial del proyecto seleccionado
    const [projectCommercialPolicy, setProjectCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
    const [loadingCommercialPolicy, setLoadingCommercialPolicy] = useState(false);


    const [ufValue, setUfValue] = useState<number | null>(null);
    const [loadingUf, setLoadingUf] = useState(true);

    const [sortField, setSortField] = useState<keyof Unidad>('unidad');
    const [sortAsc, setSortAsc] = useState(true);
    const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
    const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

    const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
    const [cliente, setCliente] = useState('');
    const [rut, setRut] = useState('');

    const [quotationType, setQuotationType] = useState<QuotationType>('descuento');
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [bonoAmount, setBonoAmount] = useState<number>(0);
    const [bonoAmountPct, setBonoAmountPct] = useState<number>(0);
    const [tempBonoAmountPctInput, setTempBonoAmountPctInput] = useState<string>('');

    const [initialTotalAvailableBono, setInitialTotalAvailableBono] = useState<number>(0);

    const [projectSecondaryUnits, setProjectSecondaryUnits] = useState<Unidad[]>([]);
    const [selectedSecondaryUnitToAdd, setSelectedSecondaryUnitToAdd] = useState<string>('');
    const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]);

    const [pagoReserva, setPagoReserva] = useState<number>(0);
    const [pagoPromesa, setPagoPromesa] = useState<number>(0);
    const [pagoPromesaPct, setPagoPromesaPct] = useState<number>(0);
    const [pagoPie, setPagoPie] = useState<number>(0);
    const [pagoPiePct, setPagoPiePct] = useState<number>(0);
    const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0);

    // Definición de totalEscritura usando useMemo
    const totalEscritura = useMemo(() => {
        if (!selectedUnidad || selectedUnidad.valor_lista === null) {
            return 0;
        }

        // Calcula el precio de la unidad principal después del descuento aplicado.
        // discountAmount se espera que sea un porcentaje (ej: 5 para 5%).
        const primaryUnitValueAfterDiscount = selectedUnidad.valor_lista * (1 - (discountAmount / 100));

        // Suma el valor de todas las unidades secundarias añadidas.
        const secondaryUnitsTotal = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista ?? 0), 0);

        return primaryUnitValueAfterDiscount + secondaryUnitsTotal;
    }, [selectedUnidad, discountAmount, addedSecondaryUnits]);


    // Efecto para la carga inicial de datos (validación de broker, UF, stock, comisiones)
    useEffect(() => {
        const initializePage = async () => {
            setIsValidating(true); // Inicia validación/carga
            setError(null);

            try {
                // 1. Validar Broker y Cargar Información del Broker
                const { data: brokerData, error: brokerError } = await supabase
                    .from('brokers') // Asume que tienes una tabla 'brokers'
                    .select('*')
                    .eq('slug', brokerSlug)
                    .single();

                if (brokerError || !brokerData) {
                    throw new Error('Broker no encontrado o token inválido.');
                }
                setBrokerInfo(brokerData as BrokerInfo); // Casting para asegurar el tipo

                // 2. Cargar Valor de la UF
                const { data: ufData, error: ufError } = await supabase
                    .from('valores_financieros') // Asume que tienes una tabla 'valores_financieros'
                    .select('valor')
                    .eq('nombre', 'UF')
                    .order('fecha', { ascending: false }) // Obtener el valor más reciente
                    .limit(1)
                    .single();

                if (ufError) throw ufError;
                if (ufData) setUfValue(ufData.valor);
                else setError('Valor de UF no disponible.');


                // 3. Cargar Stock de Unidades
                setLoadingStock(true);
                const { data: stockData, error: stockError } = await supabase
                    .from('unidades') // Asume que tienes una tabla 'unidades'
                    .select('*') // Ajusta las columnas según necesites
                    .eq('status', 'Disponible'); // Solo unidades disponibles, ajusta según tu lógica

                if (stockError) throw stockError;
                if (stockData) setStock(stockData as Unidad[]);
                setStockLoadDate(new Date().toISOString()); // Actualizar fecha de carga de stock


                // 4. Cargar Comisiones del Broker (necesita el ID del broker del paso 1)
                setLoadingCommissions(true);
                const { data: commissionsData, error: commissionsError } = await supabase
                    .from('broker_project_commissions') // Asume que tienes una tabla 'broker_project_commissions'
                    .select('*')
                    .eq('broker_id', brokerData.id); // Usa el ID del broker obtenido

                if (commissionsError) throw commissionsError;
                if (commissionsData) setBrokerCommissions(commissionsData as BrokerProjectCommission[]);


            } catch (e: any) {
                console.error('Error de inicialización:', e);
                setError(e.message || 'Error al cargar datos iniciales.');
                // Puedes redirigir a una página de login o error si la validación falla
                // navigate(`/public/login?error=${encodeURIComponent(e.message || 'authentication failed')}`);
            } finally {
                setIsValidating(false);
                setLoadingUf(false);
                setLoadingStock(false);
                setLoadingCommissions(false);
            }
        };

        if (brokerSlug && accessToken) {
            initializePage();
        } else {
            setError('Faltan parámetros de acceso (slug o token).');
            setIsValidating(false);
            setLoadingUf(false);
            setLoadingStock(false);
            setLoadingCommissions(false);
        }
    }, [brokerSlug, accessToken, navigate]); // Dependencias para este efecto principal


    // NUEVO useEffect para cargar la política comercial del proyecto seleccionado
    // Este efecto se ejecuta una vez que selectedUnidad.proyecto_nombre cambia
    useEffect(() => {
        const fetchProjectPolicy = async () => {
            if (!selectedUnidad?.proyecto_nombre) {
                setProjectCommercialPolicy(null);
                return;
            }
            setLoadingCommercialPolicy(true);
            try {
                const { data, error: policyError } = await supabase
                    .from<ProjectCommercialPolicy>('project_commercial_policies')
                    .select('*')
                    .eq('project_name', selectedUnidad.proyecto_nombre)
                    .single();

                if (policyError && policyError.code !== 'PGRST116') { // PGRST116 es "No rows found"
                    throw policyError;
                }
                setProjectCommercialPolicy(data || null);
            } catch (e) {
                console.error('Error loading project commercial policy:', e);
                setProjectCommercialPolicy(null); // Asegura que sea null en caso de error
            } finally {
                setLoadingCommercialPolicy(false);
            }
        };
        fetchProjectPolicy();
    }, [selectedUnidad?.proyecto_nombre]);


    // Actualizar el useEffect que maneja los cálculos y la reserva
    useEffect(() => {
        // Usar el monto de reserva de la política comercial, si está disponible,
        // de lo contrario, usar un valor predeterminado o un aviso.
        const reservaPesos = projectCommercialPolicy?.monto_reserva_pesos || 100000; // Usa 100,000 como fallback

        if (ufValue !== null) {
            setPagoReserva(parseFloat((reservaPesos / ufValue).toFixed(2))); // Redondear a 2 decimales
        }
        
        // Asegurarse de que selectedUnidad sea válido antes de proceder con cálculos complejos
        if (!selectedUnidad) {
            setBonoAmount(0);
            setBonoAmountPct(0);
            setTempBonoAmountPctInput('0.00');
            setPagoBonoPieCotizacion(0);
            setDiscountAmount(0);
            return;
        }

        // Calcular el descuento ajustado inicial (usando la lógica existente)
        const initialAdjustedDiscount = calculateAdjustedDiscount(
            selectedUnidad.valor_lista,
            selectedUnidad.descuento,
            selectedUnidad.proyecto_nombre
        );

        // Calcular el bono total disponible a partir del *descuento ajustado*
        const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
        setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));

        // Lógica para el tipo de cotización (descuento, bono, mix)
        if (quotationType === 'descuento') {
            setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2)));
            setBonoAmount(0);
            setBonoAmountPct(0);
            setTempBonoAmountPctInput('0.00');
            setPagoBonoPieCotizacion(0);
        } else if (quotationType === 'bono') {
            setDiscountAmount(0);
            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            // bonoAmountPct se calculará a continuación basándose en totalEscritura
        } else if (quotationType === 'mix') {
            // En modo mix, discountAmount y bonoAmount (UF) se derivan de tempBonoAmountPctInput
            // El estado inicial para mix es todo como bono, sin descuento a menos que el usuario lo ajuste
            setDiscountAmount(0);
            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
        }

        // Este bloque asegura que bonoAmountPct y tempBonoAmountPctInput estén sincronizados después de otros cálculos
        // Y es crítico para que el cálculo en modo "mix" actualice discountAmount basado en la entrada de bono
        if (quotationType === 'mix') {
            const currentBonoUsedUF = pagoBonoPieCotizacion; // Esta es la cantidad de la sección de pagos

            // Calcular bonoPct basado en *totalEscritura*
            const bonoPctBasedOnTotalEscritura = (totalEscritura > 0) ? (currentBonoUsedUF / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)).toString());

            // Calcular el bono restante disponible en UF del *bono inicial disponible*
            const remainingBonoForDiscountUF = Math.max(0, initialTotalAvailableBono - currentBonoUsedUF);
            
            // Convertir el bono restante (UF) en un porcentaje de descuento del valor de lista original
            let newDiscountPercentage = 0;
            if (selectedUnidad.valor_lista && selectedUnidad.valor_lista > 0) {
                newDiscountPercentage = (remainingBonoForDiscountUF / selectedUnidad.valor_lista) * 100;
            }
            setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2)));

        } else if (quotationType === 'bono') {
            const bonoPct = (totalEscritura > 0) ? (bonoAmount / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPct.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString());
        } else { // quotationType === 'descuento'
            setPagoBonoPieCotizacion(0);
            setBonoAmountPct(0);
            setTempBonoAmountPctInput('0.00');
            setBonoAmount(0);
        }

    }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]); // Añade projectCommercialPolicy a las dependencias


    // Función para calcular el descuento ajustado por la comisión del broker.
    const calculateAdjustedDiscount = (
        valorLista: number | null,
        descuentoActual: number | null,
        projectName: string
    ): number | null => {
        if (valorLista === null || valorLista === 0) return null;

        const brokerCommission = brokerCommissions.find(
            (comm) => comm.broker_id === brokerInfo?.id && comm.project_name === projectName
        );

        if (!brokerCommission || brokerCommission.commission_rate === null || descuentoActual === null) {
            return descuentoActual;
        }

        const brokerCommissionRate = brokerCommission.commission_rate / 100; // Convertir a decimal

        const precioMinimoVenta = valorLista * (1 - descuentoActual);
        const comisionBrokerUF = precioMinimoVenta * brokerCommissionRate;
        const precioMasComision = precioMinimoVenta + comisionBrokerUF;
        const descuentoDisponibleUF = valorLista - precioMasComision;

        const nuevoDescuentoPorcentaje = descuentoDisponibleUF / valorLista;

        return nuevoDescuentoPorcentaje; // Retornar como decimal
    };


    // Funciones para manejar la edición bidireccional de Promesa y Pie
    const handlePromesaChange = (type: 'uf' | 'pct', value: string) => {
        const numValue = parseFloat(value);      
        const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

        if (totalEscritura === 0) {
            setPagoPromesa(parseFloat(finalValue.toFixed(2)));
            return;
        }

        if (type === 'uf') {
            setPagoPromesa(parseFloat(finalValue.toFixed(2)));
        } else { // type === 'pct'
            setPagoPromesaPct(parseFloat(finalValue.toFixed(2)));
            setPagoPromesa(parseFloat(((finalValue / 100) * totalEscritura).toFixed(2)));
        }
    };

    const handlePieChange = (type: 'uf' | 'pct', value: string) => {
        const numValue = parseFloat(value);
        const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

        if (totalEscritura === 0) {
            setPagoPie(parseFloat(finalValue.toFixed(2)));
            return;
        }

        if (type === 'uf') {
            setPagoPie(parseFloat(finalValue.toFixed(2)));
        } else { // type === 'pct'
            setPagoPiePct(parseFloat(finalValue.toFixed(2)));
            setPagoPie(parseFloat(((finalValue / 100) * totalEscritura).toFixed(2)));
        }
    };

    // Función para aplicar los cambios del input temporal del Bono Pie (%)
    const applyBonoPieConfigChange = (value: string) => {
        const numValue = parseFloat(value);
        const finalValue = isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;

        // Aplicar el porcentaje máximo de bono pie de la política comercial
        const maxBonoPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convertir decimal a porcentaje
        let limitedBonoPct = Math.min(maxBonoPctFromPolicy, Math.max(0, finalValue));


        if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
            setBonoAmountPct(parseFloat(limitedBonoPct.toFixed(2)));
            setBonoAmount(0);
            setPagoBonoPieCotizacion(0);
            setDiscountAmount(0);
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

        const remainingBonoForDiscount = Math.max(0, initialTotalAvailableBono - finalBonoUF);
        let newDiscountPercentage = 0;
        if (selectedUnidad.valor_lista > 0) {
            newDiscountPercentage = (remainingBonoForDiscount / selectedUnidad.valor_lista) * 100;
        }
        setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2)));
    };


    // Función para formatear moneda (siempre con 2 decimales)
    const formatCurrency = (amount: number | null): string => {
        if (amount === null || isNaN(amount) || !isFinite(amount)) return '0.00';
        return new Intl.NumberFormat('es-CL', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Función para convertir UF a Pesos (con 0 decimales para pesos)
    const ufToPesos = (uf: number | null): string => {
        if (uf === null || ufValue === null || isNaN(uf) || !isFinite(uf) || isNaN(ufValue) || !isFinite(ufValue)) return '$ 0';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(uf * ufValue);
    };

    // Valor memoizado para el porcentaje máximo permitido para Bono Pie en modo mix.
    // AHORA DEPENDE TAMBIÉN DE LA POLÍTICA COMERCIAL DEL PROYECTO
    const maxBonoPctAllowed = useMemo(() => {
        if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
            return 100;
        }
        const calculatedMaxPct = (initialTotalAvailableBono / totalEscritura) * 100;
        const maxPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convertir decimal a porcentaje

        return parseFloat(Math.min(calculatedMaxPct, maxPctFromPolicy).toFixed(2));
    }, [initialTotalAvailableBono, totalEscritura, selectedUnidad, projectCommercialPolicy]); // Añade projectCommercialPolicy


    if (isValidating || loadingCommissions || loadingUf || loadingStock || loadingCommercialPolicy || brokerInfo === null) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin" /> Cargando datos...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-red-600">
                <ShieldX className="mr-2" /> Error: {error}
            </div>
        );
    }
    
    // ... (rest of the component's render logic, unchanged) ...
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow">
                <div className="container mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo.name}</h1>
                    <div className="text-lg font-semibold text-gray-700 flex flex-col items-end">
                        {ufValue ? (
                            <span>UF: $ {ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                            <span className="text-sm text-gray-500">Cargando UF...</span>
                        )}
                        {stockLoadDate && (
                            <span className="text-sm text-gray-500 mt-1">Última actualización de stock: {new Date(stockLoadDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        )}
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4">
                {/* Navegación por pestañas */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('principales')}
                            className={`${activeTab === 'principales' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Unidad Principal
                        </button>
                        <button
                            onClick={() => setActiveTab('secundarios')}
                            className={`${activeTab === 'secundarios' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Unidades Secundarias
                        </button>
                        <button
                            onClick={() => setActiveTab('configuracion')}
                            className={`${activeTab === 'configuracion' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Configuración de Cotización
                        </button>
                    </nav>
                </div>

                {/* Contenido de la pestaña de unidades principales */}
                {activeTab === 'principales' && (
                    <div className="bg-white shadow rounded p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4">Unidades Principales Disponibles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label htmlFor="filterProyecto" className="block text-sm font-medium text-gray-700">Proyecto</label>
                                <select
                                    id="filterProyecto"
                                    value={filterProyecto}
                                    onChange={e => setFilterProyecto(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                >
                                    <option value="Todos">Todos</option>
                                    {Array.from(new Set(stock.map(unit => unit.proyecto_nombre))).map(proyecto => (
                                        <option key={proyecto} value={proyecto}>{proyecto}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="filterTipologia" className="block text-sm font-medium text-gray-700">Tipología</label>
                                <select
                                    id="filterTipologia"
                                    value={filterTipologia}
                                    onChange={e => setFilterTipologia(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                >
                                    <option value="Todos">Todas</option>
                                    {Array.from(new Set(stock.map(unit => unit.tipologia))).map(tipologia => (
                                        <option key={tipologia} value={tipologia}>{tipologia}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loadingStock ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="animate-spin mr-2" /> Cargando stock...
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => { setSortField('proyecto_nombre'); setSortAsc(!sortAsc); }}>
                                                Proyecto {sortField === 'proyecto_nombre' && (sortAsc ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => { setSortField('unidad'); setSortAsc(!sortAsc); }}>
                                                Unidad {sortField === 'unidad' && (sortAsc ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => { setSortField('tipologia'); setSortAsc(!sortAsc); }}>
                                                Tipología {sortField === 'tipologia' && (sortAsc ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => { setSortField('valor_lista'); setSortAsc(!sortAsc); }}>
                                                Valor Lista (UF) {sortField === 'valor_lista' && (sortAsc ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                                                Descuento (%)
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stock
                                            .filter(unit => (filterProyecto === 'Todos' || unit.proyecto_nombre === filterProyecto) && (filterTipologia === 'Todos' || unit.tipologia === filterTipologia))
                                            .sort((a, b) => {
                                                const aValue = a[sortField];
                                                const bValue = b[sortField];

                                                if (typeof aValue === 'string' && typeof bValue === 'string') {
                                                    return sortAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                                                }
                                                if (typeof aValue === 'number' && typeof bValue === 'number') {
                                                    return sortAsc ? aValue - bValue : bValue - aValue;
                                                }
                                                return 0;
                                            })
                                            .map(unit => (
                                                <tr key={unit.id} className={`${selectedUnidad?.id === unit.id ? 'bg-blue-50' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{unit.proyecto_nombre}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.unidad}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(unit.valor_lista)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {unit.descuento !== null ? (unit.descuento * 100).toFixed(2) : '0.00'}%
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => setSelectedUnidad(unit)}
                                                            className="text-blue-600 hover:text-blue-900 mr-2"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Contenido de la pestaña de Unidades Secundarias */}
                {activeTab === 'secundarios' && (
                    <div className="bg-white shadow rounded p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4">Unidades Secundarias Añadidas</h2>
                        {!selectedUnidad ? (
                            <p className="text-gray-500">Seleccione primero una unidad principal.</p>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <label htmlFor="secondaryUnitSelect" className="block text-sm font-medium text-gray-700">Añadir Unidad Secundaria</label>
                                    <div className="flex space-x-2 mt-1">
                                        <select
                                            id="secondaryUnitSelect"
                                            value={selectedSecondaryUnitToAdd}
                                            onChange={e => setSelectedSecondaryUnitToAdd(e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm"
                                        >
                                            <option value="">Seleccione una unidad secundaria</option>
                                            {stock
                                                .filter(unit => unit.proyecto_nombre === selectedUnidad.proyecto_nombre && unit.id !== selectedUnidad.id && !addedSecondaryUnits.some(au => au.id === unit.id))
                                                .map(unit => (
                                                    <option key={unit.id} value={unit.id}>
                                                        {unit.unidad} - {unit.tipologia} (UF {formatCurrency(unit.valor_lista)})
                                                    </option>
                                                ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const unitToAdd = stock.find(unit => unit.id === selectedSecondaryUnitToAdd);
                                                if (unitToAdd) {
                                                    setAddedSecondaryUnits([...addedSecondaryUnits, unitToAdd]);
                                                    setSelectedSecondaryUnitToAdd(''); // Reset select
                                                }
                                            }}
                                            disabled={!selectedSecondaryUnitToAdd}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                                        >
                                            <PlusCircle className="inline w-5 h-5 mr-1" /> Añadir
                                        </button>
                                    </div>
                                </div>

                                {addedSecondaryUnits.length > 0 && (
                                    <div className="mt-6 overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipología</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Lista (UF)</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {addedSecondaryUnits.map(unit => (
                                                    <tr key={unit.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{unit.unidad}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(unit.valor_lista)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => setAddedSecondaryUnits(addedSecondaryUnits.filter(au => au.id !== unit.id))}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                <Trash2 className="inline w-5 h-5" /> Eliminar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Contenido de la pestaña de Configuración */}
                {activeTab === 'configuracion' && (
                    <>
                        {/* Tarjeta de Información General y Superficies */}
                        <div className="bg-white shadow rounded p-6 mb-6">
                            <h2 className="text-xl font-semibold mb-4">Información de la Unidad Seleccionada</h2>
                            {!selectedUnidad ? (
                                <p className="text-gray-500">Seleccione un departamento en la pestaña "Unidad Principal".</p>
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
                                        {projectCommercialPolicy && (
                                            <div className="mt-2 text-sm text-gray-600">
                                                <p className="flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-500" /> Fecha Tope: <span className="font-semibold ml-1">
                                                    {projectCommercialPolicy.fecha_tope ? new Date(projectCommercialPolicy.fecha_tope).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                                                </span></p>
                                                <p className="flex items-center mt-1"><Tag className="h-4 w-4 mr-1 text-gray-500" /> Bono Pie Máximo (Política): <span className="font-semibold ml-1">
                                                    {projectCommercialPolicy.bono_pie_max_pct !== null ? `${(projectCommercialPolicy.bono_pie_max_pct * 100).toFixed(2)}%` : 'N/A'}
                                                </span></p>
                                                {projectCommercialPolicy.comuna && (
                                                    <p className="mt-1">Comuna: <span className="font-semibold">{projectCommercialPolicy.comuna}</span></p>
                                                )}
                                                {projectCommercialPolicy.observaciones && (
                                                    <p className="mt-1">Observaciones: <span className="font-semibold">{projectCommercialPolicy.observaciones}</span></p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                    {/* Detalles de la unidad principal */}
                                    <section className="mt-6 border-b pb-4">
                                        <h3 className="text-lg font-medium mb-2">Detalles de la Unidad Principal</h3>
                                        <p><span className="font-semibold">Unidad:</span> {selectedUnidad.unidad}</p>
                                        <p><span className="font-semibold">Tipología:</span> {selectedUnidad.tipologia}</p>
                                        <p><span className="font-semibold">Valor Lista:</span> UF {formatCurrency(selectedUnidad.valor_lista)}</p>
                                        <p><span className="font-semibold">Descuento Original:</span> {selectedUnidad.descuento !== null ? (selectedUnidad.descuento * 100).toFixed(2) : '0.00'}%</p>
                                        {/* Añadir más detalles si la interfaz Unidad los tiene */}
                                    </section>

                                    {/* Superficies (si las unidades tienen estas propiedades) */}
                                    {(selectedUnidad as any).superficie_total_m2 && (
                                        <section className="mt-6">
                                            <h3 className="text-lg font-medium mb-2">Superficies</h3>
                                            <p><span className="font-semibold">Total:</span> {(selectedUnidad as any).superficie_total_m2} m²</p>
                                            {/* Añadir más superficies si existen */}
                                        </section>
                                    )}
                                </>
                            )}
                        </div>

                        {/* NUEVA TARJETA: Configuración de Cotización (Separada) */}
                        {selectedUnidad && (
                            <div className="bg-white shadow rounded p-6 mt-6">
                                <h3 className="text-xl font-semibold mb-4">Configuración de Cotización</h3>

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
                                                    if (selectedUnidad) {
                                                        const initialAdjustedDiscount = calculateAdjustedDiscount(
                                                            selectedUnidad.valor_lista,
                                                            selectedUnidad.descuento,
                                                            selectedUnidad.proyecto_nombre
                                                        );
                                                        const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
                                                        
                                                        setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));

                                                        if (newQuotationType === 'descuento') {
                                                            setDiscountAmount(parseFloat(((initialAdjustedDiscount ?? 0) * 100).toFixed(2)));
                                                            setBonoAmount(0);
                                                            setBonoAmountPct(0);
                                                            setTempBonoAmountPctInput('0.00');
                                                            setPagoBonoPieCotizacion(0);
                                                        } else if (newQuotationType === 'bono') {
                                                            setDiscountAmount(0);
                                                            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                                            setBonoAmountPct(0);
                                                            setTempBonoAmountPctInput('0.00');
                                                            setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                                        } else if (newQuotationType === 'mix') {
                                                            setDiscountAmount(0);
                                                            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
                                                            setBonoAmountPct(0);
                                                            setTempBonoAmountPctInput('0.00');
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
                                        <div className="space-y-4">
                                            {quotationType === 'descuento' && (
                                                <div>
                                                    <label htmlFor="discountInput" className="block text-sm font-medium text-gray-700">Descuento (%)</label>
                                                    <input
                                                        type="number"
                                                        id="discountInput"
                                                        value={parseFloat(discountAmount.toFixed(2))}
                                                        readOnly={true}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                                                        focus:border-blue-500 focus:ring-blue-500
                                                        bg-gray-100 cursor-not-allowed"
                                                        step="0.01"
                                                    />
                                                </div>
                                            )}
                                            {quotationType === 'bono' && (
                                                <div>
                                                    <label htmlFor="bonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (UF)</label>
                                                    <input
                                                        type="number"
                                                        id="bonoInput"
                                                        value={parseFloat(bonoAmount.toFixed(2))}
                                                        readOnly={true}
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
                                                            value={parseFloat(discountAmount.toFixed(2))}
                                                            readOnly={true}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500
                                                            bg-gray-100 cursor-not-allowed"
                                                            step="0.01"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="mixBonoInput" className="block text-sm font-medium text-gray-700">Bono Pie (%)</label>
                                                        <input
                                                            type="number"
                                                            id="mixBonoInput"
                                                            value={tempBonoAmountPctInput}
                                                            onChange={e => {
                                                                setTempBonoAmountPctInput(e.target.value);
                                                                const isPartialInput = e.target.value.endsWith('.') || e.target.value === '-' || e.target.value === '';
                                                                if (!isPartialInput && !isNaN(parseFloat(e.target.value))) {
                                                                    applyBonoPieConfigChange(e.target.value);
                                                                }
                                                            }}
                                                            onBlur={e => applyBonoPieConfigChange(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    applyBonoPieConfigChange(e.currentTarget.value);
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            min="0"
                                                            max={maxBonoPctAllowed}
                                                            step="0.01"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                        />
                                                        {maxBonoPctAllowed < 100 && (
                                                            <p className="text-red-500 text-xs mt-1">Máx. {maxBonoPctAllowed.toFixed(2)}% según política.</p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Columna 2: Resumen de Valores de Cotización */}
                                    <div className="lg:col-span-2">
                                        <h4 className="text-lg font-medium mb-2">Resumen de Valores</h4>
                                        <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm">
                                            <p className="flex justify-between">
                                                <span className="font-medium">Valor Lista Unidad Principal:</span>
                                                <span>UF {formatCurrency(selectedUnidad.valor_lista)} ({ufToPesos(selectedUnidad.valor_lista)})</span>
                                            </p>
                                            {addedSecondaryUnits.length > 0 && (
                                                <p className="flex justify-between text-gray-600">
                                                    <span className="font-medium">Unidades Secundarias:</span>
                                                    <span>UF {formatCurrency(addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista ?? 0), 0))}</span>
                                                </p>
                                            )}
                                            <p className="flex justify-between font-bold text-blue-700">
                                                <span>Valor Total UF (Escritura):</span>
                                                <span>UF {formatCurrency(totalEscritura)} ({ufToPesos(totalEscritura)})</span>
                                            </p>
                                            {quotationType === 'descuento' && (
                                                <p className="flex justify-between text-green-700">
                                                    <span className="font-medium">Descuento Aplicado:</span>
                                                    <span>{formatCurrency(discountAmount)}% (UF {formatCurrency((selectedUnidad.valor_lista ?? 0) * (discountAmount / 100))})</span>
                                                </p>
                                            )}
                                            {(quotationType === 'bono' || quotationType === 'mix') && (
                                                <p className="flex justify-between text-green-700">
                                                    <span className="font-medium">Bono Pie Aplicado:</span>
                                                    <span>UF {formatCurrency(bonoAmount)} ({formatCurrency(bonoAmountPct)}%)</span>
                                                </p>
                                            )}
                                            {quotationType === 'mix' && (
                                                <p className="flex justify-between text-green-700">
                                                    <span className="font-medium">Descuento Adicional (Mix):</span>
                                                    <span>{formatCurrency(discountAmount)}% (UF {formatCurrency((selectedUnidad.valor_lista ?? 0) * (discountAmount / 100))})</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Sección de Pagos */}
                                        <div className="mt-6">
                                            <h4 className="text-lg font-medium mb-2">Flujo de Pagos (UF)</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Pago Reserva (UF)</label>
                                                    <div className="mt-1 relative rounded-md shadow-sm">
                                                        <input type="number"
                                                            value={formatCurrency(pagoReserva)}
                                                            readOnly
                                                            className="block w-full pr-10 border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">UF</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Pago Promesa (UF)</label>
                                                    <div className="mt-1 relative rounded-md shadow-sm">
                                                        <input type="number"
                                                            value={formatCurrency(pagoPromesa)}
                                                            onChange={e => handlePromesaChange('uf', e.target.value)}
                                                            onBlur={e => handlePromesaChange('uf', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handlePromesaChange('uf', e.currentTarget.value); e.currentTarget.blur(); }}
                                                            className="block w-full pr-10 border-gray-300 rounded-md"
                                                            step="0.01"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">UF</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Pago Promesa (%)</label>
                                                    <div className="mt-1 relative rounded-md shadow-sm">
                                                        <input type="number"
                                                            value={formatCurrency(pagoPromesaPct)}
                                                            onChange={e => handlePromesaChange('pct', e.target.value)}
                                                            onBlur={e => handlePromesaChange('pct', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handlePromesaChange('pct', e.currentTarget.value); e.currentTarget.blur(); }}
                                                            className="block w-full pr-10 border-gray-300 rounded-md"
                                                            step="0.01"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Pago Pie (UF)</label>
                                                    <div className="mt-1 relative rounded-md shadow-sm">
                                                        <input type="number"
                                                            value={formatCurrency(pagoPie)}
                                                            onChange={e => handlePieChange('uf', e.target.value)}
                                                            onBlur={e => handlePieChange('uf', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handlePieChange('uf', e.currentTarget.value); e.currentTarget.blur(); }}
                                                            className="block w-full pr-10 border-gray-300 rounded-md"
                                                            step="0.01"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">UF</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Pago Pie (%)</label>
                                                    <div className="mt-1 relative rounded-md shadow-sm">
                                                        <input type="number"
                                                            value={formatCurrency(pagoPiePct)}
                                                            onChange={e => handlePieChange('pct', e.target.value)}
                                                            onBlur={e => handlePieChange('pct', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handlePieChange('pct', e.currentTarget.value); e.currentTarget.blur(); }}
                                                            className="block w-full pr-10 border-gray-300 rounded-md"
                                                            step="0.01"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 sm:text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {(quotationType === 'bono' || quotationType === 'mix') && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Bono Pie (Cotización)</label>
                                                        <div className="mt-1 relative rounded-md shadow-sm">
                                                            <input type="number"
                                                                value={formatCurrency(pagoBonoPieCotizacion)}
                                                                readOnly
                                                                className="block w-full pr-10 border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                                                            />
                                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                                <span className="text-gray-500 sm:text-sm">UF</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-4 bg-blue-50 p-3 rounded-md text-sm">
                                                <p className="flex justify-between font-semibold">
                                                    <span>Total Pagado:</span>
                                                    <span>UF {formatCurrency(pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion)}</span>
                                                </p>
                                                <p className="flex justify-between font-semibold">
                                                    <span>Porcentaje Total Pagado:</span>
                                                    <span>{(totalEscritura > 0) ? formatCurrency(((pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion) / totalEscritura) * 100) : '0.00'}%</span>
                                                </p>
                                                <p className="flex justify-between font-semibold text-red-700">
                                                    <span>Monto a Financiar (Hipoteca):</span>
                                                    <span>UF {formatCurrency(totalEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion))}</span>
                                                </p>
                                                <p className="flex justify-between font-semibold text-red-700">
                                                    <span>Porcentaje a Financiar:</span>
                                                    <span>{(totalEscritura > 0) ? formatCurrency(((totalEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion)) / totalEscritura) * 100) : '0.00'}%</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Botón de Descarga de PDF */}
                                        <div className="mt-6 text-right">
                                            <PDFDownloadLink
                                                document={
                                                    <BrokerQuotePDF
                                                        brokerInfo={brokerInfo}
                                                        cliente={cliente}
                                                        rut={rut}
                                                        ufValue={ufValue}
                                                        selectedUnidad={selectedUnidad}
                                                        addedSecondaryUnits={addedSecondaryUnits}
                                                        quotationType={quotationType}
                                                        discountAmount={discountAmount}
                                                        bonoAmount={bonoAmount}
                                                        bonoAmountPct={bonoAmountPct}
                                                        totalEscritura={totalEscritura}
                                                        pagoReserva={pagoReserva}
                                                        pagoPromesa={pagoPromesa}
                                                        pagoPromesaPct={pagoPromesaPct}
                                                        pagoPie={pagoPie}
                                                        pagoPiePct={pagoPiePct}
                                                        pagoBonoPieCotizacion={pagoBonoPieCotizacion}
                                                        projectCommercialPolicy={projectCommercialPolicy}
                                                    />
                                                }
                                                fileName={`Cotizacion_${selectedUnidad?.unidad}_${cliente.replace(/\s/g, '_')}.pdf`}
                                            >
                                                {({ blob, url, loading, error }) => (
                                                    <button
                                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                        disabled={loading || !selectedUnidad || !ufValue || !cliente || !rut}
                                                    >
                                                        {loading ? (
                                                            <>
                                                                <Loader2 className="animate-spin mr-2" /> Generando PDF...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Download className="mr-2 h-5 w-5" /> Descargar Cotización PDF
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </PDFDownloadLink>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className="bg-gray-800 text-white text-center p-4 text-sm mt-8">
                © {new Date().getFullYear()} InverApp. Todos los derechos reservados.
            </footer>
        </div>
    );
};

export default BrokerQuotePage;