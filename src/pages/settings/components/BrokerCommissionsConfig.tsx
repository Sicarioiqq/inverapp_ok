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
      const { data: brokersData, error: bErr } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name', { ascending: true });
      if (bErr) throw bErr;
      setBrokers(brokersData || []);

      const { data: projData, error: pErr } = await supabase
        .from('stock_unidades')
        .select('proyecto_nombre');
      if (pErr) throw pErr;
      const unique = Array.from(
        new Set((projData || []).map(r => r.proyecto_nombre).filter(Boolean) as string[])
      );
      setProjects(unique.sort());

      const { data: commData, error: cErr } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (cErr) throw cErr;
      setDbCommissions(commData || []);

      // Initialize inputs map
      const inputs: Record<string, Record<string, string>> = {};
      (commData || []).forEach(c => {
        inputs[c.broker_id] = inputs[c.broker_id] || {};
        inputs[c.broker_id][c.project_name] = c.commission_rate != null ? String(c.commission_rate) : '';
      });
      setCommissionInputs(inputs);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInputChange = (brokerId: string, project: string, value: string) => {
    // Allow empty or valid percentage up to two decimals
    if (/^(?:100(?:\.00?)?|\d{1,2}(?:\.\d{1,2})?)?$/.test(value)) {
      setCommissionInputs(prev => ({
        ...prev,
        [brokerId]: { ...prev[brokerId], [project]: value }
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const toUpsert: Omit<BrokerCommission, 'id'>[] = [];
    const toDelete: string[] = [];

    projects.forEach(project => {
      brokers.forEach(broker => {
        const val = commissionInputs[broker.id]?.[project];
        const existing = dbCommissions.find(c => c.broker_id === broker.id && c.project_name === project);
        if (val && val.trim() !== '') {
          const rate = parseFloat(val);
          toUpsert.push({ broker_id: broker.id, project_name: project, commission_rate: rate });
        } else if (existing?.id) {
          toDelete.push(existing.id);
        }
      });
    });

    try {
      if (toDelete.length) {
        const { error: delErr } = await supabase
          .from('broker_project_commissions')
          .delete()
          .in('id', toDelete);
        if (delErr) throw delErr;
      }
      if (toUpsert.length) {
        const { error: upErr } = await supabase
          .from('broker_project_commissions')
          .upsert(toUpsert, { onConflict: 'broker_id,project_name' });
        if (upErr) throw upErr;
      }
      toast.success('Comisiones guardadas correctamente.');
      fetchData();
    } catch (e: any) {
      console.error(e);
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-6 flex justify-center items-center">
      <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      <span className="ml-3 text-gray-700">Cargando comisiones...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded">Reintentar</button>
    </div>
  );

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 overflow-auto">
      <div className="flex items-center mb-4">
        <Percent className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-xl font-semibold text-gray-800">Comisiones por Proyecto x Broker</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 sticky left-0 bg-gray-50">Proyecto</th>
              {brokers.map(b => (
                <th key={b.id} className="px-4 py-2 text-center font-medium text-gray-700">{b.name}</th>
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