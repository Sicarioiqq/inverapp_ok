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

// ... (existing interfaces: BrokerInfo, Unidad, BrokerProjectCommission, etc.) ...

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
    const [isValidating, setIsValidating] = useState(true);
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


    // ELIMINAR ESTA CONSTANTE FIJA
    // const VALOR_RESERVA_PESOS = 100000;


    // ... (rest of useEffect for broker validation and stock loading) ...

    // NUEVO useEffect para cargar la política comercial del proyecto seleccionado
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

                if (policyError && policyError.code !== 'PGRST116') { // PGRST116 is "No rows found"
                    throw policyError;
                }
                setProjectCommercialPolicy(data || null);
            } catch (e) {
                console.error('Error loading project commercial policy:', e);
                setProjectCommercialPolicy(null); // Ensure it's null on error
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

        // Calculate the initial adjusted discount (using existing logic)
        const initialAdjustedDiscount = calculateAdjustedDiscount(
            selectedUnidad.valor_lista,
            selectedUnidad.descuento,
            selectedUnidad.proyecto_nombre
        );

        // Calculate the total available bono from the *adjusted discount*
        const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
        setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));

        // Logic for quotation type (descuento, bono, mix)
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
            // bonoAmountPct will be calculated below based on totalEscritura
        } else if (quotationType === 'mix') {
            // In mix mode, discountAmount and bonoAmount (UF) are derived from tempBonoAmountPctInput
            // Initial state for mix is all as bono, no discount unless adjusted by user
            setDiscountAmount(0);
            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
        }

        // This block ensures bonoAmountPct and tempBonoAmountPctInput are synced after other calculations
        // And it's critical for the "mix" mode calculation to update discountAmount based on bono input
        if (quotationType === 'mix') {
            const currentBonoUsedUF = pagoBonoPieCotizacion; // This is the amount from the payment section

            // Calculate bonoPct based on *totalEscritura*
            const bonoPctBasedOnTotalEscritura = (totalEscritura > 0) ? (currentBonoUsedUF / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)).toString());

            // Calculate the remaining available bono in UF from the *initial available bono*
            const remainingBonoForDiscountUF = Math.max(0, initialTotalAvailableBono - currentBonoUsedUF);
            
            // Convert the remaining bono (UF) into a discount percentage of the original list value
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

    }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]); // Add projectCommercialPolicy to dependencies


    // ... (rest of calculateAdjustedDiscount function - NO CHANGES HERE) ...
    // Function to calculate the adjusted discount by the broker's commission.
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

        const brokerCommissionRate = brokerCommission.commission_rate / 100; // Convert to decimal

        const precioMinimoVenta = valorLista * (1 - descuentoActual);
        const comisionBrokerUF = precioMinimoVenta * brokerCommissionRate;
        const precioMasComision = precioMinimoVenta + comisionBrokerUF;
        const descuentoDisponibleUF = valorLista - precioMasComision;

        const nuevoDescuentoPorcentaje = descuentoDisponibleUF / valorLista;

        return nuevoDescuentoPorcentaje; // Return as decimal
    };


    // ... (rest of filtered, handleAddSecondaryUnit, handleRemoveAddedSecondaryUnit) ...

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

        // Apply maximum bono pie percentage from commercial policy
        const maxBonoPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convert decimal to percentage
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

    // Memoized value for the max percentage allowed for Bono Pie in mix mode.
    // AHORA DEPENDE TAMBIÉN DE LA POLÍTICA COMERCIAL DEL PROYECTO
    const maxBonoPctAllowed = useMemo(() => {
        if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
            return 100;
        }
        const calculatedMaxPct = (initialTotalAvailableBono / totalEscritura) * 100;
        const maxPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convert decimal to percentage

        return parseFloat(Math.min(calculatedMaxPct, maxPctFromPolicy).toFixed(2));
    }, [initialTotalAvailableBono, totalEscritura, selectedUnidad, projectCommercialPolicy]); // Add projectCommercialPolicy


    if (isValidating || loadingCommissions || loadingUf || loadingStock || loadingCommercialPolicy)
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin" /> Cargando datos...
            </div>
        );
    // ... (rest of error handling) ...

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
                {/* ... (existing tab navigation) ... */}

                {/* ... (existing filters and table for Principales/Secundarios) ... */}

                {/* Contenido de la pestaña de Configuración */}
                {activeTab === 'configuracion' && (
                    <>
                        {/* Tarjeta de Información General y Superficies */}
                        <div className="bg-white shadow rounded p-6 mb-6">
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
                                    {/* ... (rest of Unidad details, surfaces, etc.) ... */}
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
                                    {/* ... (rest of secondary units and payment summary, etc.) ... */}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            {/* ... (footer) ... */}
        </div>
    );
};

export default BrokerQuotePage;