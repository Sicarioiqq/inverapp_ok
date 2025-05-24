import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useUFStore } from '../../stores/ufStore';
import { Building, Home, DollarSign, Calculator, Download, Check, X, Search, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';

// Interfaces
interface StockUnidad {
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
  estado_unidad: string;
  descuento: number | null;
}

interface Broker {
  id: string;
  name: string;
  business_name: string;
  slug: string;
  public_access_token: string;
}

interface ProjectCommercialPolicy {
  project_name: string;
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
  observaciones: string | null;
  comuna: string | null;
}

// Validate broker access
const validateBroker = async (slug: string, token: string): Promise<Broker | null> => {
  const { data, error } = await supabase
    .from('brokers')
    .select('*')
    .eq('slug', slug)
    .eq('public_access_token', token)
    .single();
  if (error) throw new Error('Acceso denegado: token inválido');
  return data;
};

// Fetch commercial policy
const fetchCommercialPolicy = async (projectName: string) => {
  const { data, error } = await supabase
    .from('project_commercial_policies')
    .select('*')
    .eq('project_name', projectName)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const { ufValue, fetchUFValue } = useUFStore();

  // State
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<StockUnidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnidad | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnidadesDropdown, setShowUnidadesDropdown] = useState(false);
  const [showSecondaryUnitsDropdown, setShowSecondaryUnitsDropdown] = useState(false);
  const [commercialPolicy, setCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'principales' | 'secundarios' | 'configuracion'>('principales');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');

  // New: map of commission rates by project
  const [commissionRatesMap, setCommissionRatesMap] = useState<Record<string, number>>({});

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bonoAmount, setBonoAmount] = useState(0);
  const [pagoReserva, setPagoReserva] = useState(0);
  const [pagoPromesa, setPagoPromesa] = useState(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState(0);
  const [pagoPie, setPagoPie] = useState(0);
  const [pagoPiePct, setPagoPiePct] = useState(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState(0);

  // Fetch UF on mount
  useEffect(() => { fetchUFValue(); }, [fetchUFValue]);

  // Initialize: validate broker, fetch units, fetch commissions
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        if (!brokerSlug || !accessToken) throw new Error('Parámetros de acceso inválidos');

        const b = await validateBroker(brokerSlug, accessToken);
        setBroker(b);

        // Fetch all units
        await (async () => {
          let all: StockUnidad[] = [];
          let from = 0;
          const size = 1000;
          while (true) {
            const { data, error } = await supabase
              .from('stock_unidades')
              .select('*')
              .eq('estado_unidad', 'Disponible')
              .range(from, from + size - 1)
              .order('proyecto_nombre', { ascending: true })
              .order('unidad', { ascending: true });
            if (error) throw error;
            if (data?.length) { all.push(...data); if (data.length < size) break; from += size; } else break;
          }
          setUnidades(all);
        })();

        // Fetch commission rates for this broker
        const { data: commissions } = await supabase
          .from('broker_project_commissions')
          .select('project_name, commission_rate')
          .eq('broker_id', b!.id);
        const map = (commissions || []).reduce((m, { project_name, commission_rate }) => {
          m[project_name] = commission_rate;
          return m;
        }, {} as Record<string, number>);
        setCommissionRatesMap(map);

      } catch (err: any) {
        setError(err.message || 'Error al inicializar');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [brokerSlug, accessToken, fetchUFValue]);

  // Fetch commercial policy on unit select
  useEffect(() => {
    if (!selectedUnidad) return;
    (async () => {
      const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
      setCommercialPolicy(policy);
      if (policy && ufValue) {
        setPagoReserva(parseFloat((policy.monto_reserva_pesos / ufValue).toFixed(2)));
        setPagoBonoPieCotizacion(0);
      }
      // Reset other payment fields
      setPagoPromesa(0);
      setPagoPromesaPct(0);
      setPagoPie(0);
    })();
  }, [selectedUnidad, ufValue]);

  // Unique filters
  const uniqueProjects = useMemo(() => Array.from(new Set(unidades.map(u => u.proyecto_nombre))), [unidades]);
  const uniqueTipologias = useMemo(() => selectedProject
    ? Array.from(new Set(unidades.filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO').map(u => u.tipologia!).filter(Boolean)))
    : [],
  [unidades, selectedProject]);

  // Filter and sort unidades
  const filteredUnidades = useMemo(() => {
    let f = unidades;
    if (selectedProject) f = f.filter(u => u.proyecto_nombre === selectedProject);
    if (selectedTipologia && activeTab === 'principales') f = f.filter(u => u.tipologia === selectedTipologia);
    if (activeTab === 'principales') f = f.filter(u => u.tipo_bien === 'DEPARTAMENTO');
    else if (activeTab === 'secundarios') f = f.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(u => u.proyecto_nombre.toLowerCase().includes(t)
        || u.unidad.toLowerCase().includes(t)
        || (u.tipologia || '').toLowerCase().includes(t)
        || u.tipo_bien.toLowerCase().includes(t));
    }
    if (sortField) {
      f = [...f].sort((a, b) => {
        let aVal: any = a[sortField as keyof StockUnidad] || '';
        let bVal: any = b[sortField as keyof StockUnidad] || '';
        let cmp = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return f;
  }, [unidades, selectedProject, selectedTipologia, searchTerm, sortField, sortDirection, activeTab]);

  // Secondary units
  const availableSecondaryUnits = useMemo(() => !selectedUnidad ? [] : unidades.filter(u =>
    u.proyecto_nombre === selectedUnidad.proyecto_nombre &&
    u.tipo_bien !== 'DEPARTAMENTO' &&
    !addedSecondaryUnits.some(a => a.id === u.id)
  ), [unidades, selectedUnidad, addedSecondaryUnits]);

  // Price calculations
  const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
  const precioDescuentoDepartamento = useMemo(() =>
    (quotationType === 'descuento' || quotationType === 'mix')
      ? precioBaseDepartamento * (discountAmount / 100)
      : 0,
  [precioBaseDepartamento, quotationType, discountAmount]);
  const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
  const precioTotalSecundarios = useMemo(() =>
    addedSecondaryUnits.reduce((sum, u) => sum + (u.valor_lista || 0), 0), [addedSecondaryUnits]);
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;

  // Payment calculations
  const pagoCreditoHipotecarioCalculado = Math.max(0,
    totalEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion)
  );
  const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

  // Calculate broker discount available per unidad
  const calculateBrokerDiscount = (unidad: StockUnidad): number => {
    const originalDiscount = unidad.descuento ?? 0;
    const precioOriginal = unidad.valor_lista;
    const precioMinimo = precioOriginal * (1 - originalDiscount / 100);
    const commissionRate = commissionRatesMap[unidad.proyecto_nombre] ?? 0;
    const comisionBroker = precioMinimo * (commissionRate / 100);
    const precioConComision = precioMinimo + comisionBroker;
    const montoDescuentoDisponible = precioOriginal - precioConComision;
    return Math.max(0, (montoDescuentoDisponible / precioOriginal) * 100);
  };

  // ... (rest of handlers and UI remain unchanged) ...

  // Rendering logic, headers, tabs, tables, etc. remain exactly as before,
  // only now the "Descuento" column uses calculateBrokerDiscount(unidad) instead of unidad.descuento.
};

export default BrokerQuotePage;
