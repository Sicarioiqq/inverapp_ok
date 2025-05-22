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
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: brokerData, error: brokerErr } = await supabase
        .from('brokers')
        .select('id,name')
        .order('name', { ascending: true });
      if (brokerErr) throw brokerErr;
      setBrokers(brokerData || []);
      if (brokerData?.length) setSelectedBroker(brokerData[0].id);

      const BATCH = 1000;
      let all: { proyecto_nombre: string }[] = [];
      for (let from = 0; ; from += BATCH) {
        const { data: chunk, error: chunkErr } = await supabase
          .from('stock_unidades')
          .select('proyecto_nombre')
          .order('proyecto_nombre')
          .range(from, from + BATCH - 1);
        if (chunkErr) throw chunkErr;
        if (!chunk?.length) break;
        all = all.concat(chunk);
        if (chunk.length < BATCH) break;
      }
      const distinct = Array.from(
        new Set(all.map(r => r.proyecto_nombre).filter(Boolean) as string[])
      ).sort();
      setProjects(distinct);

      const { data: commData, error: commErr } = await supabase
        .from('broker_project_commissions')
        .select('id,broker_id,project_name,commission_rate');
      if (commErr) throw commErr;
      setDbCommissions(commData || []);

      const inputs: Record<string, Record<string, string>> = {};
      (commData || []).forEach(c => {
        inputs[c.broker_id] ??= {};
        inputs[c.broker_id][c.project_name] =
          c.commission_rate != null ? c.commission_rate.toFixed(3) : '';
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

  const handleInputChange = (project: string, value: string) => {
    // Allow up to 3 decimal places
    if (/^(?:100(?:\.[0-9]{1,3})?|\d{1,2}(?:\.[0-9]{1,3})?)?$/.test(value) && selectedBroker) {
      setCommissionInputs(prev => ({
        ...prev,
        [selectedBroker]: { ...(prev[selectedBroker] || {}), [project]: value }
      }));
    }
  };

  const handleSave = async () => {
    if (!selectedBroker) return;
    setSaving(true);
    setError(null);
    const upserts: Omit<BrokerCommission, 'id'>[] = [];
    const deletes: string[] = [];

    projects.forEach(project => {
      const val = commissionInputs[selectedBroker]?.[project] || '';
      const existing = dbCommissions.find(
        c => c.broker_id === selectedBroker && c.project_name === project
      );
      if (val.trim() !== '') {
        upserts.push({
          broker_id: selectedBroker,
          project_name: project,
          commission_rate: parseFloat(val)
        });
      } else if (existing?.id) {
        deletes.push(existing.id);
      }
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
      toast.success('Comisiones guardadas');
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
    <div className="bg-white shadow-xl rounded-lg p-6 overflow-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Percent className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-xl font-semibold text-gray-800">Comisiones por Proyecto × Broker</h3>
        </div>
        <div>
          <label htmlFor="broker-select" className="block text-sm font-medium text-gray-700">Broker</label>
          <select
            id="broker-select"
            value={selectedBroker || ''}
            onChange={e => setSelectedBroker(e.target.value)}
            className="mt-1 block px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {brokers.map(b => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Proyecto</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">% Comisión</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map(project => (
              <tr key={project}>
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{project}</td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="text"
                    value={commissionInputs[selectedBroker!]?.[project] || ''}
                    onChange={e => handleInputChange(project, e.target.value)}
                    className="w-24 text-right px-2 py-1 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="%"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
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
