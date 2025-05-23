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
  Calendar, 
  Tag,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

// Interfaces
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
  tipologia: string;
  piso: string;
  orientacion: string | null;
  etapa: number | null;
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

// Project Commercial Policy interface
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

    // State for project commercial policy
    const [projectCommercialPolicy, setProjectCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
    const [loadingCommercialPolicy, setLoadingCommercialPolicy] = useState(false);

    const [ufValue, setUfValue] = useState<number | null>(null);
    const [loadingUf, setLoadingUf] = useState(true);

    // Sorting state
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

    // Validate broker and load data
    useEffect(() => {
        const validateBroker = async () => {
            setIsValidating(true);
            try {
                // Validate broker access token
                const { data: brokerData, error: brokerError } = await supabase
                    .from('brokers')
                    .select('id, name, business_name, public_access_token')
                    .eq('slug', brokerSlug)
                    .eq('public_access_token', accessToken)
                    .single();

                if (brokerError || !brokerData) {
                    throw new Error('Broker no encontrado o token inválido');
                }

                setBrokerInfo(brokerData);

                // Load broker commissions
                await loadBrokerCommissions(brokerData.id);

                // Load UF value
                await loadUFValue();

                // Load stock data
                await loadStockData();

            } catch (e) {
                console.error('Error validating broker:', e);
                setError('Acceso no autorizado. Por favor contacte al administrador.');
            } finally {
                setIsValidating(false);
            }
        };

        if (brokerSlug && accessToken) {
            validateBroker();
        } else {
            setError('Parámetros de acceso inválidos');
            setIsValidating(false);
        }
    }, [brokerSlug, accessToken]);

    // Load UF value
    const loadUFValue = async () => {
        setLoadingUf(true);
        try {
            const { data, error } = await supabase
                .from('valores_financieros')
                .select('valor, fecha')
                .eq('nombre', 'UF')
                .order('fecha', { ascending: false })
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) {
                setUfValue(data[0].valor);
            }
        } catch (e) {
            console.error('Error loading UF value:', e);
        } finally {
            setLoadingUf(false);
        }
    };

    // Load broker commissions
    const loadBrokerCommissions = async (brokerId: string) => {
        setLoadingCommissions(true);
        try {
            const { data, error } = await supabase
                .from('broker_project_commissions')
                .select('*')
                .eq('broker_id', brokerId);

            if (error) throw error;
            setBrokerCommissions(data || []);
        } catch (e) {
            console.error('Error loading broker commissions:', e);
        } finally {
            setLoadingCommissions(false);
        }
    };

    // Load stock data - modified to load all data in batches
    const loadStockData = async () => {
        setLoadingStock(true);
        try {
            const batchSize = 1000; // Supabase max per request
            let allStock: Unidad[] = [];
            let hasMore = true;
            let from = 0;
            
            while (hasMore) {
                const { data, error, count } = await supabase
                    .from('stock_unidades')
                    .select('*', { count: 'exact' })
                    .range(from, from + batchSize - 1);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    allStock = [...allStock, ...data];
                    from += batchSize;
                    
                    // Check if we've loaded all data
                    if (data.length < batchSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
            
            setStock(allStock);
            
            // Get the latest stock load date
            const { data: stockDateData } = await supabase
                .from('stock_unidades')
                .select('fecha_carga')
                .order('fecha_carga', { ascending: false })
                .limit(1);
                
            if (stockDateData && stockDateData.length > 0) {
                setStockLoadDate(stockDateData[0].fecha_carga);
            }
            
        } catch (e) {
            console.error('Error loading stock data:', e);
            setError('Error al cargar datos de stock');
        } finally {
            setLoadingStock(false);
        }
    };

    // Load commercial policy when a unit is selected
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

    // Update reservation amount and other calculations when unit or policy changes
    useEffect(() => {
        // Use the reservation amount from the policy, or default to 100,000 if not available
        const reservaPesos = projectCommercialPolicy?.monto_reserva_pesos || 100000;

        if (ufValue !== null) {
            setPagoReserva(parseFloat((reservaPesos / ufValue).toFixed(2))); // Round to 2 decimals
        }
        
        // Ensure selectedUnidad is valid before proceeding with complex calculations
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

    }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]);

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

    // Filter units based on selected filters
    const filteredUnits = useMemo(() => {
        return stock.filter(unit => {
            if (filterProyecto !== 'Todos' && unit.proyecto_nombre !== filterProyecto) {
                return false;
            }
            if (filterTipologia !== 'Todos' && unit.tipologia !== filterTipologia) {
                return false;
            }
            return unit.estado_unidad === 'Disponible';
        });
    }, [stock, filterProyecto, filterTipologia]);

    // Sort units based on sort field and direction
    const sortedUnits = useMemo(() => {
        return [...filteredUnits].sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];
            
            // Handle null values
            if (aValue === null && bValue === null) return 0;
            if (aValue === null) return 1;
            if (bValue === null) return -1;
            
            // Compare based on type
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else {
                // For numbers and other types
                return sortAsc ? 
                    (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) : 
                    (bValue < aValue ? -1 : bValue > aValue ? 1 : 0);
            }
        });
    }, [filteredUnits, sortField, sortAsc]);

    // Get unique project names for filter
    const proyectos = useMemo(() => {
        const uniqueProyectos = Array.from(new Set(stock.map(unit => unit.proyecto_nombre)));
        return ['Todos', ...uniqueProyectos.filter(Boolean) as string[]];
    }, [stock]);

    // Get unique tipologias for the selected project
    const tipologias = useMemo(() => {
        if (filterProyecto === 'Todos') {
            return ['Todos'];
        }
        
        const projectUnits = stock.filter(unit => 
            unit.proyecto_nombre === filterProyecto && 
            unit.tipo_bien === 'DEPARTAMENTO'
        );
        
        const uniqueTipologias = Array.from(new Set(projectUnits.map(unit => unit.tipologia)));
        return ['Todos', ...uniqueTipologias.filter(Boolean) as string[]];
    }, [stock, filterProyecto]);

    // Update secondary units when project changes
    useEffect(() => {
        if (selectedUnidad) {
            const projectSecondaries = stock.filter(unit => 
                unit.proyecto_nombre === selectedUnidad.proyecto_nombre && 
                unit.tipo_bien !== 'DEPARTAMENTO' &&
                unit.estado_unidad === 'Disponible'
            );
            setProjectSecondaryUnits(projectSecondaries);
        } else {
            setProjectSecondaryUnits([]);
        }
    }, [selectedUnidad, stock]);

    // Handle adding a secondary unit
    const handleAddSecondaryUnit = () => {
        if (!selectedSecondaryUnitToAdd) return;
        
        const unitToAdd = projectSecondaryUnits.find(unit => unit.id === selectedSecondaryUnitToAdd);
        if (!unitToAdd) return;
        
        // Check if already added
        if (addedSecondaryUnits.some(unit => unit.id === unitToAdd.id)) {
            return;
        }
        
        setAddedSecondaryUnits([...addedSecondaryUnits, unitToAdd]);
        setSelectedSecondaryUnitToAdd('');
    };

    // Handle removing a secondary unit
    const handleRemoveAddedSecondaryUnit = (unitId: string) => {
        setAddedSecondaryUnits(addedSecondaryUnits.filter(unit => unit.id !== unitId));
    };

    // Calculate prices
    const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
    
    const precioDescuentoDepartamento = useMemo(() => {
        if (!selectedUnidad?.valor_lista) return 0;
        return selectedUnidad.valor_lista * (discountAmount / 100);
    }, [selectedUnidad, discountAmount]);
    
    const precioDepartamentoConDescuento = useMemo(() => {
        if (!selectedUnidad?.valor_lista) return 0;
        return selectedUnidad.valor_lista - precioDescuentoDepartamento;
    }, [selectedUnidad, precioDescuentoDepartamento]);
    
    const precioTotalSecundarios = useMemo(() => {
        return addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
    }, [addedSecondaryUnits]);
    
    const totalEscritura = useMemo(() => {
        return precioDepartamentoConDescuento + precioTotalSecundarios;
    }, [precioDepartamentoConDescuento, precioTotalSecundarios]);

    // Calculate payment amounts
    useEffect(() => {
        if (totalEscritura > 0) {
            // Update promesa percentage
            const newPromesaPct = (pagoPromesa / totalEscritura) * 100;
            setPagoPromesaPct(parseFloat(newPromesaPct.toFixed(2)));
            
            // Update pie percentage
            const newPiePct = (pagoPie / totalEscritura) * 100;
            setPagoPiePct(parseFloat(newPiePct.toFixed(2)));
        } else {
            setPagoPromesaPct(0);
            setPagoPiePct(0);
        }
    }, [pagoPromesa, pagoPie, totalEscritura]);

    // Calculate credit payment
    const pagoCreditoHipotecarioCalculado = useMemo(() => {
        return totalEscritura - pagoReserva - pagoPromesa - pagoPie - pagoBonoPieCotizacion;
    }, [totalEscritura, pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion]);

    // Calculate total payment form
    const totalFormaDePago = useMemo(() => {
        return pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;
    }, [pagoReserva, pagoPromesa, pagoPie, pagoCreditoHipotecarioCalculado, pagoBonoPieCotizacion]);

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
    const maxBonoPctAllowed = useMemo(() => {
        if (!selectedUnidad || selectedUnidad.valor_lista === null || selectedUnidad.valor_lista === 0 || totalEscritura <= 0) {
            return 100;
        }
        const calculatedMaxPct = (initialTotalAvailableBono / totalEscritura) * 100;
        const maxPctFromPolicy = (projectCommercialPolicy?.bono_pie_max_pct ?? 1.00) * 100; // Convert decimal to percentage

        return parseFloat(Math.min(calculatedMaxPct, maxPctFromPolicy).toFixed(2));
    }, [initialTotalAvailableBono, totalEscritura, selectedUnidad, projectCommercialPolicy]);

    // Handle sorting
    const handleSort = (field: keyof Unidad) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    // Render sort indicator
    const renderSortIndicator = (field: keyof Unidad) => {
        if (sortField !== field) return null;
        return sortAsc ? <ChevronUp className="h-4 w-4 inline-block" /> : <ChevronDown className="h-4 w-4 inline-block" />;
    };

    if (isValidating || loadingCommissions || loadingUf || loadingStock || loadingCommercialPolicy)
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin" /> Cargando datos...
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
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Volver al Inicio
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
                {/* Tabs */}
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="flex border-b">
                        <button
                            className={`px-4 py-3 text-sm font-medium ${activeTab === 'principales' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('principales')}
                        >
                            <Home className="inline-block w-4 h-4 mr-1" /> Unidades Principales
                        </button>
                        <button
                            className={`px-4 py-3 text-sm font-medium ${activeTab === 'secundarios' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('secundarios')}
                            disabled={!selectedUnidad}
                        >
                            <LayoutDashboard className="inline-block w-4 h-4 mr-1" /> Unidades Secundarias
                        </button>
                        <button
                            className={`px-4 py-3 text-sm font-medium ${activeTab === 'configuracion' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('configuracion')}
                            disabled={!selectedUnidad}
                        >
                            <SlidersHorizontal className="inline-block w-4 h-4 mr-1" /> Configuración
                        </button>
                    </div>
                </div>

                {/* Contenido de la pestaña de Unidades Principales */}
                {activeTab === 'principales' && (
                    <>
                        <div className="bg-white shadow rounded-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold mb-4">Filtros</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                                    <select
                                        value={filterProyecto}
                                        onChange={e => {
                                            setFilterProyecto(e.target.value);
                                            setFilterTipologia('Todos');
                                            setSelectedUnidad(null);
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                        onChange={e => {
                                            setFilterTipologia(e.target.value);
                                            setSelectedUnidad(null);
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={filterProyecto === 'Todos'}
                                    >
                                        {tipologias.map(tipologia => (
                                            <option key={tipologia} value={tipologia}>{tipologia}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th 
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('proyecto_nombre')}
                                            >
                                                Proyecto {renderSortIndicator('proyecto_nombre')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('unidad')}
                                            >
                                                N° Bien {renderSortIndicator('unidad')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('tipologia')}
                                            >
                                                Tipología {renderSortIndicator('tipologia')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('piso')}
                                            >
                                                Piso {renderSortIndicator('piso')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('orientacion')}
                                            >
                                                Orientación {renderSortIndicator('orientacion')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('sup_util')}
                                            >
                                                Sup. Útil {renderSortIndicator('sup_util')}
                                            </th>
                                            <th 
                                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                                onClick={() => handleSort('valor_lista')}
                                            >
                                                Valor UF {renderSortIndicator('valor_lista')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedUnits.map(unit => (
                                            <tr 
                                                key={unit.id} 
                                                className={`hover:bg-gray-50 cursor-pointer ${selectedUnidad?.id === unit.id ? 'bg-blue-50' : ''}`}
                                                onClick={() => setSelectedUnidad(unit)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.proyecto_nombre}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.piso}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.orientacion}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{unit.sup_util?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{unit.valor_lista?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Contenido de la pestaña de Unidades Secundarias */}
                {activeTab === 'secundarios' && selectedUnidad && (
                    <>
                        <div className="bg-white shadow rounded-lg p-6 mb-6">
                            <h2 className="text-lg font-semibold mb-4">Agregar Unidades Secundarias</h2>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-grow">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Unidad</label>
                                    <select
                                        value={selectedSecondaryUnitToAdd}
                                        onChange={e => setSelectedSecondaryUnitToAdd(e.target.value)}
                                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Seleccione una unidad secundaria</option>
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
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <PlusCircle className="h-5 w-5 mr-2" /> Agregar
                                </button>
                            </div>
                        </div>

                        {addedSecondaryUnits.length > 0 && (
                            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                                <h2 className="text-lg font-semibold p-6 border-b">Unidades Secundarias Agregadas</h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Bien</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor UF</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {addedSecondaryUnits.map(unit => (
                                                <tr key={unit.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.tipo_bien}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{unit.valor_lista?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
                                                <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Secundarios</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(precioTotalSecundarios)} UF</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
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
                                    
                                    {/* Sección Proyecto y Política Comercial */}
                                    <div className="bg-white p-4 rounded border-b pb-4 mb-6">
                                        <h3 className="text-lg font-medium mb-2">Política Comercial</h3>
                                        <p><span className="font-semibold">Proyecto:</span> {selectedUnidad.proyecto_nombre}</p>
                                        {projectCommercialPolicy && (
                                            <div className="mt-2 text-sm text-gray-600">
                                                <p className="flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-500" /> Fecha Tope: <span className="font-semibold ml-1">
                                                    {projectCommercialPolicy.fecha_tope ? new Date(projectCommercialPolicy.fecha_tope).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                                                </span></p>
                                                <p className="flex items-center mt-1"><Tag className="h-4 w-4 mr-1 text-gray-500" /> Bono Pie Máximo (Política): <span className="font-semibold ml-1">
                                                    {projectCommercialPolicy.bono_pie_max_pct !== null ? `${(projectCommercialPolicy.bono_pie_max_pct).toFixed(2)}%` : 'N/A'}
                                                </span></p>
                                                {projectCommercialPolicy.comuna && (
                                                    <p className="mt-1">Comuna: <span className="font-semibold">{projectCommercialPolicy.comuna}</span></p>
                                                )}
                                                {projectCommercialPolicy.observaciones && (
                                                    <p className="mt-1">Observaciones: <span className="font-semibold">{projectCommercialPolicy.observaciones}</span></p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Sección Unidad */}
                                    <section className="mt-6 border-b pb-4">
                                        <h3 className="text-lg font-medium mb-2">Unidad</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <p><span className="font-semibold">N° Bien:</span> {selectedUnidad.unidad}</p>
                                            <p><span className="font-semibold">Tipología:</span> {selectedUnidad.tipologia}</p>
                                            <p><span className="font-semibold">Piso:</span> {selectedUnidad.piso}</p>
                                            <p><span className="font-semibold">Orientación:</span> {selectedUnidad.orientacion || 'N/A'}</p>
                                        </div>
                                    </section>
                                    
                                    {/* Sección Superficies */}
                                    <section className="mt-6 border-b pb-4">
                                        <h3 className="text-lg font-medium mb-2">Superficies</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <p><span className="font-semibold">Sup. Interior:</span> {selectedUnidad.sup_interior?.toFixed(2) || 'N/A'} m²</p>
                                            <p><span className="font-semibold">Sup. Útil:</span> {selectedUnidad.sup_util?.toFixed(2) || 'N/A'} m²</p>
                                            <p><span className="font-semibold">Sup. Terraza:</span> {selectedUnidad.sup_terraza?.toFixed(2) || 'N/A'} m²</p>
                                            <p><span className="font-semibold">Sup. Total:</span> {selectedUnidad.sup_total?.toFixed(2) || 'N/A'} m²</p>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                        {/* NUEVA TARJETA: Configuración de Cotización (Separada) */}
                        {selectedUnidad && (
                            <div className="bg-white shadow rounded p-6 mb-6">
                                <h3 className="text-xl font-semibold mb-4">Configuración de Cotización</h3>

                                <div>
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
                                <div className="space-y-4 mt-4">
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
                        )}

                        {/* NUEVA TARJETA: Precios */}
                        {selectedUnidad && (
                            <div className="bg-white shadow rounded p-6 mb-6">
                                <h3 className="text-xl font-semibold mb-4">Precios</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Columna de Precios */}
                                    <div>
                                        <h4 className="text-lg font-medium mb-3">Precios</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Precio Base Departamento:</span>
                                                <span className="font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Descuento ({discountAmount.toFixed(2)}%):</span>
                                                <span className="font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Precio Departamento con Descuento:</span>
                                                <span className="font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                                            </div>
                                            
                                            {addedSecondaryUnits.length > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Precio Total Secundarios:</span>
                                                    <span className="font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between pt-2 border-t border-gray-200">
                                                <span className="text-gray-800 font-semibold">Total Escritura:</span>
                                                <span className="font-bold text-blue-700">{formatCurrency(totalEscritura)} UF</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-gray-500">
                                                <span>Equivalente en pesos:</span>
                                                <span>{ufToPesos(totalEscritura)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Columna de Forma de Pago */}
                                    <div>
                                        <h4 className="text-lg font-medium mb-3">Forma de Pago</h4>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-gray-600">Glosa</div>
                                                <div className="text-gray-600 text-center">%</div>
                                                <div className="text-gray-600 text-right">UF</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <div className="text-gray-600">Reserva</div>
                                                <div className="text-center">
                                                    {totalEscritura > 0 ? formatCurrency((pagoReserva / totalEscritura) * 100) : '0.00'}%
                                                </div>
                                                <div className="text-right font-medium">{formatCurrency(pagoReserva)}</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <div className="text-gray-600">Promesa</div>
                                                <div className="text-center">
                                                    <input
                                                        type="number"
                                                        value={pagoPromesaPct}
                                                        onChange={(e) => handlePromesaChange('pct', e.target.value)}
                                                        className="w-16 text-center border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                    />%
                                                </div>
                                                <div className="text-right">
                                                    <input
                                                        type="number"
                                                        value={pagoPromesa}
                                                        onChange={(e) => handlePromesaChange('uf', e.target.value)}
                                                        className="w-20 text-right border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <div className="text-gray-600">Pie</div>
                                                <div className="text-center">
                                                    <input
                                                        type="number"
                                                        value={pagoPiePct}
                                                        onChange={(e) => handlePieChange('pct', e.target.value)}
                                                        className="w-16 text-center border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                    />%
                                                </div>
                                                <div className="text-right">
                                                    <input
                                                        type="number"
                                                        value={pagoPie}
                                                        onChange={(e) => handlePieChange('uf', e.target.value)}
                                                        className="w-20 text-right border border-gray-300 rounded"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {pagoBonoPieCotizacion > 0 && (
                                                <div className="grid grid-cols-3 gap-2 items-center">
                                                    <div className="text-gray-600">Bono Pie</div>
                                                    <div className="text-center">
                                                        {totalEscritura > 0 ? formatCurrency((pagoBonoPieCotizacion / totalEscritura) * 100) : '0.00'}%
                                                    </div>
                                                    <div className="text-right font-medium">{formatCurrency(pagoBonoPieCotizacion)}</div>
                                                </div>
                                            )}
                                            
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <div className="text-gray-600">Crédito Hipotecario</div>
                                                <div className="text-center">
                                                    {totalEscritura > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalEscritura) * 100) : '0.00'}%
                                                </div>
                                                <div className="text-right font-medium">{formatCurrency(pagoCreditoHipotecarioCalculado)}</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 items-center pt-2 border-t border-gray-200">
                                                <div className="text-gray-800 font-semibold">TOTAL</div>
                                                <div className="text-center font-medium">
                                                    {totalEscritura > 0 ? formatCurrency((totalFormaDePago / totalEscritura) * 100) : '0.00'}%
                                                </div>
                                                <div className="text-right font-bold text-blue-700">{formatCurrency(totalFormaDePago)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Botones de Acción */}
                        {selectedUnidad && (
                            <div className="flex justify-end space-x-4 mb-6">
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
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                                >
                                    {({ loading }) => (
                                        loading ? 
                                        <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Generando PDF...</> : 
                                        <><Download className="h-5 w-5 mr-2" /> Descargar Cotización</>
                                    )}
                                </PDFDownloadLink>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className="bg-gray-800 text-white py-6">
                <div className="container mx-auto px-4 text-center">
                    <p>© {new Date().getFullYear()} {brokerInfo?.name}. Todos los derechos reservados.</p>
                    <p className="text-sm mt-2 text-gray-400">Cotizador desarrollado por InverAPP</p>
                </div>
            </footer>
        </div>
    );
};

export default BrokerQuotePage;