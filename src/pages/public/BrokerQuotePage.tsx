import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { useUFStore } from '../../stores/ufStore';
import {
  Building, Home, DollarSign, Calculator, Download, Check, X,
  Search, ChevronDown, ChevronUp, Plus, AlertTriangle
} from 'lucide-react';

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
  descuento: number | null;      // ya viene como porcentaje (ej. 20 para 20%)
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

// Fetch commercial policy for a project
const fetchCommercialPolicy = async (projectName: string): Promise<ProjectCommercialPolicy | null> => {
  const { data, error } = await supabase
    .from('project_commercial_policies')
    .select('*')
    .eq('project_name', projectName)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Fetch broker commission rate for a project
const fetchBrokerCommissionRate = async (brokerId: string, projectName: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('broker_project_commissions')
    .select('commission_rate')
    .eq('broker_id', brokerId)
    .eq('project_name', projectName)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.commission_rate ?? null;
};

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const { ufValue, fetchUFValue } = useUFStore();

  // Estados principales
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<StockUnidad[]>([]);
  const [brokerCommissionByProject, setBrokerCommissionByProject] = useState<Record<string, number>>({});
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

  // Fetch UF upon mount
  useEffect(() => {
    fetchUFValue();
  }, [fetchUFValue]);

  // Inicialización: validar broker, traer unidades y prefetch comisiones
  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true);
        if (!brokerSlug || !accessToken) throw new Error('Parámetros de acceso inválidos');

        // 1) Validar broker
        const validatedBroker = await validateBroker(brokerSlug, accessToken);
        setBroker(validatedBroker);

        // 2) Traer todas las unidades
        let allUnits: StockUnidad[] = [];
        let from = 0;
        const size = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('stock_unidades')
            .select('*', { count: 'exact' })
            .eq('estado_unidad', 'Disponible')
            .range(from, from + size - 1)
            .order('proyecto_nombre', { ascending: true })
            .order('unidad', { ascending: true });
          if (error) throw error;
          if (!data || data.length === 0) break;
          allUnits = allUnits.concat(data);
          from += size;
          if (data.length < size) break;
        }
        setUnidades(allUnits);

        // 3) Prefetch de comisiones por proyecto
        const projects = Array.from(new Set(allUnits.map(u => u.proyecto_nombre)));
        const commissionMap: Record<string, number> = {};
        await Promise.all(projects.map(async project => {
          const rate = await fetchBrokerCommissionRate(validatedBroker.id, project);
          commissionMap[project] = rate ?? 0;
        }));
        setBrokerCommissionByProject(commissionMap);

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar la página');
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [brokerSlug, accessToken]);

  // Cuando cambias de unidad, trae su política comercial
  useEffect(() => {
    const fetchPolicy = async () => {
      if (!selectedUnidad) return;
      const policy = await fetchCommercialPolicy(selectedUnidad.proyecto_nombre);
      setCommercialPolicy(policy);
      if (policy && ufValue && policy.monto_reserva_pesos) {
        setPagoReserva(parseFloat((policy.monto_reserva_pesos / ufValue).toFixed(2)));
      }
      setPagoBonoPieCotizacion(0);
    };
    fetchPolicy();
  }, [selectedUnidad, ufValue]);

  // Memo: proyectos únicos, tipologías, filtrado y orden
  const uniqueProjects = useMemo(() => Array.from(new Set(unidades.map(u => u.proyecto_nombre))), [unidades]);
  const uniqueTipologias = useMemo(() => {
    if (!selectedProject) return [];
    return Array.from(new Set(
      unidades
        .filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO')
        .map(u => u.tipologia).filter(Boolean) as string[]
    ));
  }, [unidades, selectedProject]);

  const filteredUnidades = useMemo(() => {
    let filtered = unidades;
    if (selectedProject) filtered = filtered.filter(u => u.proyecto_nombre === selectedProject);
    if (selectedTipologia && activeTab === 'principales')
      filtered = filtered.filter(u => u.tipologia === selectedTipologia);
    filtered = filtered.filter(u =>
      activeTab === 'principales'
        ? u.tipo_bien === 'DEPARTAMENTO'
        : u.tipo_bien !== 'DEPARTAMENTO'
    );
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.proyecto_nombre.toLowerCase().includes(term) ||
        u.unidad.toLowerCase().includes(term) ||
        (u.tipologia?.toLowerCase().includes(term)) ||
        u.tipo_bien.toLowerCase().includes(term)
      );
    }
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let A = a[sortField as keyof StockUnidad] ?? '';
        let B = b[sortField as keyof StockUnidad] ?? '';
        if (typeof A === 'string') return sortDirection === 'asc'
          ? String(A).localeCompare(String(B))
          : String(B).localeCompare(String(A));
        if (typeof A === 'number') return sortDirection === 'asc' ? (A as number) - (B as number) : (B as number) - (A as number);
        return 0;
      });
    }
    return filtered;
  }, [unidades, selectedProject, selectedTipologia, activeTab, searchTerm, sortField, sortDirection]);

  // Mapa de unidades secundarias disponibles
  const availableSecondaryUnits = useMemo(() => {
    if (!selectedUnidad) return [];
    return unidades.filter(u =>
      u.proyecto_nombre === selectedUnidad.proyecto_nombre &&
      u.tipo_bien !== 'DEPARTAMENTO' &&
      !addedSecondaryUnits.find(s => s.id === u.id)
    );
  }, [unidades, selectedUnidad, addedSecondaryUnits]);

  // Cálculos de precio
  const precioBaseDepartamento = selectedUnidad?.valor_lista ?? 0;
  const precioDescuentoDepartamento = useMemo(() => {
    if (!selectedUnidad || (quotationType !== 'descuento' && quotationType !== 'mix')) return 0;
    return precioBaseDepartamento * (discountAmount / 100);
  }, [selectedUnidad, quotationType, discountAmount, precioBaseDepartamento]);
  const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
  const precioTotalSecundarios = addedSecondaryUnits.reduce((sum, u) => sum + (u.valor_lista||0), 0);
  const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;

  // Helpers de forma de pago omitidos por brevedad…
  // …

  // Cálculo del % de descuento disponible ya con comisión
  const calculateBrokerDiscount = (unidad: StockUnidad): number => {
    const originalFrac = (unidad.descuento ?? 0) / 100;
    const commissionFrac = (brokerCommissionByProject[unidad.proyecto_nombre] ?? 0) / 100;
    const precioMinimo = unidad.valor_lista * (1 - originalFrac);
    const comision = precioMinimo * commissionFrac;
    const precioConComision = precioMinimo + comision;
    const disponible = (unidad.valor_lista - precioConComision) / unidad.valor_lista;
    return Math.max(0, Math.round(disponible * 100));
  };

  // Resto del render (headers, tabs, tablas…) permanece igual, solo cambia en la columna “Descuento”:
  // …
  if (loading) return <div>…Cargando…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* … Header, Tabs … */}
      {activeTab === 'principales' && (
        <table className="min-w-full">
          <thead>…</thead>
          <tbody>
            {filteredUnidades.map(u => {
              const brokerDiscount = calculateBrokerDiscount(u);
              return (
                <tr key={u.id}>
                  <td>{u.proyecto_nombre}</td>
                  <td>{u.unidad}</td>
                  <td>{u.tipologia}</td>
                  <td className="text-right">{u.valor_lista.toFixed(2)}</td>
                  <td className="text-green-600 text-right">{brokerDiscount}%</td>
                  <td>
                    <button onClick={() => setSelectedUnidad(u)}>Seleccionar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {/* … resto de pestañas … */}
    </div>
  );
};

export default BrokerQuotePage;
