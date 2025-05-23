// src/pages/public/BrokerQuotePage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { fetchLatestUFValue } from '../../lib/ufUtils';

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

// Interfaces
interface BrokerInfo {
  id: string;
  name: string;
  business_name: string;
  public_access_token: string;
  slug: string;
}

interface Unidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipologia: string;
  piso: string;
  orientacion: string | null;
  etapa: string | null;
  tipo_bien: string;
  valor_lista: number | null;
  descuento: number | null;
  sup_interior: number | null;
  sup_util: number | null;
  sup_terraza: number | null;
  sup_ponderada: number | null;
  sup_terreno: number | null;
  sup_jardin: number | null;
  sup_total: number | null;
  sup_logia: number | null;
  estado_unidad: string;
}

interface BrokerProjectCommission {
  id: string;
  broker_id: string;
  project_name: string;
  commission_rate: number;
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

    // Calcular el precio base del departamento (con descuento)
    const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
    
    // Calcular el descuento en UF
    const precioDescuentoDepartamento = precioBaseDepartamento * (discountAmount / 100);
    
    // Calcular el precio del departamento con descuento
    const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
    
    // Calcular el precio total de unidades secundarias
    const precioTotalSecundarios = addedSecondaryUnits.reduce((total, unit) => total + (unit.valor_lista || 0), 0);
    
    // Calcular el total de escritura
    const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
    
    // Calcular el crédito hipotecario
    const pagoCreditoHipotecarioCalculado = totalEscritura - pagoReserva - pagoPromesa - pagoPie - pagoBonoPieCotizacion;
    
    // Calcular el total de la forma de pago
    const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

    // Validar broker y cargar datos iniciales
    useEffect(() => {
        const validateBrokerAndLoadData = async () => {
            setIsValidating(true);
            setError(null);
            
            try {
                // Validar broker por slug y token
                const { data: brokerData, error: brokerError } = await supabase
                    .from('brokers')
                    .select('id, name, business_name, public_access_token, slug')
                    .eq('slug', brokerSlug)
                    .eq('public_access_token', accessToken)
                    .single();
                
                if (brokerError) throw brokerError;
                if (!brokerData) throw new Error('Broker no encontrado');
                
                setBrokerInfo(brokerData);
                
                // Cargar comisiones del broker
                await loadBrokerCommissions(brokerData.id);
                
                // Cargar stock de unidades
                await loadStock();
                
                // Cargar valor UF
                await loadUFValue();
                
            } catch (err: any) {
                console.error('Error validando broker:', err);
                setError('Acceso no autorizado. Por favor, verifique la URL o contacte al administrador.');
            } finally {
                setIsValidating(false);
            }
        };
        
        validateBrokerAndLoadData();
    }, [brokerSlug, accessToken]);

    // Cargar comisiones del broker
    const loadBrokerCommissions = async (brokerId: string) => {
        setLoadingCommissions(true);
        try {
            const { data, error } = await supabase
                .from('broker_project_commissions')
                .select('*')
                .eq('broker_id', brokerId);
            
            if (error) throw error;
            setBrokerCommissions(data || []);
        } catch (err) {
            console.error('Error cargando comisiones:', err);
        } finally {
            setLoadingCommissions(false);
        }
    };

    // Cargar stock de unidades
    const loadStock = async () => {
        setLoadingStock(true);
        try {
            // Obtener fecha de última actualización
            const { data: dateData, error: dateError } = await supabase
                .from('stock_unidades')
                .select('fecha_carga')
                .order('fecha_carga', { ascending: false })
                .limit(1);
            
            if (dateError) throw dateError;
            if (dateData && dateData.length > 0) {
                setStockLoadDate(dateData[0].fecha_carga);
            }
            
            // Obtener unidades disponibles
            const { data, error } = await supabase
                .from('stock_unidades')
                .select('*')
                .eq('estado_unidad', 'Disponible')
                .order('proyecto_nombre', { ascending: true })
                .order('unidad', { ascending: true });
            
            if (error) throw error;
            setStock(data || []);
        } catch (err) {
            console.error('Error cargando stock:', err);
        } finally {
            setLoadingStock(false);
        }
    };

    // Cargar valor UF
    const loadUFValue = async () => {
        setLoadingUf(true);
        try {
            const ufValue = await fetchLatestUFValue();
            if (ufValue) {
                setUfValue(ufValue);
            } else {
                // Fallback to a default value if API fails
                console.warn('No se pudo obtener el valor UF, usando valor por defecto');
                setUfValue(36500); // Default value as fallback
            }
        } catch (err) {
            console.error('Error cargando valor UF:', err);
            // Fallback to a default value if API fails
            setUfValue(36500); // Default value as fallback
        } finally {
            setLoadingUf(false);
        }
    };

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
                    .from('project_commercial_policies')
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

    }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy, pagoBonoPieCotizacion]); // Add projectCommercialPolicy to dependencies

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

    // Filtrar unidades según los filtros seleccionados
    const filteredUnits = useMemo(() => {
        return stock.filter(unit => {
            if (filterProyecto !== 'Todos' && unit.proyecto_nombre !== filterProyecto) return false;
            if (filterTipologia !== 'Todos' && unit.tipologia !== filterTipologia) return false;
            if (unit.tipo_bien !== 'DEPARTAMENTO') return false;
            return true;
        }).sort((a, b) => {
            if (a[sortField] === null) return 1;
            if (b[sortField] === null) return -1;
            if (typeof a[sortField] === 'string' && typeof b[sortField] === 'string') {
                return sortAsc 
                    ? a[sortField].localeCompare(b[sortField] as string)
                    : b[sortField].localeCompare(a[sortField] as string);
            }
            return sortAsc 
                ? (a[sortField] as number) - (b[sortField] as number)
                : (b[sortField] as number) - (a[sortField] as number);
        });
    }, [stock, filterProyecto, filterTipologia, sortField, sortAsc]);

    // Obtener proyectos únicos para el filtro
    const proyectos = useMemo(() => {
        return ['Todos', ...Array.from(new Set(stock.map(unit => unit.proyecto_nombre)))];
    }, [stock]);

    // Obtener tipologías únicas para el filtro
    const tipologias = useMemo(() => {
        if (filterProyecto === 'Todos') {
            return ['Todos', ...Array.from(new Set(stock.filter(unit => unit.tipo_bien === 'DEPARTAMENTO').map(unit => unit.tipologia)))];
        } else {
            return ['Todos', ...Array.from(new Set(stock.filter(unit => unit.proyecto_nombre === filterProyecto && unit.tipo_bien === 'DEPARTAMENTO').map(unit => unit.tipologia)))];
        }
    }, [stock, filterProyecto]);

    // Actualizar unidades secundarias disponibles cuando se selecciona una unidad principal
    useEffect(() => {
        if (selectedUnidad) {
            const secondaryUnits = stock.filter(unit => 
                unit.proyecto_nombre === selectedUnidad.proyecto_nombre && 
                unit.tipo_bien !== 'DEPARTAMENTO'
            );
            setProjectSecondaryUnits(secondaryUnits);
        } else {
            setProjectSecondaryUnits([]);
        }
    }, [selectedUnidad, stock]);

    // Manejar la selección de una unidad principal
    const handleSelectUnit = (unit: Unidad) => {
        setSelectedUnidad(unit);
        setActiveTab('configuracion');
        setAddedSecondaryUnits([]);
    };

    // Manejar la adición de una unidad secundaria
    const handleAddSecondaryUnit = () => {
        if (!selectedSecondaryUnitToAdd) return;
        
        const unitToAdd = projectSecondaryUnits.find(unit => unit.id === selectedSecondaryUnitToAdd);
        if (!unitToAdd) return;
        
        // Verificar si ya está agregada
        if (addedSecondaryUnits.some(unit => unit.id === unitToAdd.id)) {
            alert('Esta unidad ya ha sido agregada');
            return;
        }
        
        setAddedSecondaryUnits(prev => [...prev, unitToAdd]);
        setSelectedSecondaryUnitToAdd('');
    };

    // Manejar la eliminación de una unidad secundaria
    const handleRemoveAddedSecondaryUnit = (unitId: string) => {
        setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
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
            setPagoPromesaPct(parseFloat(((finalValue / totalEscritura) * 100).toFixed(2)));
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
            setPagoPiePct(parseFloat(((finalValue / totalEscritura) * 100).toFixed(2)));
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
                <Loader2 className="animate-spin h-8 w-8 mr-3 text-blue-600" /> 
                <span className="text-lg text-gray-700">Cargando datos...</span>
            </div>
        );

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <ShieldX className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.href = "https://www.inversionesecasa.cl"}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                    >
                        Volver al sitio principal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow">
                <div className="container mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo?.name}</h1>
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
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('principales')}
                            className={`flex items-center px-4 py-3 ${activeTab === 'principales' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Home className="h-5 w-5 mr-2" />
                            <span>Departamentos</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('secundarios')}
                            className={`flex items-center px-4 py-3 ${activeTab === 'secundarios' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            disabled={!selectedUnidad}
                        >
                            <LayoutDashboard className="h-5 w-5 mr-2" />
                            <span>Estacionamientos y Bodegas</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('configuracion')}
                            className={`flex items-center px-4 py-3 ${activeTab === 'configuracion' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            disabled={!selectedUnidad}
                        >
                            <SlidersHorizontal className="h-5 w-5 mr-2" />
                            <span>Configuración</span>
                        </button>
                    </div>
                </div>

                {/* Contenido de la pestaña de Departamentos */}
                {activeTab === 'principales' && (
                    <>
                        {/* Filtros */}
                        <div className="bg-white shadow rounded-lg p-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                                    <select
                                        value={filterProyecto}
                                        onChange={e => {
                                            setFilterProyecto(e.target.value);
                                            setFilterTipologia('Todos');
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2"
                                    >
                                        {proyectos.map(proyecto => (
                                            <option key={proyecto} value={proyecto}>{proyecto}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipología</label>
                                    <select
                                        value={filterTipologia}
                                        onChange={e => setFilterTipologia(e.target.value)}
                                        className="w-full border border-gray-300 rounded px-3 py-2"
                                    >
                                        {tipologias.map(tipologia => (
                                            <option key={tipologia} value={tipologia}>{tipologia}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                                    <div className="flex">
                                        <select
                                            value={sortField}
                                            onChange={e => setSortField(e.target.value as keyof Unidad)}
                                            className="flex-1 border border-gray-300 rounded-l px-3 py-2"
                                        >
                                            <option value="unidad">N° Unidad</option>
                                            <option value="tipologia">Tipología</option>
                                            <option value="piso">Piso</option>
                                            <option value="sup_util">Superficie Útil</option>
                                            <option value="valor_lista">Precio</option>
                                        </select>
                                        <button
                                            onClick={() => setSortAsc(!sortAsc)}
                                            className="bg-gray-100 border border-gray-300 border-l-0 rounded-r px-3 py-2"
                                        >
                                            {sortAsc ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Unidades */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unidad</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipología</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piso</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sup. Útil</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sup. Total</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUnits.map(unit => (
                                            <tr key={unit.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.proyecto_nombre}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.piso}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{unit.sup_util?.toFixed(2)} m²</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{unit.sup_total?.toFixed(2)} m²</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{unit.valor_lista?.toLocaleString()} UF</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                    <button
                                                        onClick={() => handleSelectUnit(unit)}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredUnits.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                                                    No hay unidades disponibles con los filtros seleccionados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Contenido de la pestaña de Secundarios */}
                {activeTab === 'secundarios' && selectedUnidad && (
                    <>
                        <div className="bg-white shadow rounded-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold mb-4">Agregar Estacionamiento o Bodega</h2>
                            
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <select
                                        value={selectedSecondaryUnitToAdd}
                                        onChange={e => setSelectedSecondaryUnitToAdd(e.target.value)}
                                        className="w-full border border-gray-300 rounded px-3 py-2"
                                    >
                                        <option value="">Seleccionar unidad secundaria...</option>
                                        {projectSecondaryUnits.map(unit => (
                                            <option key={unit.id} value={unit.id}>
                                                {unit.tipo_bien} {unit.unidad} - {unit.valor_lista?.toLocaleString()} UF
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddSecondaryUnit}
                                    disabled={!selectedSecondaryUnitToAdd}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <PlusCircle className="h-5 w-5 mr-2" />
                                    Agregar
                                </button>
                            </div>
                            
                            {addedSecondaryUnits.length > 0 ? (
                                <div className="mt-6">
                                    <h3 className="text-md font-medium mb-3">Unidades Secundarias Agregadas</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unidad</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {addedSecondaryUnits.map(unit => (
                                                    <tr key={unit.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.tipo_bien}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{unit.valor_lista?.toLocaleString()} UF</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                            <button
                                                                onClick={() => handleRemoveAddedSecondaryUnit(unit.id)}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                <Trash2 className="h-5 w-5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-4 text-gray-500 text-center">No hay unidades secundarias agregadas</p>
                            )}
                        </div>
                    </>
                )}

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
                                    {/* Sección Unidad */}
                                    <section className="mt-6 border-b pb-4">
                                        <h3 className="text-lg font-medium mb-2">Unidad</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-600">N° Unidad</p>
                                                <p className="font-semibold">{selectedUnidad.unidad}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Tipología</p>
                                                <p className="font-semibold">{selectedUnidad.tipologia}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Piso</p>
                                                <p className="font-semibold">{selectedUnidad.piso}</p>
                                            </div>
                                        </div>
                                    </section>
                                    {/* Sección Superficies */}
                                    <section className="mt-6 border-b pb-4">
                                        <h3 className="text-lg font-medium mb-2">Superficies</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {selectedUnidad.sup_util && (
                                                <div>
                                                    <p className="text-sm text-gray-600">Superficie Útil</p>
                                                    <p className="font-semibold">{selectedUnidad.sup_util.toFixed(2)} m²</p>
                                                </div>
                                            )}
                                            {selectedUnidad.sup_terraza && (
                                                <div>
                                                    <p className="text-sm text-gray-600">Superficie Terraza</p>
                                                    <p className="font-semibold">{selectedUnidad.sup_terraza.toFixed(2)} m²</p>
                                                </div>
                                            )}
                                            {selectedUnidad.sup_total && (
                                                <div>
                                                    <p className="text-sm text-gray-600">Superficie Total</p>
                                                    <p className="font-semibold">{selectedUnidad.sup_total.toFixed(2)} m²</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
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

                                    {/* Columna 2: Precios */}
                                    <div>
                                        <h4 className="text-md font-medium mb-4">Precios</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Precio Base Depto:</span>
                                                <span className="font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Descuento ({discountAmount.toFixed(2)}%):</span>
                                                <span className="font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-2">
                                                <span className="text-sm text-gray-600">Precio Depto con Descuento:</span>
                                                <span className="font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                                            </div>
                                            {addedSecondaryUnits.length > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Precio Unidades Secundarias:</span>
                                                    <span className="font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t pt-2">
                                                <span className="text-sm font-medium text-gray-700">Total Escrituración:</span>
                                                <span className="font-semibold">{formatCurrency(totalEscritura)} UF</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Equivalente en pesos:</span>
                                                <span>{ufToPesos(totalEscritura)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columna 3: Forma de Pago */}
                                    <div>
                                        <h4 className="text-md font-medium mb-4">Forma de Pago</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Reserva</label>
                                                <div className="mt-1 flex space-x-2">
                                                    <input
                                                        type="number"
                                                        value={pagoReserva}
                                                        onChange={e => setPagoReserva(parseFloat(e.target.value) || 0)}
                                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                        UF
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{ufToPesos(pagoReserva)}</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Promesa</label>
                                                <div className="mt-1 grid grid-cols-2 gap-2">
                                                    <div className="flex space-x-2">
                                                        <input
                                                            type="number"
                                                            value={pagoPromesa}
                                                            onChange={e => handlePromesaChange('uf', e.target.value)}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                            UF
                                                        </span>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <input
                                                            type="number"
                                                            value={pagoPromesaPct}
                                                            onChange={e => handlePromesaChange('pct', e.target.value)}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                        />
                                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{ufToPesos(pagoPromesa)}</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Pie</label>
                                                <div className="mt-1 grid grid-cols-2 gap-2">
                                                    <div className="flex space-x-2">
                                                        <input
                                                            type="number"
                                                            value={pagoPie}
                                                            onChange={e => handlePieChange('uf', e.target.value)}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                            UF
                                                        </span>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <input
                                                            type="number"
                                                            value={pagoPiePct}
                                                            onChange={e => handlePieChange('pct', e.target.value)}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                        />
                                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{ufToPesos(pagoPie)}</p>
                                            </div>

                                            {quotationType !== 'descuento' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Bono Pie</label>
                                                    <div className="mt-1 flex space-x-2">
                                                        <input
                                                            type="number"
                                                            value={pagoBonoPieCotizacion}
                                                            onChange={e => {
                                                                const value = parseFloat(e.target.value) || 0;
                                                                setPagoBonoPieCotizacion(value);
                                                                // Recalcular el porcentaje
                                                                if (totalEscritura > 0) {
                                                                    const newPct = (value / totalEscritura) * 100;
                                                                    setBonoAmountPct(parseFloat(newPct.toFixed(2)));
                                                                    setTempBonoAmountPctInput(parseFloat(newPct.toFixed(2)).toString());
                                                                }
                                                            }}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                            step="0.01"
                                                            min="0"
                                                            max={initialTotalAvailableBono}
                                                        />
                                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                            UF
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">{ufToPesos(pagoBonoPieCotizacion)}</p>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Crédito Hipotecario</label>
                                                <div className="mt-1 flex space-x-2">
                                                    <input
                                                        type="number"
                                                        value={pagoCreditoHipotecarioCalculado}
                                                        readOnly
                                                        className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-100"
                                                    />
                                                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gray-100">
                                                        UF
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">{ufToPesos(pagoCreditoHipotecarioCalculado)}</p>
                                            </div>

                                            <div className="pt-4 border-t">
                                                <div className="flex justify-between">
                                                    <span className="font-medium">Total Forma de Pago:</span>
                                                    <span className="font-semibold">{formatCurrency(totalFormaDePago)} UF</span>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500 text-right">{ufToPesos(totalFormaDePago)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Botones de Acción */}
                                <div className="mt-6 flex justify-end space-x-4">
                                    {selectedUnidad && cliente && rut && (
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
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center"
                                        >
                                            {({ loading }) => (
                                                loading ? 
                                                <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Generando PDF...</> : 
                                                <><Download className="h-5 w-5 mr-2" /> Descargar Cotización</>
                                            )}
                                        </PDFDownloadLink>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className="bg-white border-t mt-8 py-4">
                <div className="container mx-auto px-4">
                    <p className="text-center text-sm text-gray-500">
                        © {new Date().getFullYear()} {brokerInfo?.name} - Cotizador desarrollado por InverAPP
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default BrokerQuotePage;