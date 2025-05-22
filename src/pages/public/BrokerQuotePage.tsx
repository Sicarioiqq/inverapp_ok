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
  const [filtered, setFiltered] = useState<Unidad[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [typologies, setTypologies] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTip, setSelectedTip] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Unidad>('proyecto_nombre');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  const [commissions, setCommissions] = useState<Record<string, number>>({});

  // Selected unidad & configuration form values
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');

  // ... validation and data loading logic unchanged ...

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold">Cotizador Broker: {brokerInfo?.name}</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        {/* Tabs nav omitted for brevity */}

        {/* Configuration Tab */}
        {activeTab === 'configuracion' && (
          <div className="bg-white shadow rounded p-6 space-y-8">
            <h2 className="text-xl font-semibold">Configuración de Cotización</h2>

            {/* Cliente Section */}
            <section className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="text-lg font-medium text-blue-700 mb-2">Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    placeholder="Ingrese nombre del cliente"
                    className="mt-1 block w-full border border-blue-300 rounded-md bg-white p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">RUT del Cliente</label>
                  <input
                    type="text"
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    placeholder="Ingrese RUT"
                    className="mt-1 block w-full border border-blue-300 rounded-md bg-white p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* Proyecto Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-800">Proyecto</h3>
              <p className="mt-1 text-gray-600">{selectedUnidad?.proyecto_nombre}</p>
            </section>

            {/* Unidad Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-800">Unidad</h3>
              <p className="mt-1 text-gray-600">
                {selectedUnidad?.unidad} <span className="text-sm text-gray-500">({selectedUnidad?.estado_unidad})</span>
              </p>
              <p className="mt-1 text-gray-600">Tipología: {selectedUnidad?.tipologia}</p>
              <p className="mt-1 text-gray-600">Piso: {selectedUnidad?.piso ?? '-'}</p>
              <p className="mt-1 text-gray-600">
                Descuento: <span className="font-semibold">{((selectedUnidad?.descuento ?? 0) * 100).toFixed(2)}%</span>
              </p>
              <p className="mt-1 text-gray-600">
                Valor Lista: <span className="font-semibold">{selectedUnidad?.valor_lista} UF</span>
              </p>
            </section>

            {/* Superficies Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-800">Superficies</h3>
              <p className="mt-1 text-gray-600">Sup. Útil: {selectedUnidad?.sup_util?.toLocaleString(undefined, { minimumFractionDigits: 2 })} m²</p>
            </section>
          </div>
        )}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} InverAPP - Cotizador Brokers</footer>
    </div>
  );
};

export default BrokerQuotePage;
