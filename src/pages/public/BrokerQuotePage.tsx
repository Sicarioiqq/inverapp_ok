import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useUFStore } from '../../stores/ufStore';
import { Building, Home, DollarSign, Calculator, Download, X, Search, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';

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

// Validar acceso del broker
const validateBroker = async (slug: string, token: string): Promise<Broker> => {
  const { data, error } = await supabase
    .from('brokers')
    .select('*')
    .eq('slug', slug)
    .eq('public_access_token', token)
    .single();
  if (error) throw new Error('Acceso denegado: token inválido');
  return data;
};

// Obtener política comercial
const fetchCommercialPolicy = async (projectName: string): Promise<ProjectCommercialPolicy | null> => {
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

  // Estados generales
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
  const [commissionRatesMap, setCommissionRatesMap] = useState<Record<string, number>>({});

  // Estados del formulario
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

  // Carga inicial de UF
  useEffect(() => { fetchUFValue(); }, [fetchUFValue]);

  // Inicializar página: validar broker, cargar unidades, cargar comisiones
  useEffect(() => {
    const initialize = async () => {
      try {
        if (!brokerSlug || !accessToken) throw new Error('Parámetros de acceso inválidos');
        setLoading(true);

        // Validar broker
        const b = await validateBroker(brokerSlug, accessToken);
        setBroker(b);

        // Cargar unidades disponibles con paginación
        let allUnits: StockUnidad[] = [];
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
          if (!data || data.length === 0) break;
          allUnits = [...allUnits, ...data];
          if (data.length < size) break;
          from += size;
        }
        setUnidades(allUnits);

        // Cargar comisiones del broker por proyecto
        const { data: commissions } = await supabase
          .from('broker_project_commissions')
          .select('project_name, commission_rate')
          .eq('broker_id', b.id);
        const map: Record<string, number> = {};
        commissions?.forEach(({ project_name, commission_rate }) => {
          map[project_name] = commission_rate;
        });
        setCommissionRatesMap(map);
      } catch (err: any) {
        setError(err.message || 'Error al inicializar la página');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [brokerSlug, accessToken]);

  // Al seleccionar unidad, cargar política comercial y resetear pagos
  useEffect(() => {
    if (!selectedUnidad) return;
    (async () => {
      const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
      setCommercialPolicy(policy);
      if (policy && ufValue) {
        setPagoReserva(parseFloat((policy.monto_reserva_pesos / ufValue).toFixed(2)));
      }
      setPagoPromesa(0);
      setPagoPromesaPct(0);
      setPagoPie(0);
      setPagoPiePct(0);
      setPagoBonoPieCotizacion(0);
      setAddedSecondaryUnits([]);
    })();
  }, [selectedUnidad, ufValue]);

  // Datos únicos para filtros
  const uniqueProjects = useMemo(() => Array.from(new Set(unidades.map(u => u.proyecto_nombre))), [unidades]);
  const uniqueTipologias = useMemo(() => selectedProject
    ? Array.from(new Set(unidades.filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO').map(u => u.tipologia).filter(Boolean) as string[]))
    : [],
  [unidades, selectedProject]);

  // Filtrado y ordenamiento de unidades
  const filteredUnidades = useMemo(() => {
    let f = unidades;
    if (selectedProject) f = f.filter(u => u.proyecto_nombre === selectedProject);
    if (activeTab === 'principales') {
      f = f.filter(u => u.tipo_bien === 'DEPARTAMENTO');
      if (selectedTipologia) f = f.filter(u => u.tipologia === selectedTipologia);
    } else if (activeTab === 'secundarios') {
      f = f.filter(u => u.tipo_bien !== 'DEPARTAMENTO');
    }
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(u =>
        u.proyecto_nombre.toLowerCase().includes(t) ||
        u.unidad.toLowerCase().includes(t) ||
        (u.tipologia || '').toLowerCase().includes(t) ||
        u.tipo_bien.toLowerCase().includes(t)
      );
    }
    if (sortField) {
      f = [...f].sort((a, b) => {
        let aVal: any = a[sortField as keyof StockUnidad] ?? '';
        let bVal: any = b[sortField as keyof StockUnidad] ?? '';
        let cmp = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return f;
  }, [unidades, activeTab, selectedProject, selectedTipologia, searchTerm, sortField, sortDirection]);

  // Unidades secundarias disponibles
  const availableSecondaryUnits = useMemo(() => selectedUnidad
    ? unidades.filter(u =>
        u.proyecto_nombre === selectedUnidad.proyecto_nombre &&
        u.tipo_bien !== 'DEPARTAMENTO' &&
        !addedSecondaryUnits.some(a => a.id === u.id)
      )
    : [],
  [unidades, selectedUnidad, addedSecondaryUnits]);

  // Cálculos de precio
  const precioBaseDepartamento = selectedUnidad?.valor_lista ?? 0;
  const precioDescuentoDepartamento = useMemo(() =>
    (quotationType === 'descuento' || quotationType === 'mix')
      ? precioBaseDepartamento * (discountAmount / 100)
      : 0,
  [precioBaseDepartamento, quotationType, discountAmount]);
  const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
  const precioTotalSecundarios = useMemo(() =>
    addedSecondaryUnits.reduce((sum, u) => sum + (u.valor_lista ?? 0), 0), [addedSecondaryUnits]);
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;

  const pagoCreditoHipotecarioCalculado = useMemo(() =>
    Math.max(0, totalEscritura - (pagoReserva + pagoPromesa + pagoPie + pagoBonoPieCotizacion)),
  [totalEscritura, pagoReserva, pagoPromesa, pagoPie, pagoBonoPieCotizacion]);
  const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

  // Cálculo de descuento disponible para el broker
  const calculateBrokerDiscount = (unidad: StockUnidad): number => {
    const originalDiscountPct = unidad.descuento ?? 0;
    const precioOriginal = unidad.valor_lista;
    // Precio mínimo tras descuento base
    const precioMinimo = precioOriginal * (1 - originalDiscountPct / 100);
    // Tasa de comisión del broker para este proyecto (en %)
    const commissionRate = commissionRatesMap[unidad.proyecto_nombre] ?? 0;
    // Comisión en UF
    const comisionBroker = precioMinimo * (commissionRate / 100);
    // Suma precio mínimo + comisión
    const precioConComision = precioMinimo + comisionBroker;
    // Monto disponible para descuento
    const montoDescuentoDisponible = precioOriginal - precioConComision;
    // Porcentaje respecto al precio original
    return Math.max(0, (montoDescuentoDisponible / precioOriginal) * 100);
  };

  // Handlers
  const handleSelectUnidad = (u: StockUnidad) => {
    setSelectedUnidad(u);
    setActiveTab('configuracion');
    setSearchTerm('');
    setShowUnidadesDropdown(false);
  };
  const handleAddSecondaryUnit = (u: StockUnidad) => setAddedSecondaryUnits(prev => [...prev, u]);
  const handleRemoveSecondaryUnit = (id: string) => setAddedSecondaryUnits(prev => prev.filter(u => u.id !== id));

  const handlePromesaPctChange = (val: number) => {
    setPagoPromesaPct(val);
    setPagoPromesa(parseFloat((totalEscritura * (val / 100)).toFixed(2)));
  };
  const handlePiePctChange = (val: number) => {
    setPagoPiePct(val);
    setPagoPie(parseFloat((totalEscritura * (val / 100)).toFixed(2)));
  };
  const handlePromesaChange = (val: number) => {
    setPagoPromesa(val);
    setPagoPromesaPct(parseFloat(((val / totalEscritura) * 100).toFixed(2)));
  };
  const handlePieChange = (val: number) => {
    setPagoPie(val);
    setPagoPiePct(parseFloat(((val / totalEscritura) * 100).toFixed(2)));
  };

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat('es-CL', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt);
  const formatCLP = (amt: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amt);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No especificada';
    const d = new Date(dateString);
    if (d < new Date()) return 'INMEDIATA';
    return new Intl.DateTimeFormat('es-CL').format(d);
  };

  // Renderizado
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full"></div></div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!broker) return <div className="p-8 text-center text-red-600">Acceso Denegado</div>;

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* Header */}
      <header className="bg-white shadow">{/* ... mismo header ... */}</header>
      <main className="max-w-7xl mx-auto p-8">
        {/* Tabs/Nav y contenido de Principales, Secundarios y Configuración (idéntico al original) */}
      </main>
      <footer className="bg-white border-t p-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} {broker.business_name}
      </footer>
    </div>
  );
};

export default BrokerQuotePage;
