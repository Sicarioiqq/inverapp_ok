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
  Tag
} from 'lucide-react';

// ... (existing interfaces: BrokerInfo, Unidad, BrokerProjectCommission, etc.) ...

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
  const [tempBonoAmountPctInput, setTempBonoAmountPctInput] = useState<string>('0.00');

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

  // --------------------------------------------------
  // Memoizado para totalEscritura, que antes no estaba definido
  const totalEscritura = useMemo(() => {
    if (!selectedUnidad) return 0;
    const valorListaUF = selectedUnidad.valor_lista ?? 0;
    const discountUF = (discountAmount / 100) * valorListaUF;
    const bonusUF = pagoBonoPieCotizacion;
    return parseFloat((valorListaUF - discountUF - bonusUF).toFixed(2));
  }, [selectedUnidad, discountAmount, pagoBonoPieCotizacion]);
  // --------------------------------------------------

  // Carga de policy comercial
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

        if (policyError && policyError.code !== 'PGRST116') throw policyError;
        setProjectCommercialPolicy(data || null);
      } catch (e) {
        console.error('Error loading project commercial policy:', e);
        setProjectCommercialPolicy(null);
      } finally {
        setLoadingCommercialPolicy(false);
      }
    };
    fetchProjectPolicy();
  }, [selectedUnidad?.proyecto_nombre]);

  // Cálculos principales
  useEffect(() => {
    const reservaPesos = projectCommercialPolicy?.monto_reserva_pesos || 100000;
    if (ufValue !== null) {
      setPagoReserva(parseFloat((reservaPesos / ufValue).toFixed(2)));
    }

    if (!selectedUnidad) {
      setBonoAmount(0);
      setBonoAmountPct(0);
      setTempBonoAmountPctInput('0.00');
      setPagoBonoPieCotizacion(0);
      setDiscountAmount(0);
      return;
    }

    const initialAdjustedDiscount = calculateAdjustedDiscount(
      selectedUnidad.valor_lista,
      selectedUnidad.descuento,
      selectedUnidad.proyecto_nombre
    );
    const calculatedInitialTotalBonoUF = (selectedUnidad.valor_lista ?? 0) * (initialAdjustedDiscount ?? 0);
    setInitialTotalAvailableBono(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));

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
    } else if (quotationType === 'mix') {
      setDiscountAmount(0);
      setBonoAmount(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
      setPagoBonoPieCotizacion(parseFloat(calculatedInitialTotalBonoUF.toFixed(2)));
    }

    if (quotationType === 'mix') {
      const currentBonoUsedUF = pagoBonoPieCotizacion;
      const bonoPctBasedOnTotalEscritura = totalEscritura > 0 ? (currentBonoUsedUF / totalEscritura) * 100 : 0;
      setBonoAmountPct(parseFloat(bonoPctBasedOnTotalEscritura.toFixed(2)));
      setTempBonoAmountPctInput(bonoPctBasedOnTotalEscritura.toFixed(2));

      const remainingBonoForDiscountUF = Math.max(0, initialTotalAvailableBono - currentBonoUsedUF);
      let newDiscountPercentage = 0;
      if (selectedUnidad.valor_lista && selectedUnidad.valor_lista > 0) {
        newDiscountPercentage = (remainingBonoForDiscountUF / selectedUnidad.valor_lista) * 100;
      }
      setDiscountAmount(parseFloat(newDiscountPercentage.toFixed(2)));
    } else if (quotationType === 'bono') {
      const bonoPct = totalEscritura > 0 ? (bonoAmount / totalEscritura) * 100 : 0;
      setBonoAmountPct(parseFloat(bonoPct.toFixed(2)));
      setTempBonoAmountPctInput(parseFloat(bonoPct.toFixed(2)).toString());
    } else {
      setPagoBonoPieCotizacion(0);
      setBonoAmountPct(0);
      setTempBonoAmountPctInput('0.00');
      setBonoAmount(0);
    }

  }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]);

  // calculateAdjustedDiscount (sin cambios)

  // Resto de handlers, formateos y renderizado (sin cambios)...

  if (isValidating || loadingCommissions || loadingUf || loadingStock || loadingCommercialPolicy) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" /> Cargando datos...
      </div>
    );
  }

  // ... return JSX completo (sin cambios significativos) ...

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER, MAIN y demás JSX tal como estaba, usando totalEscritura donde corresponda */}
    </div>
  );
};

export default BrokerQuotePage;
