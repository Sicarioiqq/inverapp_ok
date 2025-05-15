import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCircle, ChevronDown, ChevronRight, UserPlus } from 'lucide-react';
import { usePopup } from '../../contexts/PopupContext';

interface Stage {
  id: string;
  name: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  default_assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url?: string;
}

const PaymentFlowConfig: React.FC = () => {
  const { showPopup } = usePopup();
  const [firstPaymentStages, setFirstPaymentStages] = useState<Stage[]>([]);
  const [secondPaymentStages, setSecondPaymentStages] = useState<Stage[]>([]);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchFlowConfig(),
      fetchUsers()
    ]).finally(() => setLoading(false));
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, position, avatar_url')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchFlowConfig = async () => {
    try {
      // Get the default flow
      const { data: firstFlowData, error: firstFlowError } = await supabase
        .from('payment_flows')
        .select('id, stages:payment_flow_stages(id, name)')
        .eq('name', 'Flujo de Pago Principal')
        .single();

      if (firstFlowError) throw firstFlowError;

      // Get the second payment flow
      const { data: secondFlowData, error: secondFlowError } = await supabase
        .from('payment_flows')
        .select('id, stages:payment_flow_stages(id, name)')
        .eq('name', 'Flujo de Segundo Pago')
        .single();

      if (secondFlowError) throw secondFlowError;

      // Get stages and tasks for first payment flow
      const firstPaymentStagesData = await Promise.all(
        firstFlowData.stages.map(async (stage: any) => {
          const { data: tasksData, error: tasksError } = await supabase
            .from('payment_flow_tasks')
            .select(`
              id,
              name,
              default_assignee:profiles(
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('stage_id', stage.id)
            .not('name', 'like', '[DEPRECATED]%')
            .order('order');

          if (tasksError) throw tasksError;

          return {
            id: stage.id,
            name: stage.name,
            tasks: tasksData || []
          };
        })
      );

      // Get stages and tasks for second payment flow
      const secondPaymentStagesData = await Promise.all(
        secondFlowData.stages.map(async (stage: any) => {
          const { data: tasksData, error: tasksError } = await supabase
            .from('payment_flow_tasks')
            .select(`
              id,
              name,
              default_assignee:profiles(
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('stage_id', stage.id)
            .not('name', 'like', '[DEPRECATED]%')
            .order('order');

          if (tasksError) throw tasksError;

          return {
            id: stage.id,
            name: stage.name,
            tasks: tasksData || []
          };
        })
      );

      // Filter out any duplicate stages by name in the second payment flow
      const uniqueSecondPaymentStages = secondPaymentStagesData.reduce((acc, stage) => {
        // Check if we already have a stage with this name
        const existingStageIndex = acc.findIndex(s => s.name === stage.name);
        
        if (existingStageIndex === -1) {
          // If no existing stage with this name, add it
          acc.push(stage);
        } else {
          // If there's already a stage with this name, merge the tasks
          acc[existingStageIndex].tasks = [...acc[existingStageIndex].tasks, ...stage.tasks];
        }
        
        return acc;
      }, [] as Stage[]);

      setFirstPaymentStages(firstPaymentStagesData);
      setSecondPaymentStages(uniqueSecondPaymentStages);

      // Expand all stages by default
      const expanded = [...firstPaymentStagesData, ...uniqueSecondPaymentStages].reduce((acc, stage) => ({
        ...acc,
        [stage.id]: true
      }), {});
      setExpandedStages(expanded);

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssign = async (taskId: string, currentAssignee: User | null) => {
    try {
      const selectedUser = await new Promise<User | null>((resolve) => {
        showPopup(
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => resolve(user)}
                  className={`w-full flex items-center p-3 rounded-lg hover:bg-gray-50 ${
                    currentAssignee?.id === user.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={`${user.first_name} ${user.last_name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.position}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => resolve(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              {currentAssignee && (
                <button
                  type="button"
                  onClick={() => resolve({ id: '', first_name: '', last_name: '', position: '' })}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md shadow-sm hover:bg-red-50"
                >
                  Quitar Asignación
                </button>
              )}
            </div>
          </div>,
          {
            title: 'Asignar Responsable por Defecto',
            size: 'md'
          }
        );
      });

      if (!selectedUser) return;

      // Update task default assignee
      const { error: updateError } = await supabase
        .from('payment_flow_tasks')
        .update({ 
          default_assignee_id: selectedUser.id || null 
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Refresh data
      fetchFlowConfig();
    } catch (err: any) {
      setError(err.message);
    }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
    <div className="space-y-8">
      {/* Primer Pago */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Flujo de Primer Pago
        </h2>
        <div className="space-y-4">
          {firstPaymentStages.map((stage) => (
            <div key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div 
                className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
                onClick={() => toggleStage(stage.id)}
              >
                <div className="flex items-center">
                  {expandedStages[stage.id] ? (
                    <ChevronDown className="h-5 w-5 mr-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 mr-2" />
                  )}
                  <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                </div>
              </div>

              {expandedStages[stage.id] && (
                <div className="divide-y divide-gray-200">
                  {stage.tasks.map((task) => (
                    <div key={task.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900">{task.name}</span>

                        <div className="flex items-center space-x-4">
                          {task.default_assignee ? (
                            <div 
                              className="flex items-center cursor-pointer"
                              onClick={() => handleAssign(task.id, task.default_assignee!)}
                            >
                              {task.default_assignee.avatar_url ? (
                                <img
                                  src={task.default_assignee.avatar_url}
                                  alt={`${task.default_assignee.first_name} ${task.default_assignee.last_name}`}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <UserCircle className="h-8 w-8 text-gray-400" />
                              )}
                              <span className="ml-2 text-sm text-gray-600">
                                {task.default_assignee.first_name} {task.default_assignee.last_name}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAssign(task.id, null)}
                              className="flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <UserPlus className="h-5 w-5 mr-1" />
                              <span className="text-sm">Asignar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Segundo Pago */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Flujo de Segundo Pago
        </h2>
        <div className="space-y-4">
          {secondPaymentStages.map((stage) => (
            <div key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div 
                className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
                onClick={() => toggleStage(stage.id)}
              >
                <div className="flex items-center">
                  {expandedStages[stage.id] ? (
                    <ChevronDown className="h-5 w-5 mr-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 mr-2" />
                  )}
                  <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                </div>
              </div>

              {expandedStages[stage.id] && (
                <div className="divide-y divide-gray-200">
                  {stage.tasks.map((task) => (
                    <div key={task.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900">{task.name}</span>

                        <div className="flex items-center space-x-4">
                          {task.default_assignee ? (
                            <div 
                              className="flex items-center cursor-pointer"
                              onClick={() => handleAssign(task.id, task.default_assignee!)}
                            >
                              {task.default_assignee.avatar_url ? (
                                <img
                                  src={task.default_assignee.avatar_url}
                                  alt={`${task.default_assignee.first_name} ${task.default_assignee.last_name}`}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <UserCircle className="h-8 w-8 text-gray-400" />
                              )}
                              <span className="ml-2 text-sm text-gray-600">
                                {task.default_assignee.first_name} {task.default_assignee.last_name}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAssign(task.id, null)}
                              className="flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <UserPlus className="h-5 w-5 mr-1" />
                              <span className="text-sm">Asignar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentFlowConfig;