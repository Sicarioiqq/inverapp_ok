import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import StageCard from '../../components/StageCard';
import TaskAssignmentPopup from '../../components/TaskAssignmentPopup';
import TaskCommentPopup from '../../components/TaskCommentPopup';
import RescindReservationPopup from '../../components/RescindReservationPopup';
import ClientMultipleReservationsAlert from '../../components/ClientMultipleReservationsAlert';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Ban } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  status: string;
  completed_at?: string;
  assignees: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }[];
  comments_count: number;
}

interface ReservationFlow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  current_stage_id: string;
  flow_id: string;
  reservation: {
    id: string;
    reservation_number: string;
    client: {
      id: string;
      first_name: string;
      last_name: string;
    };
    project: {
      name: string;
      stage: string;
    };
    apartment_number: string;
    is_rescinded: boolean;
    broker?: {
      name: string;
    };
    broker_commission?: {
      id: string;
      commission_amount: number;
      at_risk: boolean;
      at_risk_reason: string | null;
    };
  };
}

const ReservationFlowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<ReservationFlow | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Validate UUID format using a regular expression
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      setError('ID de flujo de reserva inválido');
      setLoading(false);
      return;
    }

    fetchFlowDetails();
    checkAdminStatus();
  }, [id]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.user_type === 'Administrador');
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const fetchFlowDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch flow details
      const { data: flowData, error: flowError } = await supabase
        .from('reservation_flows')
        .select(`
          id,
          status,
          started_at,
          completed_at,
          current_stage_id,
          flow_id,
          reservation:reservations!inner(
            id,
            reservation_number,
            client:clients!inner(id, first_name, last_name),
            project:projects!inner(name, stage),
            apartment_number,
            is_rescinded,
            broker:brokers(name),
            broker_commission:broker_commissions(
              id,
              commission_amount,
              at_risk,
              at_risk_reason
            )
          )
        `)
        .eq('id', id)
        .single();

      if (flowError) {
        console.error('Flow fetch error:', flowError);
        throw new Error('Error al cargar los detalles del flujo');
      }
      
      if (!flowData) {
        throw new Error('Flujo de reserva no encontrado');
      }

      setFlow(flowData);

      // Only fetch stages if we have a valid flow_id
      if (flowData.flow_id) {
        // Fetch flow stages and tasks
        const { data: stagesData, error: stagesError } = await supabase
          .from('sale_flow_stages')
          .select(`
            id,
            name,
            order
          `)
          .eq('flow_id', flowData.flow_id)
          .order('order');

        if (stagesError) {
          console.error('Stages fetch error:', stagesError);
          throw new Error('Error al cargar las etapas del flujo');
        }

        // Fetch tasks for each stage
        const stagesWithTasks = await Promise.all(
          stagesData.map(async (stage) => {
            const { data: tasksData, error: tasksError } = await supabase
              .from('sale_flow_tasks')
              .select(`
                id,
                name,
                order
              `)
              .eq('stage_id', stage.id)
              .order('order');

            if (tasksError) {
              console.error('Tasks fetch error:', tasksError);
              throw new Error('Error al cargar las tareas');
            }

            // Fetch task status and assignees
            const tasksWithDetails = await Promise.all(
              tasksData.map(async (task) => {
                // Get task status
                const { data: taskStatusData, error: taskStatusError } = await supabase
                  .from('reservation_flow_tasks')
                  .select('id, status, completed_at')
                  .eq('reservation_flow_id', id)
                  .eq('task_id', task.id)
                  .maybeSingle();

                if (taskStatusError && taskStatusError.code !== 'PGRST116') {
                  console.error('Task status fetch error:', taskStatusError);
                  throw new Error('Error al cargar el estado de las tareas');
                }

                // Get task assignees
                const { data: assigneesData, error: assigneesError } = await supabase
                  .from('task_assignments')
                  .select(`
                    user:profiles!task_assignments_user_id_fkey(
                      id,
                      first_name,
                      last_name,
                      avatar_url
                    )
                  `)
                  .eq('reservation_flow_id', id)
                  .eq('task_id', task.id);

                if (assigneesError) {
                  console.error('Assignees fetch error:', assigneesError);
                  throw new Error('Error al cargar los asignados');
                }

                // Get comments count only if we have a valid task status
                let commentsCount = 0;
                if (taskStatusData?.id) {
                  const { count, error: commentsError } = await supabase
                    .from('task_comments')
                    .select('id', { count: 'exact', head: true })
                    .eq('reservation_flow_task_id', taskStatusData.id);

                  if (commentsError && commentsError.code !== 'PGRST116') {
                    console.error('Comments count error:', commentsError);
                    throw new Error('Error al cargar el conteo de comentarios');
                  }

                  commentsCount = count || 0;
                }

                return {
                  id: task.id,
                  name: task.name,
                  status: taskStatusData?.status || 'pending',
                  completed_at: taskStatusData?.completed_at,
                  assignees: assigneesData?.map(a => a.user) || [],
                  comments_count: commentsCount
                };
              })
            );

            return {
              id: stage.id,
              name: stage.name,
              tasks: tasksWithDetails
            };
          })
        );

        setStages(stagesWithTasks);
      }
    } catch (err: any) {
      console.error('Error fetching flow details:', err);
      setError(err.message || 'Error al cargar los detalles del flujo');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (taskId: string) => {
    // Get current assignees for this task
    const currentStage = stages.find(stage => 
      stage.tasks.some(task => task.id === taskId)
    );
    
    const currentTask = currentStage?.tasks.find(task => task.id === taskId);
    const currentAssignees = currentTask?.assignees.map(a => a.id) || [];

    showPopup(
      <TaskAssignmentPopup
        taskId={taskId}
        reservationFlowId={id!}
        currentAssignees={currentAssignees}
        onSave={fetchFlowDetails}
        onClose={() => {}}
      />,
      {
        title: 'Asignar Responsables',
        size: 'md'
      }
    );
  };

  const handleComment = (taskId: string) => {
    showPopup(
      <TaskCommentPopup
        taskId={taskId}
        reservationFlowId={id!}
        onSave={fetchFlowDetails}
        onClose={() => {}}
      />,
      {
        title: 'Agregar Comentario',
        size: 'md'
      }
    );
  };

  const handleStatusChange = async (taskId: string, status: string, completedAt?: string) => {
    try {
      // First, get the reservation_flow_task_id
      const { data: taskData, error: taskError } = await supabase
        .from('reservation_flow_tasks')
        .select('id')
        .eq('reservation_flow_id', id)
        .eq('task_id', taskId)
        .maybeSingle();

      if (taskError) throw taskError;

      if (taskData) {
        // Update the task status
        const updateData: { status: string; completed_at?: string | null } = { status };
        
        if (status === 'completed') {
          updateData.completed_at = completedAt || new Date().toISOString();
        } else if (completedAt) {
          updateData.completed_at = completedAt;
        }

        const { error: updateError } = await supabase
          .from('reservation_flow_tasks')
          .update(updateData)
          .eq('id', taskData.id);

        if (updateError) throw updateError;

        // Refresh the flow details
        fetchFlowDetails();
      } else {
        // Create a new task if it doesn't exist
        const { error: insertError } = await supabase
          .from('reservation_flow_tasks')
          .insert({
            reservation_flow_id: id,
            task_id: taskId,
            status,
            completed_at: status === 'completed' ? (completedAt || new Date().toISOString()) : null
          });

        if (insertError) throw insertError;

        // Refresh the flow details
        fetchFlowDetails();
      }
    } catch (err: any) {
      console.error('Error updating task status:', err);
      setError(err.message);
    }
  };

  const handleRescind = () => {
    if (!flow) return;

    showPopup(
      <RescindReservationPopup
        reservationId={flow.reservation.id}
        reservationNumber={flow.reservation.reservation_number}
        hasPaidCommission={false}
        commissionAmount={flow.reservation.broker_commission?.commission_amount || null}
        brokerCommissionId={flow.reservation.broker_commission?.id || null}
        onSave={() => {
          fetchFlowDetails();
        }}
        onClose={() => {}}
      />,
      {
        title: 'Resciliar Reserva',
        size: 'md'
      }
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <Ban className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Proceso';
      case 'cancelled':
        return 'Cancelado';
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
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !flow) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'No se encontró el flujo de reserva'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/flujo-reservas')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Flujo de Reserva {flow.reservation.reservation_number}
          </h1>
        </div>

        {/* Client Multiple Reservations Alert */}
        {flow.reservation.client.id && (
          <ClientMultipleReservationsAlert 
            clientId={flow.reservation.client.id} 
            currentReservationId={flow.reservation.id} 
          />
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Información de la Reserva
              </h2>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-500">Cliente:</span>
                  <p className="text-gray-900">
                    {flow.reservation.client.first_name} {flow.reservation.client.last_name}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Proyecto:</span>
                  <p className="text-gray-900">
                    {flow.reservation.project.name} {flow.reservation.project.stage}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Departamento:</span>
                  <p className="text-gray-900">{flow.reservation.apartment_number}</p>
                </div>
                {flow.reservation.broker && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Broker:</span>
                    <p className="text-gray-900">{flow.reservation.broker.name}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Estado del Flujo
              </h2>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-500 mr-2">Estado:</span>
                  <span className={`px-3 py-1 inline-flex items-center rounded-full text-sm font-medium ${getStatusColor(flow.status)}`}>
                    {getStatusIcon(flow.status)}
                    <span className="ml-2">{getStatusText(flow.status)}</span>
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Fecha de Inicio:</span>
                  <p className="text-gray-900">
                    {new Date(flow.started_at).toLocaleDateString()}
                  </p>
                </div>
                {flow.completed_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Fecha de Completado:</span>
                    <p className="text-gray-900">
                      {new Date(flow.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Acciones
              </h2>
              <div className="space-y-2">
                {flow.reservation.is_rescinded ? (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Ban className="h-5 w-5 text-red-500 mr-2" />
                      <span className="text-red-700 font-medium">Reserva Resciliada</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleRescind}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Resciliar Reserva
                  </button>
                )}
                
                {flow.reservation.broker_commission?.at_risk && (
                  <div className="mt-4 bg-amber-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
                      <span className="text-amber-700 font-medium">Comisión En Riesgo</span>
                    </div>
                    {flow.reservation.broker_commission.at_risk_reason && (
                      <p className="mt-1 text-sm text-amber-600">
                        {flow.reservation.broker_commission.at_risk_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {stages.map((stage) => (
            <StageCard
              key={stage.id}
              title={stage.name}
              tasks={stage.tasks}
              isCompleted={stage.tasks.every(task => task.status === 'completed')}
              onAssign={handleAssign}
              onComment={handleComment}
              onStatusChange={handleStatusChange}
              reservationFlowId={id!}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ReservationFlowDetail;