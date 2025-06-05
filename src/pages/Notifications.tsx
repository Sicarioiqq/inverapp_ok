import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';
import { Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight, UserCircle, Calendar } from 'lucide-react';

interface TaskNotification {
  type: 'sale' | 'payment';
  reservation_flow_id?: string;
  commission_flow_id?: string;
  reservation_number: string;
  task_name: string;
  task_status: string;
  project_name: string;
  project_stage: string;
  stage_name: string;
  stage_order: number;
  client_name: string;
  apartment_number: string;
  broker_name?: string;
  created_at: string;
  assigned_by_name?: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [tasks, setTasks] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user.id) {
      Promise.all([
        fetchSaleFlowTasks(),
        fetchPaymentFlowTasks()
      ]).then(([saleTasks, paymentTasks]) => {
        const allTasks = [...saleTasks, ...paymentTasks].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTasks(allTasks);
        setLoading(false);
      }).catch(err => {
        setError(err.message);
        setLoading(false);
      });
    }
  }, [session?.user.id]);

  const fetchSaleFlowTasks = async (): Promise<TaskNotification[]> => {
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          reservation_flow_id,
          task_id,
          created_at,
          assigned_by,
          assigned_by_profile:assigned_by(*),
          task:sale_flow_tasks(
            name,
            stage:sale_flow_stages(
              name,
              order
            )
          ),
          reservation_flow:reservation_flows!inner(
            status,
            reservation:reservations(
              reservation_number,
              apartment_number,
              client:clients(
                first_name,
                last_name
              ),
              broker:brokers(
                name
              ),
              project:projects(
                name,
                stage
              )
            )
          )
        `)
        .eq('user_id', session!.user.id)
        .neq('reservation_flow.status', 'pending');

      if (error) throw error;

      // Get task statuses
      const flowTaskStatuses = await Promise.all(
        data!.map(async (assignment) => {
          const { data: statusData, error: statusError } = await supabase
            .from('reservation_flow_tasks')
            .select('status')
            .eq('reservation_flow_id', assignment.reservation_flow_id)
            .eq('task_id', assignment.task_id);

          if (statusError) throw statusError;

          return {
            reservation_flow_id: assignment.reservation_flow_id,
            task_id: assignment.task_id,
            status: statusData?.[0]?.status || 'pending'
          };
        })
      );

      // Transformar relaciones a objetos si vienen como array
      const transformed = data!.map((assignment: any) => {
        if (!assignment.reservation_flow || !assignment.task) return assignment;
        const reservation = Array.isArray(assignment.reservation_flow.reservation) ? assignment.reservation_flow.reservation[0] : assignment.reservation_flow.reservation;
        if (reservation) {
          reservation.client = Array.isArray(reservation.client) ? reservation.client[0] : reservation.client;
          reservation.broker = Array.isArray(reservation.broker) ? reservation.broker[0] : reservation.broker;
          reservation.project = Array.isArray(reservation.project) ? reservation.project[0] : reservation.project;
        }
        assignment.reservation_flow.reservation = reservation;
        assignment.task.stage = Array.isArray(assignment.task.stage) ? assignment.task.stage[0] : assignment.task.stage;
        return assignment;
      });

      // Format tasks
      const formattedTasks = transformed.map(assignment => {
        const taskStatus = flowTaskStatuses.find(
          status => status.reservation_flow_id === assignment.reservation_flow_id && 
                    status.task_id === assignment.task_id
        );

        return {
          type: 'sale' as const,
          reservation_flow_id: assignment.reservation_flow_id,
          reservation_number: assignment.reservation_flow.reservation.reservation_number,
          task_name: assignment.task.name,
          task_status: taskStatus?.status || 'pending',
          project_name: assignment.reservation_flow.reservation.project.name,
          project_stage: assignment.reservation_flow.reservation.project.stage,
          stage_name: assignment.task.stage.name,
          stage_order: assignment.task.stage.order,
          client_name: `${assignment.reservation_flow.reservation.client.first_name} ${assignment.reservation_flow.reservation.client.last_name}`,
          apartment_number: assignment.reservation_flow.reservation.apartment_number,
          broker_name: assignment.reservation_flow.reservation.broker?.name,
          assigned_by_name: assignment.assigned_by_profile ? `${assignment.assigned_by_profile.first_name} ${assignment.assigned_by_profile.last_name}` : undefined,
          created_at: assignment.created_at
        };
      });

      // Filter out completed and blocked tasks
      return formattedTasks.filter(task => 
        task.task_status !== 'completed' && 
        task.task_status !== 'blocked'
      );
    } catch (err: any) {
      console.error('Error fetching sale flow tasks:', err);
      return [];
    }
  };

  const fetchPaymentFlowTasks = async (): Promise<TaskNotification[]> => {
    try {
      const { data, error } = await supabase
        .from('commission_flow_tasks')
        .select(`
          id,
          commission_flow_id,
          task_id,
          status,
          created_at,
          commission_flow:commission_flows!inner(
            status,
            broker_commission:broker_commissions(
              reservation:reservations(
                reservation_number,
                apartment_number,
                client:clients(
                  first_name,
                  last_name
                ),
                broker:brokers(
                  name
                ),
                project:projects(
                  name,
                  stage
                )
              )
            )
          ),
          task:payment_flow_tasks(
            name,
            stage:payment_flow_stages(
              name,
              order
            )
          )
        `)
        .eq('assignee_id', session!.user.id)
        .neq('commission_flow.status', 'pending')
        .neq('status', 'completed')
        .neq('status', 'blocked');

      if (error) throw error;

      // Transformar relaciones a objetos si vienen como array para payment tasks
      const transformedPayment = data.map((task: any) => {
        if (!task.commission_flow || !task.task) return task;
        const brokerCommission = Array.isArray(task.commission_flow.broker_commission) ? task.commission_flow.broker_commission[0] : task.commission_flow.broker_commission;
        if (brokerCommission) {
          const reservation = Array.isArray(brokerCommission.reservation) ? brokerCommission.reservation[0] : brokerCommission.reservation;
          if (reservation) {
            reservation.client = Array.isArray(reservation.client) ? reservation.client[0] : reservation.client;
            reservation.broker = Array.isArray(reservation.broker) ? reservation.broker[0] : reservation.broker;
            reservation.project = Array.isArray(reservation.project) ? reservation.project[0] : reservation.project;
          }
          brokerCommission.reservation = reservation;
        }
        task.commission_flow.broker_commission = brokerCommission;
        task.task.stage = Array.isArray(task.task.stage) ? task.task.stage[0] : task.task.stage;
        return task;
      });

      // Format tasks
      return transformedPayment.map(task => ({
        type: 'payment' as const,
        commission_flow_id: task.commission_flow_id,
        reservation_number: task.commission_flow.broker_commission.reservation.reservation_number,
        task_name: task.task.name,
        task_status: task.status,
        project_name: task.commission_flow.broker_commission.reservation.project.name,
        project_stage: task.commission_flow.broker_commission.reservation.project.stage,
        stage_name: task.task.stage.name,
        stage_order: task.task.stage.order,
        client_name: `${task.commission_flow.broker_commission.reservation.client.first_name} ${task.commission_flow.broker_commission.reservation.client.last_name}`,
        apartment_number: task.commission_flow.broker_commission.reservation.apartment_number,
        broker_name: task.commission_flow.broker_commission.reservation.broker.name,
        assigned_by_name: task.commission_flow.broker_commission.reservation.broker.name,
        created_at: task.created_at
      }));
    } catch (err: any) {
      console.error('Error fetching payment flow tasks:', err);
      return [];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'in_progress':
        return 'En Proceso';
      case 'blocked':
        return 'Bloqueada';
      default:
        return 'Pendiente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleTaskClick = (task: TaskNotification) => {
    if (task.type === 'sale' && task.reservation_flow_id) {
      navigate(`/flujo-reservas/${task.reservation_flow_id}`);
    } else if (task.type === 'payment' && task.commission_flow_id) {
      navigate(`/pagos/flujo/${task.commission_flow_id}`);
    }
  };

  // Group tasks by stage
  const tasksByStage = tasks.reduce((acc, task) => {
    if (!acc[task.stage_name]) {
      acc[task.stage_name] = [];
    }
    acc[task.stage_name].push(task);
    return acc;
  }, {} as Record<string, TaskNotification[]>);

  // Agregar función para calcular días desde asignación
  const getDaysSinceAssigned = (assignedAt: string) => {
    if (!assignedAt) return 0;
    const assignedDate = new Date(assignedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Mis Tareas Pendientes
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No tienes tareas pendientes
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(tasksByStage).map(([stageName, stageTasks]) => (
              <div key={stageName} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h2 className="text-lg font-medium text-gray-900">
                    {stageName}
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {stageTasks.map((task, index) => (
                    <div
                      key={`${task.type}-${task.reservation_number}-${index}`}
                      className="p-6 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-medium text-gray-900">
                              {task.project_name} {task.project_stage}
                            </div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.task_status)}`}>
                              {getStatusIcon(task.task_status)}
                              <span className="ml-2">{getStatusText(task.task_status)}</span>
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Reserva {task.reservation_number} • Depto. {task.apartment_number}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Cliente: {task.client_name}
                            {task.broker_name && (
                              <span className="ml-2">• Broker: {task.broker_name}</span>
                            )}
                          </div>
                          <div className="mt-2 text-base text-gray-900">
                            {task.task_name}
                          </div>
                          <div className="mt-2 text-sm">
                            <span className={getDaysSinceAssigned(task.created_at) >= 3 ? "text-red-600 font-bold" : "text-gray-500"}>
                              {task.assigned_by_name ? `Asignado por ${task.assigned_by_name} ` : ''}hace {getDaysSinceAssigned(task.created_at)} días
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskClick(task);
                          }}
                          className="ml-6 flex items-center text-blue-600 hover:text-blue-800"
                        >
                          <span className="mr-2">Ver Flujo</span>
                          <ArrowRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;