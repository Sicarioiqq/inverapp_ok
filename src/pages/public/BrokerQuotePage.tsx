// src/pages/public/BrokerQuotePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Home,
  SlidersHorizontal,
  Loader2,
  ShieldX,
  ArrowUp,
  ArrowDown
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
  valor_lista: number | null;
  descuento: number | null;
  estado_unidad: string | null;
  tipo_bien: string;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();

  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('principales');

  const [stock, setStock] = useState<Unidad[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [sortField, setSortField] = useState<keyof Unidad>('unidad');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
  const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // Validate broker access
  useEffect(() => {
    if (!brokerSlug || !accessToken) {
      setError('Información de acceso inválida.');
      setIsValidating(false);
      return;
    }
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('brokers')
          .select('id, name')
          .eq('slug', brokerSlug)
          .eq('public_access_token', accessToken)
          .single();
        if (fetchError || !data) throw new Error('Acceso no autorizado');
        setBrokerInfo(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsValidating(false);
      }
    })();
  }, [brokerSlug, accessToken]);

  // Load stock on mount
  useEffect(() => {
    const fetchStock = async () => {
      setLoadingStock(true);
      const { data, error: stockError } = await supabase
        .from('stock_unidades')
        .select('*');
      if (!stockError && data) setStock(data as Unidad[]);
      setLoadingStock(false);
    };
    fetchStock();
  }, []);

  const applyFilters = (list: Unidad[]) => {
    return list.filter(u => {
      if (filterProyecto !== 'Todos' && u.proyecto_nombre !== filterProyecto) return false;
      if (filterTipologia !== 'Todos' && u.tipologia !== filterTipologia) return false;
      return true;
    });
  };

  const sorted = [...applyFilters(stock)]
    .sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null || bv == null) return 0;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  if (isValidating) return <LoadingScreen message="Validando acceso..." />;
  if (error || !brokerInfo) return <ErrorScreen message={error || 'Error de acceso.'} onRetry={() => navigate('/login')} />;

  // Unique filter options
  const proyectos = Array.from(new Set(stock.map(u => u.proyecto_nombre))).sort();
  const tipologias = Array.from(new Set(stock.map(u => u.tipologia))).sort();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title={`Cotizador Broker: ${brokerInfo.name}`} />
      <main className="container mx-auto p-4">
        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab !== 'configuracion' && (
          <div className="bg-white shadow rounded p-4 mb-6">
            <Filters
              proyectos={proyectos}
              tipologias={tipologias}
              filterProyecto={filterProyecto}
              setFilterProyecto={setFilterProyecto}
              filterTipologia={filterTipologia}
              setFilterTipologia={setFilterTipologia}
            />
            <DataTable<Unidad>
              data={sorted.filter(u => activeTab === 'principales'
                ? u.tipo_bien === 'DEPARTAMENTO'
                : u.tipo_bien !== 'DEPARTAMENTO')}
              headers={[
                { key: 'proyecto_nombre', label: 'Proyecto' },
                { key: 'unidad', label: 'Unidad' },
                { key: 'tipologia', label: 'Tipología' },
                { key: 'piso', label: 'Piso' },
                { key: 'sup_util', label: 'Sup. Útil' },
                { key: 'valor_lista', label: 'Valor Lista' },
                { key: 'descuento', label: 'Desc.' },
                { key: 'estado_unidad', label: 'Estado' }
              ]}
              sortField={sortField}
              sortAsc={sortAsc}
              onSort={(key) => {
                if (sortField === key) return setSortAsc(!sortAsc);
                setSortField(key);
                setSortAsc(true);
              }}
              loading={loadingStock}
              onRowClick={(u) => {
                setSelectedUnidad(u);
                setActiveTab('configuracion');
              }}
            />
          </div>
        )}

        {activeTab === 'configuracion' && (
          <ConfigurationPanel
            unidad={selectedUnidad}
            cliente={cliente}
            rut={rut}
            setCliente={setCliente}
            setRut={setRut}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

// Helper components below: Header, LoadingScreen, ErrorScreen, Tabs, Filters, DataTable, ConfigurationPanel, Footer
// ... (Implement these components as needed) ...

export default BrokerQuotePage;
