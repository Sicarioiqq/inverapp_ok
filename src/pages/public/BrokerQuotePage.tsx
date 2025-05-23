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
  Calendar,
  Tag
} from 'lucide-react';

interface BrokerInfo {
  id: string;
  name: string;
  business_name: string;
  public_access_token: string;
}

interface Unidad {
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
  descuento: number;
  estado_unidad: string;
  etapa: string;
}

interface BrokerProjectCommission {
  id: string;
  broker_id: string;
  project_name: string;
  commission_rate: number;
}

interface ProjectCommercialPolicy {
    id: string;
    project_name: string;
    monto_reserva_pesos: number | null;
    bono_pie_max_pct: number | null;
    fecha_tope: string | null;
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

    const [projectCommercialPolicy, setProjectCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
    const [loadingCommercialPolicy, setLoadingCommercialPolicy] = useState(false);

    const [ufValue, setUfValue] = useState<number | null>(null);
    const [loadingUf, setLoadingUf] = useState(true);

    const [sortField, setSortField] = useState<keyof Unidad>('unidad');
    const [sortDirection, setSortDirection] = useState(true);
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

    // Calculated values
    const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
    const precioDescuentoDepartamento = precioBaseDepartamento * (discountAmount / 100);
    const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
    const precioTotalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
    const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
    const pagoCreditoHipotecarioCalculado = totalEscritura - pagoReserva - pagoPromesa - pagoPie - pagoBonoPieCotizacion;
    const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

    // Validate broker access token
    useEffect(() => {
        const validateBroker = async () => {
            try {
                setIsValidating(true);
                if (!brokerSlug || !accessToken) {
                    throw new Error('Acceso inválido: Falta slug o token');
                }

                const { data, error } = await supabase
                    .from('brokers')
                    .select('id, name, business_name, public_access_token')
                    .eq('slug', brokerSlug)
                    .eq('public_access_token', accessToken)
                    .single();

                if (error || !data) {
                    throw new Error('Acceso inválido: Token no autorizado');
                }

                setBrokerInfo(data);
                
                // Load initial data
                await Promise.all([
                    fetchStock(),
                    fetchBrokerCommissions(data.id),
                    fetchUFValue()
                ]);
            } catch (err: any) {
                console.error('Error validating broker:', err);
                setError(err.message || 'Error de acceso');
            } finally {
                setIsValidating(false);
            }
        };

        validateBroker();
    }, [brokerSlug, accessToken]);

    // Fetch UF value
    const fetchUFValue = async () => {
        try {
            setLoadingUf(true);
            const value = await fetchLatestUFValue();
            setUfValue(value);
        } catch (err) {
            console.error('Error fetching UF value:', err);
        } finally {
            setLoadingUf(false);
        }
    };

    // Fetch stock data
    const fetchStock = async () => {
        try {
            setLoadingStock(true);
            
            // Get the most recent stock load date
            const { data: dateData, error: dateError } = await supabase
                .from('stock_unidades')
                .select('fecha_carga')
                .order('fecha_carga', { ascending: false })
                .limit(1);
                
            if (dateError) throw dateError;
            if (dateData && dateData.length > 0) {
                setStockLoadDate(dateData[0].fecha_carga);
            }
            
            // Get all available units
            const { data, error } = await supabase
                .from('stock_unidades')
                .select('*')
                .eq('estado_unidad', 'Disponible')
                .order('proyecto_nombre', { ascending: true })
                .order('unidad', { ascending: true });
                
            if (error) throw error;
            setStock(data || []);
        } catch (err) {
            console.error('Error fetching stock:', err);
        } finally {
            setLoadingStock(false);
        }
    };

    // Fetch broker commissions
    const fetchBrokerCommissions = async (brokerId: string) => {
        try {
            setLoadingCommissions(true);
            const { data, error } = await supabase
                .from('broker_project_commissions')
                .select('*')
                .eq('broker_id', brokerId);
                
            if (error) throw error;
            setBrokerCommissions(data || []);
        } catch (err) {
            console.error('Error fetching broker commissions:', err);
        } finally {
            setLoadingCommissions(false);
        }
    };

    // Fetch project commercial policy when a unit is selected
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

    // Update calculations when unit or UF value changes
    useEffect(() => {
        // Use the monto_reserva_pesos from the policy if available
        const reservaPesos = projectCommercialPolicy?.monto_reserva_pesos || 100000; // Default to 100,000 if not available

        if (ufValue !== null) {
            setPagoReserva(parseFloat((reservaPesos / ufValue).toFixed(2))); // Round to 2 decimals
        }
        
        // Only proceed with complex calculations if a unit is selected
        if (!selectedUnidad) {
            setBonoAmount(0);
            setBonoAmountPct(0);
            setTempBonoAmountPctInput('0.00');
            setPagoBonoPieCotizacion(0);
            setDiscountAmount(0);
            return;
        }

        // Calculate the initial adjusted discount
        const initialAdjustedDiscount = calculateAdjustedDiscount(
            selectedUnidad.valor_lista,
            selectedUnidad.descuento,
            selectedUnidad.proyecto_nombre
        );

        // Calculate the total available bono from the adjusted discount
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
            const bonoPct = (totalEscritura > 0) ? (calculatedInitialTotalBonoUF / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPct.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString());
        } else if (quotationType === 'mix') {
            // In mix mode, discountAmount and bonoAmount (UF) are derived from tempBonoAmountPctInput
            // Initial state for mix is all as bono, no discount unless adjusted by user
            setDiscountAmount(0);
            setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
            
            // Calculate bonoPct based on totalEscritura
            const bonoPct = (totalEscritura > 0) ? (calculatedInitialTotalBonoUF / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPct.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString());
        }

        // Update secondary units when project changes
        if (selectedUnidad.proyecto_nombre) {
            const secondaryUnits = stock.filter(
                unit => unit.proyecto_nombre === selectedUnidad.proyecto_nombre && 
                        unit.tipo_bien !== 'DEPARTAMENTO' &&
                        !addedSecondaryUnits.some(added => added.id === unit.id)
            );
            setProjectSecondaryUnits(secondaryUnits);
        }
    }, [ufValue, selectedUnidad, quotationType, projectCommercialPolicy]);

    // Update calculations when bono amount changes in mix mode
    useEffect(() => {
        if (quotationType === 'mix' && selectedUnidad) {
            const currentBonoUsedUF = pagoBonoPieCotizacion;
            
            // Calculate bonoPct based on totalEscritura
            const bonoPctBasedOnTotalEscritura = (totalEscritura > 0) ? (currentBonoUsedUF / totalEscritura) * 100 : 0;
            setBonoAmountPct(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)));
            setTempBonoAmountPctInput(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)).toString());
            
            // Calculate the remaining available bono in UF from the initial available bono
            const remainingBonoForDiscount = Math.max(0, initialTotalAvailableBono - currentBonoUsedUF);
            
            // Convert the remaining bono (UF) into a discount percentage of the original list value
            let newDiscountPercentage = 0;
            if (selectedUnidad.valor_lista && selectedUnidad.valor_lista > 0) {
                newDiscountPercentage = (remainingBonoForDiscount / selectedUnidad.valor_lista) * 100;
            }
            setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2)));
        }
    }, [pagoBonoPieCotizacion, totalEscritura, initialTotalAvailableBono, quotationType, selectedUnidad]);

    // Function to calculate the adjusted discount by the broker's commission
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

    // Filter units based on selected filters
    const filteredUnits = useMemo(() => {
        return stock.filter(unit => {
            if (filterProyecto !== 'Todos' && unit.proyecto_nombre !== filterProyecto) return false;
            if (filterTipologia !== 'Todos' && unit.tipologia !== filterTipologia) return false;
            return true;
        });
    }, [stock, filterProyecto, filterTipologia]);

    // Get unique project names for filter
    const proyectos = useMemo(() => 
        Array.from(new Set(stock.map(unit => unit.proyecto_nombre))).sort()
    , [stock]);

    // Get unique tipologias for filter
    const tipologias = useMemo(() => {
        if (filterProyecto === 'Todos') {
            return Array.from(new Set(stock
                .filter(unit => unit.tipo_bien === 'DEPARTAMENTO')
                .map(unit => unit.tipologia)
            )).sort();
        } else {
            return Array.from(new Set(stock
                .filter(unit => unit.proyecto_nombre === filterProyecto && unit.tipo_bien === 'DEPARTAMENTO')
                .map(unit => unit.tipologia)
            )).sort();
        }
    }, [stock, filterProyecto]);

    // Sort units
    const sortedUnits = useMemo(() => {
        return [...filteredUnits].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });
    }, [filteredUnits, sortField, sortDirection]);

    // Filter for main units (departamentos)
    const mainUnits = useMemo(() => 
        sortedUnits.filter(unit => unit.tipo_bien === 'DEPARTAMENTO')
    , [sortedUnits]);

    // Filter for secondary units
    const secondaryUnits = useMemo(() => 
        sortedUnits.filter(unit => unit.tipo_bien !== 'DEPARTAMENTO')
    , [sortedUnits]);

    // Handle adding a secondary unit
    const handleAddSecondaryUnit = () => {
        if (!selectedSecondaryUnitToAdd) return;
        
        const unitToAdd = projectSecondaryUnits.find(unit => unit.id === selectedSecondaryUnitToAdd);
        if (unitToAdd) {
            setAddedSecondaryUnits(prev => [...prev, unitToAdd]);
            setSelectedSecondaryUnitToAdd('');
            
            // Update available secondary units
            setProjectSecondaryUnits(prev => 
                prev.filter(unit => unit.id !== selectedSecondaryUnitToAdd)
            );
        }
    };

    // Handle removing a secondary unit
    const handleRemoveAddedSecondaryUnit = (unitId: string) => {
        const unitToRemove = addedSecondaryUnits.find(unit => unit.id === unitId);
        if (unitToRemove) {
            setAddedSecondaryUnits(prev => prev.filter(unit => unit.id !== unitId));
            
            // Add back to available secondary units
            setProjectSecondaryUnits(prev => [...prev, unitToRemove].sort((a, b) => 
                a.unidad.localeCompare(b.unidad)
            ));
        }
    };

    // Functions for handling payment form changes
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

    // Function to apply bono pie percentage changes
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

    // Format currency functions
    const formatCurrency = (amount: number | null): string => {
        if (amount === null || isNaN(amount) || !isFinite(amount)) return '0.00';
        return new Intl.NumberFormat('es-CL', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const ufToPesos = (uf: number | null): string => {
        if (uf === null || ufValue === null || isNaN(uf) || !isFinite(uf) || isNaN(ufValue) || !isFinite(ufValue)) return '$ 0';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(uf * ufValue);
    };

    // Maximum bono percentage allowed based on policy
    const maxBonoPctAllowed = useMemo(() => {
        if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
            return 100;
        }
        const calculatedMaxPct = (initialTotalAvailableBono / totalEscritura) * 100;
        const maxPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convert decimal to percentage

        return parseFloat(Math.min(calculatedMaxPct, maxPctFromPolicy).toFixed(2));
    }, [initialTotalAvailableBono, totalEscritura, selectedUnidad, projectCommercialPolicy]);

    if (isValidating || loadingCommissions || loadingUf || loadingStock || loadingCommercialPolicy) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin h-8 w-8 mr-2 text-blue-600" />
                <span className="text-lg text-gray-700">Cargando datos...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <ShieldX className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-700 mb-2">Acceso Denegado</h1>
                <p className="text-gray-600 mb-6 text-center">{error}</p>
                <button 
                    onClick={() => window.location.href = "https://www.inversiones.cl"}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Volver al sitio principal
                </button>
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
                {/* Tabs Navigation */}
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('principales')}
                            className={`px-4 py-3 text-sm font-medium ${
                                activeTab === 'principales'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Home className="inline-block w-4 h-4 mr-1" />
                            Principales
                        </button>
                        <button
                            onClick={() => setActiveTab('secundarios')}
                            className={`px-4 py-3 text-sm font-medium ${
                                activeTab === 'secundarios'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            disabled={!selectedUnidad}
                        >
                            <LayoutDashboard className="inline-block w-4 h-4 mr-1" />
                            Secundarios
                        </button>
                        <button
                            onClick={() => setActiveTab('configuracion')}
                            className={`px-4 py-3 text-sm font-medium ${
                                activeTab === 'configuracion'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            disabled={!selectedUnidad}
                        >
                            <SlidersHorizontal className="inline-block w-4 h-4 mr-1" />
                            Configuración
                        </button>
                    </div>
                </div>

                {/* Filters for Principales/Secundarios */}
                {(activeTab === 'principales' || activeTab === 'secundarios') && (
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
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="Todos">Todos los proyectos</option>
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
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    disabled={filterProyecto === 'Todos'}
                                >
                                    <option value="Todos">Todas las tipologías</option>
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
                                        className="block w-full border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="unidad">N° Unidad</option>
                                        <option value="tipologia">Tipología</option>
                                        <option value="piso">Piso</option>
                                        <option value="valor_lista">Precio</option>
                                        <option value="sup_util">Superficie Útil</option>
                                    </select>
                                    <button
                                        onClick={() => setSortDirection(!sortDirection)}
                                        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-r-md"
                                    >
                                        {sortDirection ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contenido de la pestaña Principales */}
                {activeTab === 'principales' && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unidad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipología</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piso</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sup. Útil</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {mainUnits.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                            No hay unidades disponibles con los filtros seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    mainUnits.map(unit => (
                                        <tr 
                                            key={unit.id} 
                                            className={`hover:bg-gray-50 ${selectedUnidad?.id === unit.id ? 'bg-blue-50' : ''}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.proyecto_nombre}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.piso}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {unit.sup_util?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} m²
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {unit.valor_lista?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedUnidad(unit);
                                                        setActiveTab('configuracion');
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                                                >
                                                    Seleccionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Contenido de la pestaña Secundarios */}
                {activeTab === 'secundarios' && selectedUnidad && (
                    <div className="space-y-6">
                        {/* Unidades secundarias disponibles */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h2 className="text-lg font-semibold mb-4">Unidades Secundarias Disponibles</h2>
                            
                            <div className="flex space-x-4 mb-4">
                                <select
                                    value={selectedSecondaryUnitToAdd}
                                    onChange={e => setSelectedSecondaryUnitToAdd(e.target.value)}
                                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Seleccione una unidad secundaria</option>
                                    {projectSecondaryUnits.map(unit => (
                                        <option key={unit.id} value={unit.id}>
                                            {unit.tipo_bien} {unit.unidad} - {formatCurrency(unit.valor_lista)} UF
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAddSecondaryUnit}
                                    disabled={!selectedSecondaryUnitToAdd}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <PlusCircle className="h-5 w-5 mr-2" />
                                    Agregar
                                </button>
                            </div>
                            
                            {projectSecondaryUnits.length === 0 && (
                                <p className="text-gray-500 italic">No hay unidades secundarias disponibles para este proyecto</p>
                            )}
                        </div>
                        
                        {/* Unidades secundarias agregadas */}
                        {addedSecondaryUnits.length > 0 && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h2 className="text-lg font-semibold mb-4">Unidades Secundarias Seleccionadas</h2>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unidad</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {addedSecondaryUnits.map(unit => (
                                            <tr key={unit.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.tipo_bien}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                    {formatCurrency(unit.valor_lista)} UF
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        onClick={() => handleRemoveAddedSecondaryUnit(unit.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50">
                                            <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                Total Secundarios
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(precioTotalSecundarios)} UF
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
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
                                                <p className="text-sm text-gray-500">N° Unidad</p>
                                                <p className="font-semibold">{selectedUnidad.unidad}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Tipología</p>
                                                <p className="font-semibold">{selectedUnidad.tipologia}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Piso</p>
                                                <p className="font-semibold">{selectedUnidad.piso}</p>
                                            </div>
                                        </div>
                                    </section>
                                    {/* Sección Superficies */}
                                    <section className="mt-6">
                                        <h3 className="text-lg font-medium mb-2">Superficies</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Sup. Útil</p>
                                                <p className="font-semibold">{formatCurrency(selectedUnidad.sup_util)} m²</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Sup. Terraza</p>
                                                <p className="font-semibold">{formatCurrency(selectedUnidad.sup_terraza)} m²</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Sup. Total</p>
                                                <p className="font-semibold">{formatCurrency(selectedUnidad.sup_total)} m²</p>
                                            </div>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                        {/* Configuración de Cotización */}
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
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Precios</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Precio Base Depto:</span>
                                                <span className="text-sm font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Descuento ({discountAmount.toFixed(2)}%):</span>
                                                <span className="text-sm font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Precio Neto Depto:</span>
                                                <span className="text-sm font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Precio Secundarios:</span>
                                                <span className="text-sm font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                                            </div>
                                            <div className="flex justify-between pt-2 border-t">
                                                <span className="text-sm font-medium text-gray-700">Total Escrituración:</span>
                                                <span className="text-sm font-bold">{formatCurrency(totalEscritura)} UF</span>
                                            </div>
                                            {ufValue && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Equivalente en pesos:</span>
                                                    <span className="text-sm font-medium">{ufToPesos(totalEscritura)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Columna 3: Forma de Pago */}
                                    <div>
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Forma de Pago</h4>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <span className="text-sm text-gray-600">Reserva:</span>
                                                <input
                                                    type="number"
                                                    value={pagoReserva}
                                                    readOnly
                                                    className="col-span-2 px-2 py-1 text-right border border-gray-300 rounded bg-gray-100"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <span className="text-sm text-gray-600">Promesa:</span>
                                                <input
                                                    type="number"
                                                    value={pagoPromesa}
                                                    onChange={e => handlePromesaChange('uf', e.target.value)}
                                                    className="px-2 py-1 text-right border border-gray-300 rounded"
                                                    step="0.01"
                                                    min="0"
                                                />
                                                <div className="flex items-center">
                                                    <input
                                                        type="number"
                                                        value={pagoPromesaPct}
                                                        onChange={e => handlePromesaChange('pct', e.target.value)}
                                                        className="w-full px-2 py-1 text-right border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                    />
                                                    <span className="ml-1">%</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <span className="text-sm text-gray-600">Pie:</span>
                                                <input
                                                    type="number"
                                                    value={pagoPie}
                                                    onChange={e => handlePieChange('uf', e.target.value)}
                                                    className="px-2 py-1 text-right border border-gray-300 rounded"
                                                    step="0.01"
                                                    min="0"
                                                />
                                                <div className="flex items-center">
                                                    <input
                                                        type="number"
                                                        value={pagoPiePct}
                                                        onChange={e => handlePieChange('pct', e.target.value)}
                                                        className="w-full px-2 py-1 text-right border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                    />
                                                    <span className="ml-1">%</span>
                                                </div>
                                            </div>
                                            {(quotationType === 'bono' || quotationType === 'mix') && (
                                                <div className="grid grid-cols-3 gap-2 items-center">
                                                    <span className="text-sm text-gray-600">Bono Pie:</span>
                                                    <input
                                                        type="number"
                                                        value={pagoBonoPieCotizacion}
                                                        onChange={e => {
                                                            const value = parseFloat(e.target.value);
                                                            if (!isNaN(value)) {
                                                                setPagoBonoPieCotizacion(value);
                                                            }
                                                        }}
                                                        className="col-span-2 px-2 py-1 text-right border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                        max={initialTotalAvailableBono}
                                                    />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <span className="text-sm text-gray-600">Crédito:</span>
                                                <input
                                                    type="number"
                                                    value={pagoCreditoHipotecarioCalculado}
                                                    readOnly
                                                    className="col-span-2 px-2 py-1 text-right border border-gray-300 rounded bg-gray-100"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 items-center pt-2 border-t">
                                                <span className="text-sm font-medium text-gray-700">Total:</span>
                                                <span className="col-span-2 text-right font-bold">
                                                    {formatCurrency(totalFormaDePago)} UF
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Botones de Acción */}
                                <div className="mt-6 flex justify-end space-x-4">
                                    <button
                                        onClick={() => setActiveTab('secundarios')}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        Agregar Secundarios
                                    </button>
                                    
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
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 flex items-center"
                                        >
                                            {({ loading }) => (
                                                <>
                                                    {loading ? (
                                                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                                    ) : (
                                                        <Download className="h-5 w-5 mr-2" />
                                                    )}
                                                    Descargar Cotización
                                                </>
                                            )}
                                        </PDFDownloadLink>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className="bg-gray-100 py-4 mt-8">
                <div className="container mx-auto px-4 text-center text-sm text-gray-600">
                    <p>© {new Date().getFullYear()} {brokerInfo?.name}. Todos los derechos reservados.</p>
                    <p className="mt-1">Cotizador desarrollado por InverAPP</p>
                </div>
            </footer>
        </div>
    );
};

export default BrokerQuotePage;