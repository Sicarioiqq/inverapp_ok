// src/pages/settings/components/BrokerCommissionsConfig.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import {
  Briefcase, Landmark, Percent, Save,
  Loader2, AlertCircle, Trash2
} from 'lucide-react';

interface Broker { id: string; name: string | null; }
interface BrokerCommission {
  id?: string;
  broker_id: string;
  project_name: string;
  commission_rate: number | null;
}

const BrokerCommissionsConfig: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [commissions, setCommissions] =
    useState<Record<string, Record<string, string>>>({});
  const [initialCommissions, setInitialCommissions] =
    useState<BrokerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) brokers
      const { data: brokersData, error: be } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name', { ascending: true });
      if (be) throw be;
      setBrokers(brokersData || []);

      // 2) traer todos los proyectos de stock_unidades (sin límite)
      let from = 0;
      const PAGE = 1000;
      const allRows: { proyecto_nombre: string | null }[] = [];
      while (true) {
        const to = from + PAGE - 1;
        const { data, error: pe } = await supabase
          .from('stock_unidades')
          .select('proyecto_nombre')
          .range(from, to);
        if (pe) throw pe;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const uniqueProjects = Array.from(
        new Set(allRows
          .map(r => r.proyecto_nombre)
          .filter((x): x is string => !!x)
        )
      ).sort();
      setProjects(uniqueProjects);

      // 3) comisiones existentes
      const { data: commData, error: ce } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (ce) throw ce;
      setInitialCommissions(commData || []);
      // preparar mapa para inputs
      const map: Record<string, Record<string, string>> = {};
      (commData||[]).forEach(c => {
        map[c.broker_id] ??= {};
        map[c.broker_id][c.project_name] =
          c.commission_rate != null ? String(c.commission_rate) : '';
      });
      setCommissions(map);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error desconocido');
      toast.error(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ... mantén el resto de lógica de render, cambios y guardado iguales,
  // usando `projects` en lugar del select limitado a 100 filas ...
  // Recuerda que la única diferencia aquí es cómo obtienes `projects`.

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-lg text-gray-700">
          Cargando configuración de comisiones...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6">
      {/* … título … */}
      {brokers.map(broker => (
        <div key={broker.id} className="mb-8">
          {/* … inputs de comisión por proyecto usando `projects` … */}
        </div>
      ))}
      {/* … botón de guardar … */}
    </div>
  );
};

export default BrokerCommissionsConfig;
