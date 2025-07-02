import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog } from '@headlessui/react';
import { EyeOff, Clock, Eye, X } from 'lucide-react';

interface CollapsedTask {
  id: string;
  task_assignment_id: string;
  collapsed_at: string;
  expires_at: string;
  task_assignment: {
    id: string;
    task: {
      name: string;
    };
    user: {
      first_name: string;
      last_name: string;
    };
    reservation_flow: {
      reservations: {
        reservation_number: string;
        client: {
          first_name: string;
          last_name: string;
        };
        project: {
          name: string;
          stage: string;
        };
      };
    };
  };
}

interface CollapsedTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskExpanded: (taskId: string) => void;
}

const CollapsedTasksModal: React.FC<CollapsedTasksModalProps> = ({
  isOpen,
  onClose,
  onTaskExpanded
}) => {
  const [collapsedTasks, setCollapsedTasks] = useState<CollapsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandingTask, setExpandingTask] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCollapsedTasks();
    }
  }, [isOpen]);

  const fetchCollapsedTasks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('collapsed_tasks')
        .select(`
          id,
          task_assignment_id,
          collapsed_at,
          expires_at,
          task_assignment:task_assignments(
            id,
            task:sale_flow_tasks(name),
            user:profiles!user_id(first_name, last_name),
            reservation_flow:reservation_flows(
              reservations(
                reservation_number,
                client:clients(first_name, last_name),
                project:projects(name, stage)
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('collapsed_at', { ascending: false });

      if (error) throw error;
      setCollapsedTasks(data || []);
    } catch (err) {
      console.error('Error fetching collapsed tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandTask = async (taskId: string) => {
    setExpandingTask(taskId);
    try {
      const { error } = await supabase
        .from('collapsed_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Remove from local state
      setCollapsedTasks(prev => prev.filter(task => task.id !== taskId));
      
      // Notify parent component
      const task = collapsedTasks.find(t => t.id === taskId);
      if (task) {
        onTaskExpanded(task.task_assignment_id);
      }
    } catch (err) {
      console.error('Error expanding task:', err);
    } finally {
      setExpandingTask(null);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expirada';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`;
    } else {
      return `${minutes}m restantes`;
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
        <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-bold text-orange-700 flex items-center gap-2">
              <EyeOff className="h-6 w-6" />
              Tareas Ocultas Temporalmente
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando tareas ocultas...</p>
            </div>
          ) : collapsedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <EyeOff className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay tareas ocultas temporalmente</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {collapsedTasks.map((task) => {
                const reservation = Array.isArray(task.task_assignment.reservation_flow.reservations) 
                  ? task.task_assignment.reservation_flow.reservations[0] 
                  : task.task_assignment.reservation_flow.reservations;
                
                const client = reservation?.client;
                const project = reservation?.project;
                
                return (
                  <div
                    key={task.id}
                    className="border border-orange-200 rounded-lg p-4 bg-orange-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {task.task_assignment.task.name}
                          </h3>
                          <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">
                            {formatTimeRemaining(task.expires_at)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Asignado a:</span> {task.task_assignment.user.first_name} {task.task_assignment.user.last_name}
                          </div>
                          <div>
                            <span className="font-medium">Reserva:</span> {reservation?.reservation_number || '-'}
                          </div>
                          <div>
                            <span className="font-medium">Cliente:</span> {client ? `${client.first_name} ${client.last_name}` : '-'}
                          </div>
                          <div>
                            <span className="font-medium">Proyecto:</span> {project ? `${project.name} ${project.stage}` : '-'}
                          </div>
                          <div>
                            <span className="font-medium">Ocultada:</span> {new Date(task.collapsed_at).toLocaleString('es-CL')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <button
                          onClick={() => handleExpandTask(task.id)}
                          disabled={expandingTask === task.id}
                          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {expandingTask === task.id ? (
                            <Clock className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Mostrar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CollapsedTasksModal; 