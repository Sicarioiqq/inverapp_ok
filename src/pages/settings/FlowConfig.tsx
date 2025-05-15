import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ChevronDown, ChevronRight, UserPlus, UserCircle } from 'lucide-react';
import TaskAssignmentPopup from '../../components/TaskAssignmentPopup';
import { usePopup } from '../../contexts/PopupContext';

interface Stage {
  id: string;
  name: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  assignees: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }[];
}

interface Seller {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url?: string;
}

const FlowConfig = () => {
  const { showPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [defaultSeller, setDefaultSeller] = useState<string>('');
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetchFlowConfig(),
      fetchSellers(),
      fetchDefaultSeller()
    ]).finally(() => setLoading(false));
  }, []);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, position, avatar_url')
        .eq('is_seller', true)
        .order('first_name');

      if (error) throw error;
      setSellers(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchDefaultSeller = async () => {
    try {
      const { data, error } = await supabase
        .from('default_seller')
        .select('user_id')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setDefaultSeller(data.user_id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDefaultSellerChange = async (sellerId: string) => {
    try {
      setLoading(true);

      // First get the current default seller record
      const { data: currentDefault } = await supabase
        .from('default_seller')
        .select('id')
        .single();

      if (currentDefault) {
        // If there's an existing record, update it
        const { error: updateError } = await supabase
          .from('default_seller')
          .update({ user_id: sellerId || null })
          .eq('id', currentDefault.id);

        if (updateError) throw updateError;
      } else if (sellerId) {
        // If no record exists and a seller is selected, create a new one
        const { error: insertError } = await supabase
          .from('default_seller')
          .insert({ user_id: sellerId });

        if (insertError) throw insertError;
      }

      setDefaultSeller(sellerId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlowConfig = async () => {
    try {
      // Get the default flow
      const { data: flowData, error: flowError } = await supabase
        .from('sale_flows')
        .select('id')
        .eq('name', 'Flujo de Venta Regular')
        .single();

      if (flowError) throw flowError;

      // Get stages and tasks
      const { data: stagesData, error: stagesError } = await supabase
        .from('sale_flow_stages')
        .select(`
          id,
          name,
          tasks:sale_flow_tasks(
            id,
            name,
            order
          )
        `)
        .eq('flow_id', flowData.id)
        .order('order');

      if (stagesError) throw stagesError;

      // Get default assignments for each task
      const tasks = stagesData.flatMap(stage => stage.tasks);
      const { data: assignments, error: assignmentsError } = await supabase
        .from('default_task_assignments')
        .select(`
          task_id,
          user:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .in('task_id', tasks.map(t => t.id));

      if (assignmentsError) throw assignmentsError;

      // Process and combine the data
      const processedStages = stagesData.map(stage => ({
        id: stage.id,
        name: stage.name,
        tasks: stage.tasks.map(task => ({
          id: task.id,
          name: task.name,
          assignees: assignments
            ?.filter(a => a.task_id === task.id)
            .map(a => ({
              id: a.user.id,
              first_name: a.user.first_name,
              last_name: a.user.last_name,
              avatar_url: a.user.avatar_url
            })) || []
        })).sort((a, b) => a.name.localeCompare(b.name))
      }));

      setStages(processedStages);

      // Expand all stages by default
      const expanded = processedStages.reduce((acc, stage) => ({
        ...acc,
        [stage.id]: true
      }), {});
      setExpandedStages(expanded);

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssign = (taskId: string, currentAssignees: string[]) => {
    showPopup(
      <TaskAssignmentPopup
        taskId={taskId}
        currentAssignees={currentAssignees}
        onSave={fetchFlowConfig}
        onClose={() => showPopup(null)}
      />,
      {
        title: 'Asignar Responsables por Defecto',
        size: 'md'
      }
    );
  };

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default Seller Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Vendedor por Defecto
        </h2>
        <div className="max-w-md">
          <label htmlFor="default_seller" className="block text-sm font-medium text-gray-700">
            Seleccionar vendedor por defecto para nuevas reservas
          </label>
          <select
            id="default_seller"
            value={defaultSeller}
            onChange={(e) => handleDefaultSellerChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Seleccione un vendedor</option>
            {sellers.map(seller => (
              <option key={seller.id} value={seller.id}>
                {seller.first_name} {seller.last_name} - {seller.position}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Assignments */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-medium text-gray-900">
            Asignación de Responsables por Defecto
          </h2>
        </div>

        {stages.map((stage) => (
          <div key={stage.id} className="border-b last:border-b-0">
            {/* Stage Header */}
            <div
              className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
              onClick={() => toggleStage(stage.id)}
            >
              <div className="flex items-center">
                {expandedStages[stage.id] ? (
                  <ChevronDown className="h-5 w-5 mr-2 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 mr-2 text-gray-500" />
                )}
                <h3 className="font-medium text-gray-900">{stage.name}</h3>
              </div>
            </div>

            {/* Stage Tasks */}
            {expandedStages[stage.id] && (
              <div className="divide-y">
                {stage.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-gray-900">{task.name}</span>

                    <div className="flex items-center space-x-4">
                      {/* Assigned Users */}
                      <div className="flex -space-x-2">
                        {task.assignees.map((assignee) => (
                          <div
                            key={assignee.id}
                            className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden"
                            title={`${assignee.first_name} ${assignee.last_name}`}
                          >
                            {assignee.avatar_url ? (
                              <img
                                src={assignee.avatar_url}
                                alt={`${assignee.first_name} ${assignee.last_name}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserCircle className="h-6 w-6 text-gray-500" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Assign Button */}
                      <button
                        onClick={() => handleAssign(task.id, task.assignees.map(a => a.id))}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Asignar responsables"
                      >
                        <UserPlus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlowConfig;