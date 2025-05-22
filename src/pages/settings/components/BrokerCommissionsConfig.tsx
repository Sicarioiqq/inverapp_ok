// src/pages/settings/components/BrokerCommissionsConfig.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import {
  Briefcase,
  Landmark,
  Percent,
  Save,
  Loader2,
  AlertCircle,
  Trash2
} from 'lucide-react';

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

const PAGE_SIZE = 1000;

const BrokerCommissionsConfig: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, Record<string, string>>>({});
  const [dbCommissions, setDbCommissions] = useState<BrokerCommission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      // 1) Brokers
      const { data: brokersData, error: be } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name', { ascending: true });
      if (be) throw be;
      setBrokers(brokersData || []);

      // 2) Projects — paginado para traer TODOS
      let from = 0;
      const allRows: { proyecto_nombre: string | null }[] = [];
      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data, error: pe } = await supabase
          .from('stock_unidades')
          .select('proyecto_nombre')
          .range(from, to);
        if (pe) throw pe;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const uniqueProjects = Array.from(
        new Set(
          allRows
            .map(r => r.proyecto_nombre)
            .filter((p): p is string => !!p)
        )
      ).sort();
      setProjects(uniqueProjects);

      // 3) Existing commissions
      const { data: commData, error: ce } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (ce) throw ce;
      setDbCommissions(commData || []);

      // Map inputs
      const inputsMap: Record<string, Record<string, string>> = {};
      (commData || []).forEach(c => {
        inputsMap[c.broker_id] ??= {};
        inputsMap[c.broker_id][c.project_name] =
          c.commission_rate != null ? String(c.commission_rate) : '';
      });
      setCommissionInputs(inputsMap);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error desconocido';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCommissionInputChange = (brokerId: string, projectName: string, value: string) => {
    if (value === '' || /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/.test(value)) {
      setCommissionInputs(prev => ({
        ...prev,
        [brokerId]: {
          ...prev[brokerId],
          [projectName]: value,
        },
      }));
    }
  };

  const handleSaveCommissions = async () => {
    setIsSaving(true);
    setError(null);

    const toUpsert: Omit<BrokerCommission, 'id'>[] = [];
    const toDeleteIds: string[] = [];

    brokers.forEach(broker => {
      projects.forEach(projectName => {
        const inputValue = commissionInputs[broker.id]?.[projectName] ?? '';
        const existing = dbCommissions.find(
          c => c.broker_id === broker.id && c.project_name === projectName
        );

        if (inputValue.trim() !== '') {
          const rate = parseFloat(inputValue);
          if (isNaN(rate) || rate < 0 || rate > 100) {
            const msg = `Valor inválido (${inputValue}) para ${broker.name} en ${projectName}`;
            toast.error(msg);
            throw new Error(msg);
          }
          toUpsert.push({ broker_id: broker.id, project_name: projectName, commission_rate: rate });
        } else if (existing?.id) {
          toDeleteIds.push(existing.id);
        }
      });
    });

    if (!toUpsert.length && !toDeleteIds.length) {
      toast.info('No hay cambios para guardar.');
      setIsSaving(false);
      return;
    }

    try {
      if (toDeleteIds.length) {
        const { error: de } = await supabase
          .from('broker_project_commissions')
          .delete()
          .in('id', toDeleteIds);
        if (de) throw de;
        toast.success(`${toDeleteIds.length} comisión(es) eliminada(s).`);
      }
      if (toUpsert.length) {
        const { error: ue } = await supabase
          .from('broker_project_commissions')
          .upsert(toUpsert, { onConflict: 'broker_id,project_name' });
        if (ue) throw ue;
        toast.success(`${toUpsert.length} comisión(es) guardada(s)/actualizada(s).`);
      }
      toast.success('Comisiones actualizadas!');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-lg text-gray-700">
          Cargando configuración de comisiones...
        </span>
      </div>
    );
  }

  if (error && !brokers.length && !projects.length) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Percent className="h-7 w-7 text-blue-600 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-800">
          Comisiones de Broker por Proyecto
        </h3>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
          {error}
        </div>
      )}

      {brokers.length === 0 && (
        <p className="text-gray-500 italic">No hay brokers registrados.</p>
      )}
      {projects.length === 0 && (
        <p className="text-gray-500 italic">
          No hay proyectos en stock. Carga primero el stock.
        </p>
      )}

      {brokers.length > 0 && projects.length > 0 && (
        <div className="space-y-6">
          {brokers.map(broker => (
            <div
              key={broker.id}
              className="p-4 border border-gray-200 rounded-lg shadow-sm bg-gray-50/50"
            >
              <div className="flex items-center mb-4">
                <Briefcase className="h-5 w-5 text-gray-600 mr-2" />
                <h4 className="text-lg font-medium text-gray-800">
                  {broker.name || `Broker ID: ${broker.id}`}
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {projects.map(projectName => (
                  <div key={projectName} className="flex flex-col">
                    <label
                      htmlFor={`comm-${broker.id}-${projectName}`}
                      className="text-sm font-medium text-gray-700 mb-1 truncate"
                      title={projectName}
                    >
                      <Landmark
                        size={16}
                        className="mr-1.5 text-gray-400 inline-block"
                      />
                      <span className="truncate">{projectName}</span>
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        id={`comm-${broker.id}-${projectName}`}
                        value={
                          commissionInputs[broker.id]?.[projectName] ?? ''
                        }
                        onChange={e =>
                          handleCommissionInputChange(
                            broker.id,
                            projectName,
                            e.target.value
                          )
                        }
                        placeholder="Ej: 2.50"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-right"
                      />
                      <span className="ml-2 text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-8 flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveCommissions}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 disabled:opacity-60 flex items-center"
            >
              {isSaving ? (
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              Guardar Todas las Comisiones
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerCommissionsConfig;
