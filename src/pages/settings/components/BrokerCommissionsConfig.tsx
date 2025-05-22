// src/pages/settings/components/BrokerCommissionsConfig.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Percent, Loader2, AlertCircle } from 'lucide-react';

interface Broker {
  id: string;
  name: string | null;
}

interface BrokerCommission {
  id?: string;
  broker_id: string;
  project_name: string;
  commission_rate: number | null;
}

const BrokerCommissionsConfig: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, Record<string, string>>>({});
  const [dbCommissions, setDbCommissions] = useState<BrokerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Fetch brokers
      const { data: brokerData, error: brokerErr } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name', { ascending: true });
      if (brokerErr) throw brokerErr;
      setBrokers(brokerData || []);

      // 2) Paginate through all stock_unidades to collect distinct project names
      const BATCH = 1000;
      let from = 0;
      let all: { proyecto_nombre: string }[] = [];
      while (true) {
        const { data: chunk, error: chunkErr } = await supabase
          .from('stock_unidades')
          .select('proyecto_nombre')
          .order('proyecto_nombre', { ascending: true })
          .range(from, from + BATCH - 1);
        if (chunkErr) throw chunkErr;
        if (!chunk || chunk.length === 0) break;
        all = all.concat(chunk);
        if (chunk.length < BATCH) break;
        from += BATCH;
      }
      const distinct = Array.from(
        new Set(all.map(r => r.proyecto_nombre).filter(Boolean) as string[])
      ).sort();
      setProjects(distinct);

      // 3) Fetch existing commission records
      const { data: commData, error: commErr } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (commErr) throw commErr;
      setDbCommissions(commData || []);

      // 4) Initialize inputs
      const inputs: Record<string, Record<string, string>> = {};
      (commData || []).forEach(c => {
        if (!inputs[c.broker_id]) inputs[c.broker_id] = {};
        inputs[c.broker_id][c.project_name] =
          c.commission_rate != null ? c.commission_rate.toFixed(2) : '';
      });
      setCommissionInputs(inputs);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error cargando datos');
      toast.error(e.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInputChange = (brokerId: string, project: string, value: string) => {
    if (/^(?:100(?:\.[0-9]{1,2})?|\d{1,2}(?:\.[0-9]{1,2})?)?$/.test(value)) {
      setCommissionInputs(prev => ({
        ...prev,
        [brokerId]: { ...(prev[brokerId] || {}), [project]: value }
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const upserts: Omit<BrokerCommission, 'id'>[] = [];
    const deletes: string[] = [];

    projects.forEach(project => {
      brokers.forEach(broker => {
        const val = commissionInputs[broker.id]?.[project] || '';
        const existing = dbCommissions.find(
          c => c.broker_id === broker.id && c.project_name === project
        );
        if (val.trim() !== '') {
          upserts.push({ broker_id: broker.id, project_name: project, commission_rate: parseFloat(val) });
        } else if (existing?.id) {
          deletes.push(existing.id);
        }
      });
    });

    try {
      if (deletes.length) {
        const { error: delErr } = await supabase
          .from('broker_project_commissions')
          .delete()
          .in('id', deletes);
        if (delErr) throw delErr;
      }
      if (upserts.length) {
        const { error: upErr } = await supabase
          .from('broker_project_commissions')
          .upsert(upserts, { onConflict: 'broker_id,project_name' });
        if (upErr) throw upErr;
      }
      toast.success('Comisiones guardadas correctamente');
      fetchData();
    } catch (e: any) {
      console.error(e);
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-gray-700">Cargando comisiones...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 overflow-auto">
      <div className="flex items-center mb-4">
        <Percent className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-xl font-semibold text-gray-800">Comisiones por Proyecto × Broker</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-50">Proyecto</th>
              {brokers.map(b => (
                <th key={b.id} className="px-4 py-2 text-center font-medium text-gray-700">{b.name || '—'}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map(project => (
              <tr key={project}>
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white">{project}</td>
                {brokers.map(b => (
                  <td key={b.id} className="px-4 py-2 text-center">
                    <input
                      type="text"
                      value={commissionInputs[b.id]?.[project] || ''}
                      onChange={e => handleInputChange(b.id, project, e.target.value)}
                      className="w-16 text-right px-2 py-1 border rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="%"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          {saving && <Loader2 className="animate-spin h-5 w-5 mr-2 text-white" />}Guardar
        </button>
      </div>
    </div>
  );
};

export default BrokerCommissionsConfig;
