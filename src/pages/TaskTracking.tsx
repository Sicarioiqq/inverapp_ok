import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { 
  Search, 
  Loader2, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserCircle,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

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
  started_at?: string;
  completed_at?: string;
  days_to_complete?: number;
  assignee: {
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

const STAGE_ORDER = [
  'Reparos',
  'Reserva',
  'Promesa',
  'Escrituración',
  'Solicitud Liquidación',
  'Aprobación Jefe Inversiones',
  'Aprobación Gerente Comercial',
  'Aprobación Operaciones',
  'Aprobación Control de Gestión',
  'Orden de Compra',
  'Facturación',
  'Pago',
  'Entrada',
];

const TaskTracking = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetchUsers(),
      fetchAllTasks()
    ]);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserTasks(selectedUser);
    } else {
      fetchAllTasks();
    }
  }, [selectedUser]);

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

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const [saleTasks, paymentTasks] = await Promise.all([
        fetchSaleFlowTasks(),
        fetchPaymentFlowTasks()
      ]);

      const allTasks = [...saleTasks, ...paymentTasks].sort((a, b) => {
        // First sort by stage order according to STAGE_ORDER array
        const stageOrderA = STAGE_ORDER.indexOf(a.stage_name);
        const stageOrderB = STAGE_ORDER.indexOf(b.stage_name);
        
        if (stageOrderA !== stageOrderB) {
          return stageOrderA - stageOrderB;
        }
        
        // Then by creation date if stages are the same
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setTasks(allTasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTasks = async (userId: string) => {
    try {
      setLoading(true);
      const [saleTasks, paymentTasks] = await Promise.all([
        fetchSaleFlowTasks(userId),
        fetchPaymentFlowTasks(userId)
      ]);

      const allTasks = [...saleTasks, ...paymentTasks].sort((a, b) => {
        // First sort by stage order according to STAGE_ORDER array
        const stageOrderA = STAGE_ORDER.indexOf(a.stage_name);
        const stageOrderB = STAGE_ORDER.indexOf(b.stage_name);
        
        if (stageOrderA !== stageOrderB) {
          return stageOrderA - stageOrderB;
        }
        
        // Then by creation date if stages are the same
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setTasks(allTasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaleFlowTasks = async (userId?: string): Promise<TaskNotification[]> => {
    try {
      const query = supabase
        .from('task_assignments')
        .select(`
          reservation_flow_id,
          task_id,
          created_at,
          user:profiles!task_assignments_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          ),
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
              client:clients(first_name, last_name),
              broker:brokers(name),
              project:projects(name, stage)
            )
          )
        `);

      if (userId) {
        query.eq('user_id', userId);
      }

      const { data, error } = await query
        .neq('reservation_flow.status', 'pending');

      if (error) throw error;

      // Get task statuses
      const flowTaskStatuses = await Promise.all(
        data!.map(async (assignment) => {
          const { data: statusData, error: statusError } = await supabase
            .from('reservation_flow_tasks')
            .select('status, started_at, completed_at')
            .eq('reservation_flow_id', assignment.reservation_flow_id)
            .eq('task_id', assignment.task_id);

          if (statusError) throw statusError;

          return {
            reservation_flow_id: assignment.reservation_flow_id,
            task_id: assignment.task_id,
            status: statusData?.[0]?.status || 'pending',
            started_at: statusData?.[0]?.started_at,
            completed_at: statusData?.[0]?.completed_at
          };
        })
      );

      // Format tasks
      const formattedTasks = data!.map(assignment => {
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
          created_at: assignment.created_at,
          started_at: taskStatus?.started_at,
          completed_at: taskStatus?.completed_at,
          assignee: assignment.user
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

  const fetchPaymentFlowTasks = async (userId?: string): Promise<TaskNotification[]> => {
    try {
      const query = supabase
        .from('commission_flow_tasks')
        .select(`
          id,
          commission_flow_id,
          task_id,
          status,
          started_at,
          completed_at,
          created_at,
          assignee:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          ),
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
            days_to_complete,
            stage:payment_flow_stages(
              name,
              order
            )
          )
        `);

      if (userId) {
        query.eq('assignee_id', userId);
      }

      const { data, error } = await query
        .neq('commission_flow.status', 'pending')
        .neq('status', 'completed')
        .neq('status', 'blocked');

      if (error) throw error;

      // Format tasks
      return data.map(task => ({
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
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        days_to_complete: task.task.days_to_complete,
        assignee: task.assignee
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

  const getDaysElapsed = (startDate?: string) => {
    if (!startDate) return 0;
    return differenceInDays(new Date(), new Date(startDate));
  };

  const getExpectedDate = (task: TaskNotification) => {
    if (!task.started_at || !task.days_to_complete) return null;
    return addDays(new Date(task.started_at), task.days_to_complete);
  };

  const getDaysOverdue = (task: TaskNotification) => {
    const expectedDate = getExpectedDate(task);
    if (!expectedDate || !task.started_at) return 0;
    
    const endDate = task.completed_at ? new Date(task.completed_at) : new Date();
    const daysElapsed = differenceInDays(endDate, new Date(task.started_at));
    return Math.max(0, daysElapsed - task.days_to_complete!);
  };

  // Group tasks by stage
  const tasksByStage = tasks.reduce((acc, task) => {
    if (!acc[task.stage_name]) {
      acc[task.stage_name] = [];
    }
    acc[task.stage_name].push(task);
    return acc;
  }, {} as Record<string, TaskNotification[]>);

  // Order stages according to STAGE_ORDER
  const orderedStages = Object.entries(tasksByStage)
    .sort(([stageNameA], [stageNameB]) => {
      const orderA = STAGE_ORDER.indexOf(stageNameA);
      const orderB = STAGE_ORDER.indexOf(stageNameB);
      return orderA - orderB;
    });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Mis Tareas Pendientes
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label htmlFor="user" className="block text-sm font-medium text-gray-700">
            Filtrar por Usuario
          </label>
          <select
            id="user"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos los usuarios</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name} - {user.position}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No hay tareas pendientes
          </div>
        ) : (
          <div className="space-y-8">
            {orderedStages.map(([stageName, stageTasks]) => (
              <div key={stageName} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h2 className="text-lg font-medium text-gray-900">
                    {stageName}
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {stageTasks.map((task) => (
                    <div
                      key={`${task.type}-${task.reservation_number}-${task.task_name}`}
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
                          <div className="mt-2 flex items-center">
                            {task.assignee ? (
                              <div className="flex items-center">
                                {task.assignee.avatar_url ? (
                                  <img
                                    src={task.assignee.avatar_url}
                                    alt={`${task.assignee.first_name} ${task.assignee.last_name}`}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <UserCircle className="h-8 w-8 text-gray-400" />
                                )}
                                <span className="ml-2 text-sm font-medium text-gray-700">
                                  {task.assignee.first_name} {task.assignee.last_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">
                                Sin asignar
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-500">
                            {task.started_at ? (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                <span>
                                  Iniciada hace {getDaysElapsed(task.started_at)} días
                                </span>
                                {task.days_to_complete && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span>Plazo: {task.days_to_complete} días</span>
                                    {getDaysOverdue(task) > 0 && (
                                      <span className="ml-2 flex items-center text-red-600">
                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                        {getDaysOverdue(task)} días de retraso
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>
                                  Asignada el {new Date(task.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            )}
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

export default TaskTracking;