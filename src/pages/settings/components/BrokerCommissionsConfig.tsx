// src/pages/settings/components/BrokerCommissionsConfig.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase'; // Ajusta la ruta si es necesario (usando la relativa)
import { toast } from 'react-hot-toast';
import { Briefcase, Landmark, Percent, Save, Loader2, AlertCircle, Trash2 } from 'lucide-react';

interface Broker {
  id: string;
  name: string | null; // Asumiendo que la columna de nombre en 'brokers' es 'name'
}

interface BrokerCommission {
  id?: string; // El ID de la fila en broker_project_commissions
  broker_id: string;
  project_name: string;
  commission_rate: number | null; // Permitir null para inputs vacíos
}

const BrokerCommissionsConfig: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [commissions, setCommissions] = useState<Record<string, Record<string, number | string>>>({}); // { brokerId: { projectName: rate_string } }
  const [initialCommissions, setInitialCommissions] = useState<BrokerCommission[]>([]);

  const [loadingBrokers, setLoadingBrokers] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingCommissions, setLoadingCommissions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingBrokers(true);
    setLoadingProjects(true);
    setLoadingCommissions(true);
    setError(null);

    try {
      // Fetch Brokers
      const { data: brokersData, error: brokersError } = await supabase
        .from('brokers') // Asegúrate que 'brokers' es el nombre correcto de tu tabla de brokers
        .select('id, name') // Asegúrate que 'name' es la columna del nombre del broker
        .order('name', { ascending: true });
      if (brokersError) throw brokersError;
      setBrokers(brokersData || []);

      // Fetch Unique Project Names from stock_unidades
      const { data: projectsData, error: projectsError } = await supabase
        .from('stock_unidades')
        .select('proyecto_nombre');
      if (projectsError) throw projectsError;
      const uniqueProjects = Array.from(new Set(projectsData?.map(item => item.proyecto_nombre).filter(Boolean) as string[] || []));
      setProjects(uniqueProjects.sort());

      // Fetch Existing Commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (commissionsError) throw commissionsError;

      setInitialCommissions(commissionsData || []);
      const commissionsMap: Record<string, Record<string, number | string>> = {};
      (commissionsData || []).forEach(comm => {
        if (!commissionsMap[comm.broker_id]) {
          commissionsMap[comm.broker_id] = {};
        }
        // Guardar como string para el input, o vacío si es null
        commissionsMap[comm.broker_id][comm.project_name] = comm.commission_rate !== null ? String(comm.commission_rate) : '';
      });
      setCommissions(commissionsMap);

    } catch (err: any) {
      console.error("Error fetching data for commissions config:", err);
      setError(`Error al cargar datos: ${err.message}`);
      toast.error(`Error al cargar datos: ${err.message}`);
    } finally {
      setLoadingBrokers(false);
      setLoadingProjects(false);
      setLoadingCommissions(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCommissionChange = (brokerId: string, projectName: string, value: string) => {
    // Permitir borrar el valor o introducir un número válido (incluyendo decimales)
    if (value === '' || (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 100 && parseFloat(value) >= 0) || value === '.') {
         setCommissions(prev => ({
            ...prev,
            [brokerId]: {
            ...prev[brokerId],
            [projectName]: value,
            },
        }));
    } else if (parseFloat(value) > 100 ) {
        setCommissions(prev => ({
            ...prev,
            [brokerId]: {
            ...prev[brokerId],
            [projectName]: '100',
            },
        }));
    }
  };

  const getCommissionRecord = (brokerId: string, projectName: string): BrokerCommission | undefined => {
    return initialCommissions.find(c => c.broker_id === brokerId && c.project_name === projectName);
  };

  const handleSaveCommissions = async () => {
    setIsSaving(true);
    setError(null);
    let operationsSuccessful = 0;
    const upsertData: Omit<BrokerCommission, 'id'>[] = [];
    const deleteIds: string[] = [];

    for (const brokerId in commissions) {
      for (const projectName in commissions[brokerId]) {
        const rateString = commissions[brokerId][projectName];
        const existingRecord = getCommissionRecord(brokerId, projectName);

        if (rateString === '' || rateString === null || rateString === undefined) { // Si el campo está vacío
          if (existingRecord && existingRecord.id) { // Y existía un registro
            deleteIds.push(existingRecord.id); // Marcar para borrar
          }
          // Si no existía y está vacío, no hacer nada
        } else { // Si el campo tiene un valor numérico
          const rate = parseFloat(rateString as string);
          if (!isNaN(rate) && rate >= 0 && rate <= 100) {
             upsertData.push({
                broker_id: brokerId,
                project_name: projectName,
                commission_rate: rate,
            });
          } else {
            toast.error(`Valor de comisión inválido para ${brokers.find(b=>b.id === brokerId)?.name} en proyecto ${projectName}. Debe ser un número entre 0 y 100.`);
            setIsSaving(false);
            return; // Detener si hay un valor inválido que no sea vacío
          }
        }
      }
    }

    // También necesitamos encontrar comisiones que estaban en initialCommissions pero ya no están en el mapa de `commissions`
    // (Esto podría suceder si un proyecto o broker es eliminado de las listas principales, pero no es el caso aquí)
    // Por ahora, nos enfocamos en lo que está visible y editable.

    try {
      if (deleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('broker_project_commissions')
          .delete()
          .in('id', deleteIds);
        if (deleteError) throw deleteError;
        operationsSuccessful += deleteIds.length;
        toast.success(`${deleteIds.length} comision(es) eliminada(s).`);
      }

      if (upsertData.length > 0) {
        const { error: upsertError } = await supabase
          .from('broker_project_commissions')
          .upsert(upsertData, { onConflict: 'broker_id,project_name' }); // Usa la constraint UNIQUE
        if (upsertError) throw upsertError;
        operationsSuccessful += upsertData.length;
        toast.success(`${upsertData.length} comision(es) guardada(s)/actualizada(s).`);
      }

      if (operationsSuccessful > 0 || (deleteIds.length === 0 && upsertData.length === 0)) {
         setSupabaseSuccess('Cambios en comisiones guardados exitosamente.'); // Reutilizo este estado
         toast.success('Comisiones actualizadas!');
         fetchData(); // Recargar datos para reflejar cambios y IDs
      } else {
        toast.info('No hubo cambios para guardar.');
      }

    } catch (err: any) {
      console.error("Error saving commissions:", err);
      setError(`Error al guardar comisiones: ${err.message}`);
      toast.error(`Error al guardar comisiones: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCommission = async (brokerId: string, projectName: string) => {
    const commissionRate = commissions[brokerId]?.[projectName];
    // Si el campo ya está vacío, no hay nada que borrar de la DB.
    if (commissionRate === '' || commissionRate === null || commissionRate === undefined) {
        toast.info('No hay comisión asignada para borrar.');
        return;
    }

    const existingRecord = getCommissionRecord(brokerId, projectName);
    if (!existingRecord || !existingRecord.id) {
        // Si no hay registro en la DB pero hay algo en el input, simplemente limpiar el input.
        handleCommissionChange(brokerId, projectName, '');
        toast.success(`Entrada de comisión para ${projectName} limpiada (no estaba en DB).`);
        return;
    }

    if (window.confirm(`¿Estás seguro de que quieres eliminar la comisión para ${brokers.find(b => b.id === brokerId)?.name} en el proyecto ${projectName}?`)) {
        setIsSaving(true); // Usar el mismo loader general
        try {
            const { error: deleteError } = await supabase
                .from('broker_project_commissions')
                .delete()
                .eq('id', existingRecord.id);

            if (deleteError) throw deleteError;

            toast.success(`Comisión para ${projectName} eliminada exitosamente.`);
            fetchData(); // Recargar datos para reflejar el cambio
        } catch (err: any) {
            console.error("Error deleting commission:", err);
            toast.error(`Error al eliminar comisión: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    }
};


  if (loadingBrokers || loadingProjects || loadingCommissions) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-lg text-gray-700">Cargando configuración de comisiones...</span>
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
          Reintentar Carga
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Percent className="h-7 w-7 text-blue-600 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-800">Asignar Comisiones de Broker por Proyecto</h3>
      </div>

      {brokers.length === 0 && <p className="text-gray-500">No hay brokers para configurar. Añade brokers primero.</p>}
      {projects.length === 0 && <p className="text-gray-500">No hay proyectos en el stock para asignar comisiones. Carga el stock primero.</p>}

      {brokers.length > 0 && projects.length > 0 && (
        <div className="space-y-8">
          {brokers.map(broker => (
            <div key={broker.id} className="p-4 border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <Briefcase className="h-5 w-5 text-gray-500 mr-2" />
                <h4 className="text-lg font-medium text-gray-700">{broker.name || `Broker ID: ${broker.id}`}</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {projects.map(projectName => (
                  <div key={projectName} className="flex flex-col">
                    <label htmlFor={`comm-<span class="math-inline">\{broker\.id\}\-</span>{projectName}`} className="text-sm font-medium text-gray-600 mb-1 flex items-center">
                      <Landmark size={16} className="mr-1.5 text-gray-400"/> {projectName}
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text" // Usar text para permitir borrar y validación manual
                        id={`comm-<span class="math-inline">\{broker\.id\}\-</span>{projectName}`}
                        value={commissions[broker.id]?.[projectName] || ''}
                        onChange={(e) => handleCommissionChange(broker.id, projectName, e.target.value)}
                        placeholder="Ej: 2.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        pattern="\d*(\.\d+)?" // Para validación HTML básica, aunque la JS es más robusta
                      />
                      <span className="ml-2 text-gray-500">%</span>
                       <button 
                            onClick={() => handleDeleteCommission(broker.id, projectName)}
                            title="Eliminar esta comisión"
                            className="ml-2 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                            disabled={isSaving || !(commissions[broker.id]?.[projectName] && getCommissionRecord(broker.id, projectName))}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveCommissions}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
            >
              {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Guardar Comisiones
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerCommissionsConfig;