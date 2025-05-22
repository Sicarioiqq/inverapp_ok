// src/pages/settings/components/BrokerCommissionsConfig.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase'; // Ajusta la ruta si es necesario
import { toast } from 'react-hot-toast';
import { Briefcase, Landmark, Percent, Save, Loader2, AlertCircle, Trash2 } from 'lucide-react';

interface Broker {
  id: string;
  name: string | null; // Asumiendo que la columna en 'brokers' es 'name'
                      // Si es 'first_name' y 'last_name', ajusta la query y el display
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
  // Estado para los inputs: { brokerId: { projectName: "stringRate" } }
  const [commissionInputs, setCommissionInputs] = useState<Record<string, Record<string, string>>>({});
  // Estado para las comisiones originales de la DB (para saber si algo es nuevo, existente o se borró)
  const [dbCommissions, setDbCommissions] = useState<BrokerCommission[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const { data: brokersData, error: brokersError } = await supabase
        .from('brokers') // Confirma el nombre de tu tabla de brokers
        .select('id, name') // Confirma la(s) columna(s) para el nombre del broker
        .order('name', { ascending: true });
      if (brokersError) throw brokersError;
      setBrokers(brokersData || []);

      const { data: projectsData, error: projectsError } = await supabase
        .from('stock_unidades') // Usa la tabla donde están los nombres de proyecto
        .select('proyecto_nombre'); // Columna que tiene el nombre del proyecto
      if (projectsError) throw projectsError;
      const uniqueProjects = Array.from(new Set(projectsData?.map(item => item.proyecto_nombre).filter(Boolean) as string[] || []));
      setProjects(uniqueProjects.sort());
      
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('broker_project_commissions')
        .select('id, broker_id, project_name, commission_rate');
      if (commissionsError) throw commissionsError;

      setDbCommissions(commissionsData || []);
      const inputsMap: Record<string, Record<string, string>> = {};
      (commissionsData || []).forEach(comm => {
        if (!inputsMap[comm.broker_id]) {
          inputsMap[comm.broker_id] = {};
        }
        inputsMap[comm.broker_id][comm.project_name] = comm.commission_rate !== null ? String(comm.commission_rate) : '';
      });
      setCommissionInputs(inputsMap);

    } catch (err: any) {
      console.error("Error fetching data for commissions config:", err);
      const errorMsg = `Error al cargar datos: ${err.message}`;
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCommissionInputChange = (brokerId: string, projectName: string, value: string) => {
    // Permitir strings vacíos o números válidos (0-100 con hasta 2 decimales)
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
    const upsertOperations: Omit<BrokerCommission, 'id'>[] = [];
    const deleteOperationsIds: string[] = [];

    brokers.forEach(broker => {
      projects.forEach(projectName => {
        const inputValue = commissionInputs[broker.id]?.[projectName]; // String del input
        const existingDbCommission = dbCommissions.find(
          c => c.broker_id === broker.id && c.project_name === projectName
        );

        if (inputValue !== undefined && inputValue !== null && inputValue.trim() !== '') {
          // Hay un valor en el input
          const rate = parseFloat(inputValue);
          if (isNaN(rate) || rate < 0 || rate > 100) {
            toast.error(`Valor de comisión inválido (${inputValue}) para ${broker.name} en ${projectName}.`);
            setError(`Valor inválido para ${broker.name} en ${projectName}.`); // Para mostrar en UI
            setIsSaving(false);
            throw new Error("Invalid commission rate found during save prep."); // Detiene el proceso
          }
          upsertOperations.push({
            broker_id: broker.id,
            project_name: projectName,
            commission_rate: rate,
          });
        } else {
          // El input está vacío
          if (existingDbCommission && existingDbCommission.id) {
            // Si existía en la DB, hay que borrarlo
            deleteOperationsIds.push(existingDbCommission.id);
          }
          // Si no existía en la DB y el input está vacío, no se hace nada.
        }
      });
    });
    
    if (upsertOperations.length === 0 && deleteOperationsIds.length === 0) {
      toast.info("No hay cambios en las comisiones para guardar.");
      setIsSaving(false);
      return;
    }

    try {
      if (deleteOperationsIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('broker_project_commissions')
          .delete()
          .in('id', deleteOperationsIds);
        if (deleteError) throw deleteError;
        toast.success(`${deleteOperationsIds.length} comisión(es) eliminada(s).`);
      }

      if (upsertOperations.length > 0) {
        const { error: upsertError } = await supabase
          .from('broker_project_commissions')
          .upsert(upsertOperations, { onConflict: 'broker_id,project_name' });
        if (upsertError) throw upsertError;
        toast.success(`${upsertOperations.length} comisión(es) guardada(s)/actualizada(s).`);
      }
      
      toast.success('Comisiones actualizadas exitosamente!');
      fetchData(); // Recargar para obtener los IDs actualizados y el estado fresco
    } catch (err: any) {
      console.error("Error saving commissions:", err);
      setError(`Error al guardar comisiones: ${err.message}`);
      toast.error(`Error al guardar comisiones: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-lg text-gray-700">Cargando configuración de comisiones...</span>
      </div>
    );
  }

  if (error && !brokers.length && !projects.length) { // Mostrar error principal solo si no se cargó nada
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
  
  // Mensaje de error más sutil si los datos principales (brokers/projects) ya están cargados
  const generalErrorDisplay = error ? (
     <div className="my-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
        {error}
     </div>
  ) : null;

  return (
    <div className="bg-white shadow-xl rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Percent className="h-7 w-7 text-blue-600 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-800">Comisiones de Broker por Proyecto</h3>
      </div>
      {generalErrorDisplay}

      {brokers.length === 0 && <p className="text-gray-500 italic">No hay brokers registrados en el sistema.</p>}
      {projects.length === 0 && <p className="text-gray-500 italic">No hay proyectos en el stock para asignar comisiones. Cargue el stock primero.</p>}

      {brokers.length > 0 && projects.length > 0 && (
        <div className="space-y-6">
          {brokers.map(broker => (
            <div key={broker.id} className="p-4 border border-gray-200 rounded-lg shadow-sm bg-gray-50/50">
              <div className="flex items-center mb-4">
                <Briefcase className="h-5 w-5 text-gray-600 mr-2" />
                <h4 className="text-lg font-medium text-gray-800">{broker.name || `Broker ID: ${broker.id}`}</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                {projects.map(projectName => (
                  <div key={projectName} className="flex flex-col">
                    <label htmlFor={`comm-${broker.id}-${projectName}`} className="text-sm font-medium text-gray-700 mb-1 flex items-center truncate" title={projectName}>
                      <Landmark size={16} className="mr-1.5 text-gray-400 flex-shrink-0"/> 
                      <span className="truncate">{projectName}</span>
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        id={`comm-${broker.id}-${projectName}`}
                        value={commissionInputs[broker.id]?.[projectName] || ''}
                        onChange={(e) => handleCommissionInputChange(broker.id, projectName, e.target.value)}
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
              disabled={isSaving || loadingData}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 flex items-center"
            >
              {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Guardar Todas las Comisiones
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerCommissionsConfig;