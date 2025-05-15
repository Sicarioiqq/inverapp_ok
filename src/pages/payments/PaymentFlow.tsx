import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCircle,
  UserPlus,
  MessageSquare,
  Play,
  Loader2,
  Calendar,
  AlertTriangle,
  Timer,
  Edit,
  ChevronDown,
  ChevronRight,
  Edit2,
  Users,
  ListChecks,
  FileText,
  ClipboardList,
  DollarSign,
  Plus
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

interface Task {
  id: string;
  commission_flow_task_id?: string;
  name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  assigned_at?: string;
  expected_date?: string;
  days_to_complete?: number;
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  default_assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  comments_count: number;
  isCollapsed?: boolean;
}

interface Stage {
  id: string;
  name: string;
  tasks: Task[];
  isCompleted: boolean;
  isExpanded: boolean;
}

interface PaymentFlow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  is_second_payment: boolean;
  flow: {
    id: string;
  };
  broker_commission: {
    id: string;
    commission_amount: number;
    number_of_payments: number;
    first_payment_percentage: number;
    at_risk: boolean;
    at_risk_reason: string | null;
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
      broker: {
        id: string;
        name: string;
      };
    };
  };
  current_stage: {
    id: string;
    name: string;
  } | null;
  stages: Stage[];
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url?: string;
}

const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<any> => {
  let retries = 0;
  let delay = initialDelay;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      const isRetryableError =
        error?.message?.includes('cannot ALTER TABLE') ||
        error?.code === '55006';
      if (retries >= maxRetries || !isRetryableError) {
        throw error;
      }
      retries++;
      console.log(`Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<PaymentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [startingFlow, setStartingFlow] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingTaskDate, setEditingTaskDate] = useState<{
    taskId: string;
    type: 'start' | 'complete';
  } | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  const [creatingSecondFlow, setCreatingSecondFlow] = useState(false);
  const [tempDateValue, setTempDateValue] = useState('');
  const [markingAtRisk, setMarkingAtRisk] = useState(false);

  useEffect(() => {
    if (id) {
      Promise.all([
        fetchFlow(),
        fetchUsers(),
        checkAdminStatus()
      ]);
    } else {
      navigate('/pagos');
    }
  }, [id, commentRefreshTrigger]);

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

  const fetchUsers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, position, avatar_url')
        .order('first_name');
      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchFlow = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: flowData, error: flowError } = await supabase
        .from('commission_flows')
        .select(`
          id, status, started_at, completed_at, is_second_payment,
          flow:payment_flows(id),
          current_stage:payment_flow_stages(id, name),
          broker_commission:broker_commissions(
            id, commission_amount, number_of_payments, first_payment_percentage, at_risk, at_risk_reason,
            reservation:reservations(
              id, reservation_number, apartment_number,
              client:clients(id, first_name, last_name),
              project:projects(name, stage),
              broker:brokers(id, name)
            )
          )
        `)
        .eq('id', id)
        .single();
      if (flowError) throw flowError;

      const { data: stagesData, error: stagesError } = await supabase
        .from('payment_flow_stages')
        .select(`
          id, name, order,
          tasks:payment_flow_tasks(id, name, days_to_complete, default_assignee:profiles(id, first_name, last_name, avatar_url))
        `)
        .eq('flow_id', flowData.flow.id)
        .order('order', { ascending: true });
      if (stagesError) throw stagesError;

      const { data: flowTasks, error: tasksError } = await supabase
        .from('commission_flow_tasks')
        .select(`id, task_id, status, started_at, completed_at, assigned_at, assignee:profiles(id, first_name, last_name, avatar_url)`)
        .eq('commission_flow_id', id);
      if (tasksError) throw tasksError;
      
      const commissionFlowTaskIds = flowTasks?.map(ft => ft.id) || [];
      let commentsData: { commission_flow_task_id: string }[] = [];
      if (commissionFlowTaskIds.length > 0) {
        const { data: fetchedCommentsData, error: commentsFetchError } = await supabase
          .from('commission_task_comments')
          .select('commission_flow_task_id')
          .in('commission_flow_task_id', commissionFlowTaskIds);
        if (commentsFetchError) throw commentsFetchError;
        commentsData = fetchedCommentsData || [];
      }
      
      const commentCounts: Record<string, number> = {};
      commentsData.forEach(comment => {
        if (comment.commission_flow_task_id) {
          commentCounts[comment.commission_flow_task_id] = (commentCounts[comment.commission_flow_task_id] || 0) + 1;
        }
      });

      const stages = stagesData?.map(stage => {
        const stageTasks = stage.tasks.map(taskTemplate => {
          const flowTaskInstance = flowTasks?.find(ft => ft.task_id === taskTemplate.id);
          const isCompleted = flowTaskInstance?.status === 'completed';
          const taskCommentCount = flowTaskInstance ? (commentCounts[flowTaskInstance.id] || 0) : 0;

          return {
            id: taskTemplate.id,
            commission_flow_task_id: flowTaskInstance?.id,
            name: taskTemplate.name,
            status: flowTaskInstance?.status || 'blocked',
            started_at: flowTaskInstance?.started_at,
            completed_at: flowTaskInstance?.completed_at,
            assigned_at: flowTaskInstance?.assigned_at,
            days_to_complete: taskTemplate.days_to_complete,
            assignee: flowTaskInstance?.assignee,
            default_assignee: taskTemplate.default_assignee,
            comments_count: taskCommentCount,
            isCollapsed: isCompleted, 
          };
        });

        return {
          id: stage.id,
          name: stage.name,
          tasks: stageTasks,
          isCompleted: stageTasks.every(task => task.status === 'completed'),
          isExpanded: true,
        };
      }) || [];

      setFlow({ ...flowData, stages });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFlow = async () => {
    if (!flow) return;
    try {
      setStartingFlow(true); setError(null);
      const { error: updateError } = await supabase.from('commission_flows').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', flow.id);
      if (updateError) throw updateError;
      await fetchFlow();
    } catch (err: any) { setError(err.message); } finally { setStartingFlow(false); }
  };

  const handleStartDateChange = async (date: string) => {
    if (!flow) return;
    try {
      setLoading(true);
      const { error: updateError } = await supabase.from('commission_flows').update({ started_at: date }).eq('id', flow.id);
      if (updateError) throw updateError;
      await fetchFlow();
      setEditingStartDate(false);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };
  
  const handleTaskDateChange = async (templateTaskId: string, date: string, type: 'start' | 'complete') => {
    if (!flow) return;
    try {
      setLoading(true);
      const { data: flowTask, error: taskError } = await supabase.from('commission_flow_tasks').select('id').eq('commission_flow_id', flow.id).eq('task_id', templateTaskId).maybeSingle();
      if (taskError) throw taskError;
      if (flowTask) {
        await retryOperation(async () => {
          const { error: updateError } = await supabase.from('commission_flow_tasks').update({ [type === 'start' ? 'started_at' : 'completed_at']: date }).eq('id', flowTask.id);
          if (updateError) throw updateError;
        });
      }
      await fetchFlow();
      setEditingTaskDate(null);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleAssign = async (templateTaskId: string, currentAssignee: User | null, defaultAssignee: User | null) => {
    if (!flow || flow.status === 'pending') return;
    try {
      if (!currentAssignee && defaultAssignee) { await assignUser(templateTaskId, defaultAssignee); return; }
      const selectedUser = await new Promise<User | null>((resolve) => {
        showPopup(
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto">
              {users.map((user) => (
                <button key={user.id} onClick={() => resolve(user)} className={`w-full flex items-center p-3 rounded-lg hover:bg-gray-50 ${currentAssignee?.id === user.id ? 'bg-blue-50' : ''}`}>
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? <img src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} className="h-full w-full object-cover"/> : <UserCircle className="h-6 w-6 text-gray-500" />}
                  </div>
                  <div className="ml-3 text-left"><div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div><div className="text-sm text-gray-500">{user.position}</div></div>
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={() => resolve(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancelar</button>
              {currentAssignee && (<button type="button" onClick={() => resolve({ id: '', first_name: '', last_name: '', position: '' })} className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md shadow-sm hover:bg-red-50">Quitar Asignación</button>)}
            </div>
          </div>,
          { title: 'Asignar Responsable', size: 'md' }
        );
      });
      if (!selectedUser) return;
      await assignUser(templateTaskId, selectedUser);
    } catch (err: any) { setError(err.message); }
  };

  const assignUser = async (templateTaskId: string, user: User) => {
    if (!flow) return;
    try {
      const { data: flowTask, error: taskError } = await retryOperation(async () => {
        return await supabase.from('commission_flow_tasks').select('id').eq('commission_flow_id', flow.id).eq('task_id', templateTaskId).maybeSingle();
      });
      if (taskError) throw taskError;
      if (flowTask) {
        await retryOperation(async () => {
          const { error: updateError } = await supabase.from('commission_flow_tasks').update({ assignee_id: user.id || null, assigned_at: user.id ? new Date().toISOString() : null }).eq('id', flowTask.id);
          if (updateError) throw updateError;
        });
      } else {
        await retryOperation(async () => {
          const { error: createError } = await supabase.from('commission_flow_tasks').insert({ commission_flow_id: flow.id, task_id: templateTaskId, status: 'pending', assignee_id: user.id || null, assigned_at: user.id ? new Date().toISOString() : null });
          if (createError) throw createError;
        });
      }
      fetchFlow();
    } catch (err: any) { setError(err.message); }
  };
  
  useEffect(() => {
    if (flow?.status === 'in_progress') {
      flow.stages.forEach(stage =>
        stage.tasks.forEach(task => {
          if (!task.assignee && task.default_assignee) {
            assignUser(task.id, task.default_assignee);
          }
        })
      );
    }
  }, [flow?.status, flow?.stages]);

  useEffect(() => {
    if (!flow) return;
    const pendingStageId = flow.current_stage?.id || flow.stages.find(s => !s.isCompleted)?.id;
    if (pendingStageId) {
      const el = document.getElementById(`stage-${pendingStageId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  }, [flow]);

  const handleStatusChange = async (templateTaskId: string, newStatus: string) => {
    if (!flow || flow.status === 'pending') return;
    try {
      const { data: flowTask, error: taskError } = await retryOperation(async () => {
        return await supabase.from('commission_flow_tasks').select('id, started_at').eq('commission_flow_id', flow.id).eq('task_id', templateTaskId).maybeSingle();
      });
      if (taskError) throw taskError;

      const updateData: { status: string, completed_at?: string, started_at?: string } = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        if (!flowTask?.started_at) {
          updateData.started_at = new Date().toISOString();
        }
      } else if (newStatus === 'in_progress' && !flowTask?.started_at) {
         updateData.started_at = new Date().toISOString();
      }

      if (flowTask) {
        await retryOperation(async () => {
          const { error: updateError } = await supabase.from('commission_flow_tasks').update(updateData).eq('id', flowTask.id);
          if (updateError) throw updateError;
        });
      } else {
         const insertData: any = { commission_flow_id: flow.id, task_id: templateTaskId, status: newStatus };
        if (newStatus === 'in_progress' || newStatus === 'completed') insertData.started_at = new Date().toISOString();
        if (newStatus === 'completed') insertData.completed_at = new Date().toISOString();
        await retryOperation(async () => {
          const { error: createError } = await supabase.from('commission_flow_tasks').insert(insertData);
          if (createError) throw createError;
        });
      }
      fetchFlow();
    } catch (err: any) { setError(err.message); }
  };
  
  const handleAddComment = async (taskInstanceId: string | undefined) => {
    if (!flow || flow.status === 'pending' || !taskInstanceId) {
        if(!taskInstanceId) setError("No se pudo encontrar la tarea para comentar.");
        return;
    }
    showPopup(
      <CommissionTaskCommentPopup taskId={taskInstanceId} commissionFlowId={flow.id} onSave={() => { fetchFlow(); }} onClose={() => showPopup(null)}/>,
      { title: 'Agregar Comentario', size: 'md' }
    );
  };

  const toggleTaskComments = (taskInstanceId: string | undefined) => {
    if(!taskInstanceId) return;
    setExpandedTaskId(expandedTaskId === taskInstanceId ? null : taskInstanceId);
  };

  const toggleTaskCollapse = (stageIndex: number, taskIndex: number) => {
    if (!flow) return;
    const newStages = flow.stages.map((stage, sIndex) => {
      if (sIndex === stageIndex) {
        const newTasks = stage.tasks.map((task, tIndex) => {
          if (tIndex === taskIndex && task.status === 'completed') {
            return { ...task, isCollapsed: !task.isCollapsed };
          }
          return task;
        });
        return { ...stage, tasks: newTasks };
      }
      return stage;
    });
    setFlow({ ...flow, stages: newStages });
  };

  const toggleStage = (stageIndex: number) => {
    if (!flow) return;
    const updatedStages = [...flow.stages];
    updatedStages[stageIndex].isExpanded = !updatedStages[stageIndex].isExpanded;
    setFlow({ ...flow, stages: updatedStages });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress': return <Clock className="h-5 w-5 text-blue-600" />;
      case 'blocked': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completada';
      case 'in_progress': return 'En Proceso';
      case 'blocked': return 'Bloqueada';
      default: return 'Pendiente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = () => {
    if (!flow) return 0;
    const totalTasks = flow.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
    if (totalTasks === 0) return 0;
    const completedTasks = flow.stages.reduce((sum, stage) =>
      sum + stage.tasks.filter(task => task.status === 'completed').length, 0);
    return (completedTasks / totalTasks) * 100;
  };

  const getDaysElapsed = (startDate?: string, endDate?: string) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    return differenceInDays(end, start);
  };

  const getExpectedDate = (task: Task) => {
    if (!flow?.started_at || !task.days_to_complete) return null;
    return addDays(new Date(flow.started_at), task.days_to_complete);
  };

  const getDaysOverdue = (task: Task) => {
    // No calcular retraso si la tarea está completada o no tiene fecha de inicio o días para completar
    if (task.status === 'completed' || !task.started_at || typeof task.days_to_complete !== 'number') return 0;
    
    const startDate = new Date(task.started_at);
    const expectedCompletionDate = addDays(startDate, task.days_to_complete);
    const today = new Date();
  
    // Solo hay retraso si hoy es después de la fecha esperada de completación
    if (today > expectedCompletionDate) {
      return differenceInDays(today, expectedCompletionDate);
    }
    return 0; // No hay retraso si aún no ha pasado la fecha esperada
  };
  
  const formatDate = (dateString: string) => formatDateChile(dateString);
  const formatDateTime = (dateString: string) => formatDateTimeChile(dateString);

  const navigateToEditClient = () => { if (flow?.broker_commission.reservation.client.id) navigate(`/clientes/editar/${flow.broker_commission.reservation.client.id}`); };
  const navigateToEditReservation = () => { if (flow?.broker_commission.reservation.id) navigate(`/reservas/editar/${flow.broker_commission.reservation.id}`); };
  const navigateToEditCommission = () => { if (flow?.broker_commission.reservation.id) navigate(`/pagos/${flow.broker_commission.reservation.id}`); };
  const navigateToReservationFlow = async () => {
    if (!flow?.broker_commission.reservation.id) return;
    try {
      const { data, error: fetchError } = await supabase.from('reservation_flows').select('id').eq('reservation_id', flow.broker_commission.reservation.id).single();
      if (fetchError) throw fetchError;
      if (data) navigate(`/flujo-reservas/${data.id}`);
    } catch (err: any) { setError(err.message); }
  };
  const navigateToDocuments = () => showPopup(<div className="p-4"><p>Funcionalidad de documentos en desarrollo.</p></div>, { title: 'Documentos del Cliente', size: 'md' });
  const navigateToTaskTracking = () => navigate('/seguimiento');

  const handleCreateSecondPaymentFlow = async () => {
    if (!flow || !flow.broker_commission.id) return;
    try {
      setCreatingSecondFlow(true);
      const { data: existingFlow, error: checkError } = await supabase.from('commission_flows').select('id').eq('broker_commission_id', flow.broker_commission.id).eq('is_second_payment', true).maybeSingle();
      if (checkError) throw checkError;
      if (existingFlow) { navigate(`/pagos/flujo/${existingFlow.id}`); return; }

      const { data: flowData, error: flowError } = await supabase.from('payment_flows').select('id, stages:payment_flow_stages(id, order)').eq('name', 'Flujo de Segundo Pago').single();
      if (flowError || !flowData || !flowData.stages || flowData.stages.length === 0) throw flowError || new Error("Flujo de segundo pago o sus etapas no configurados.");
      
      const firstStage = flowData.stages.sort((a:any, b:any) => a.order - b.order)[0];

      const { data: newFlow, error: createError } = await supabase.from('commission_flows').insert({ broker_commission_id: flow.broker_commission.id, flow_id: flowData.id, current_stage_id: firstStage.id, status: 'pending', started_at: null, is_second_payment: true }).select().single();
      if (createError) throw createError;
      navigate(`/pagos/flujo/${newFlow.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSecondFlow(false);
    }
  };

  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => {
    const newDate = e.target.value;
    setTempDateValue(newDate);
    if (newDate) {
      await handleTaskDateChange(templateTaskId, newDate, type);
    }
  };
  
  const handleToggleAtRisk = () => {
    if (!flow) return;
    showPopup(
      <AtRiskPopup commissionId={flow.broker_commission.id} isAtRisk={flow.broker_commission.at_risk || false} reason={flow.broker_commission.at_risk_reason || ''} onSave={fetchFlow} onClose={() => { /* hidePopup() si es necesario */ }} />,
      { title: flow.broker_commission.at_risk ? 'Editar Estado En Riesgo' : 'Marcar Como En Riesgo', size: 'md' }
    );
  };

  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  if (error || !flow) { return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg">{error || 'Flujo no encontrado'}</div></Layout>; }

  const canCreateSecondPaymentFlow = flow.status === 'completed' && flow.broker_commission.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header y Navegación de Iconos */}
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-2" /> Volver
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
                {flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow.broker_commission.reservation.reservation_number}
            </h1>
            <div className="flex space-x-3">
                <button onClick={navigateToEditClient} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Cliente"><Users className="h-5 w-5" /></button>
                <button onClick={navigateToEditReservation} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Reserva"><Edit2 className="h-5 w-5" /></button>
                <button onClick={navigateToEditCommission} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Comisión"><DollarSign className="h-5 w-5" /></button>
                <button onClick={navigateToReservationFlow} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Flujo de Reserva"><ListChecks className="h-5 w-5" /></button>
                <button onClick={navigateToDocuments} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Documentos"><FileText className="h-5 w-5" /></button>
                <button onClick={navigateToTaskTracking} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Seguimiento de Tareas"><ClipboardList className="h-5 w-5" /></button>
            </div>
        </div>
        
        {/* Información General y Estado del Proceso */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> {/* Información General */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
                    <dl className="space-y-2">
                        <div><dt className="text-sm font-medium text-gray-500">Cliente</dt><dd className="text-sm text-gray-900">{flow.broker_commission.reservation.client.first_name} {flow.broker_commission.reservation.client.last_name}</dd></div>
                        <div><dt className="text-sm font-medium text-gray-500">Proyecto</dt><dd className="text-sm text-gray-900">{flow.broker_commission.reservation.project.name} {flow.broker_commission.reservation.project.stage} - {flow.broker_commission.reservation.apartment_number}</dd></div>
                        <div><dt className="text-sm font-medium text-gray-500">Broker</dt><dd className="text-sm text-gray-900">{flow.broker_commission.reservation.broker.name}</dd></div>
                        <div><dt className="text-sm font-medium text-gray-500">Monto Comisión</dt><dd className="text-sm text-gray-900">{flow.is_second_payment ? `${((100 - flow.broker_commission.first_payment_percentage) / 100 * flow.broker_commission.commission_amount).toFixed(2)} UF (${100 - flow.broker_commission.first_payment_percentage}%)` : `${((flow.broker_commission.first_payment_percentage / 100) * flow.broker_commission.commission_amount).toFixed(2)} UF (${flow.broker_commission.first_payment_percentage}%)`}</dd></div>
                        {flow.broker_commission.number_of_payments === 2 && (<div><dt className="text-sm font-medium text-gray-500">Tipo de Pago</dt><dd className="text-sm text-gray-900">{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd></div>)}
                        {flow.broker_commission.at_risk && (<div><dt className="text-sm font-medium text-gray-500">Estado</dt><dd className="text-sm flex items-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</span>{flow.broker_commission.at_risk_reason && (<span className="ml-2 text-gray-500 italic">{flow.broker_commission.at_risk_reason}</span>)}</dd></div>)}
                    </dl>
                </div>
                <div> {/* Estado del Proceso */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Estado del Proceso</h2>
                        <div className="flex space-x-2">
                            {isAdmin && flow.status === 'pending' && (<button onClick={handleStartFlow} disabled={startingFlow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">{startingFlow ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Iniciando...</>) : (<><Play className="h-4 w-4 mr-2" />Proceder con Pago</>)}</button>)}
                            {canCreateSecondPaymentFlow && (<button onClick={handleCreateSecondPaymentFlow} disabled={creatingSecondFlow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">{creatingSecondFlow ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Creando...</>) : (<><Plus className="h-4 w-4 mr-2" />Crear Segundo Pago</>)}</button>)}
                            {flow.status === 'in_progress' && !flow.broker_commission.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">{markingAtRisk ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Procesando...</>) : (<><AlertCircle className="h-4 w-4 mr-2" />Marcar En Riesgo</>)}</button>)}
                            {flow.status === 'in_progress' && flow.broker_commission.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">{markingAtRisk ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Procesando...</>) : (<><Edit className="h-4 w-4 mr-2" />Editar Estado Riesgo</>)}</button>)}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div><div className="flex justify-between text-sm font-medium text-gray-500 mb-1"><span>Progreso</span><span>{Math.round(calculateProgress())}%</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div></div></div>
                        <div><dt className="text-sm font-medium text-gray-500">Iniciado</dt><dd className="text-sm text-gray-900">{flow.started_at ? (<div className="flex items-center">{editingStartDate ? (<input type="datetime-local" defaultValue={flow.started_at.split('.')[0]} onChange={(e) => handleStartDateChange(e.target.value)} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />) : (<><span>{formatDateTime(flow.started_at)}</span>{isAdmin && (<button onClick={() => setEditingStartDate(true)} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha"><Edit className="h-4 w-4" /></button>)}</>)}</div>) : (<span className="text-gray-500">No iniciado</span>)}</dd></div>
                        {flow.completed_at && (<div><dt className="text-sm font-medium text-gray-500">Completado</dt><dd className="text-sm text-gray-900">{formatDateTime(flow.completed_at)}</dd></div>)}
                        <div><dt className="text-sm font-medium text-gray-500">Días Transcurridos</dt><dd className="text-sm text-gray-900">{getDaysElapsed(flow.started_at || undefined, flow.completed_at)} días</dd></div>
                        <div><dt className="text-sm font-medium text-gray-500">Etapa Actual</dt><dd className="text-sm text-gray-900">{flow.current_stage?.name || 'No iniciado'}</dd></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-6">
          {flow.stages.map((stage, stageIndex) => (
            <div id={`stage-${stage.id}`} key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div
                className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between cursor-pointer"
                onClick={() => toggleStage(stageIndex)}
              >
                <div className="flex items-center">
                  {stage.isExpanded ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                  <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                </div>
                {stage.isCompleted && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completada</span>
                )}
              </div>

              {stage.isExpanded && (
                <div className="divide-y divide-gray-200">
                  {stage.tasks.map((task, taskIndex) => {
                    const isTaskCompleted = task.status === 'completed';
                    const showCollapsedView = isTaskCompleted && task.isCollapsed;

                    const completionTime = task.completed_at && task.started_at ? getDaysElapsed(task.started_at, task.completed_at) : null;
                    const daysOverdue = getDaysOverdue(task); // Cálculo de días de retraso
                    
                    return (
                      <div key={task.id} className={`p-6 ${showCollapsedView ? 'py-3' : 'hover:bg-gray-50'}`}>
                        {showCollapsedView ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                              <h4 className="text-base font-medium text-gray-700">
                                {task.name}
                              </h4>
                            </div>
                            <button
                              onClick={() => toggleTaskCollapse(stageIndex, taskIndex)}
                              className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50"
                              title="Expandir tarea"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className={`text-base font-medium ${isTaskCompleted ? 'text-gray-700' : 'text-gray-900'}`}>
                                    {task.name}
                                  </h4>
                                  {isTaskCompleted ? (
                                    <button
                                      onClick={() => toggleTaskCollapse(stageIndex, taskIndex)}
                                      className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50"
                                      title="Colapsar tarea"
                                    >
                                      <ChevronDown className="h-5 w-5" />
                                    </button>
                                  ) : (
                                    <select
                                      value={task.status}
                                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                      disabled={flow.status === 'pending'}
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        getStatusColor(task.status)
                                      } border-0 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}
                                    >
                                      <option value="pending">Pendiente</option>
                                      <option value="in_progress">En Proceso</option>
                                      <option value="completed">Completada</option>
                                      <option value="blocked">Bloqueada</option>
                                    </select>
                                  )}
                                </div>

                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  {task.assignee ? (
                                    <div className="flex items-center">
                                      {task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt={`${task.assignee.first_name} ${task.assignee.last_name}`} className="h-8 w-8 rounded-full object-cover"/> : <UserCircle className="h-8 w-8 text-gray-400" />}
                                      <span className="ml-2 text-sm text-gray-600">{task.assignee.first_name} {task.assignee.last_name}</span>
                                    </div>
                                  ) : task.default_assignee ? (
                                    <button onClick={() => handleAssign(task.id, null, task.default_assignee)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar a {task.default_assignee.first_name}</span></button>
                                  ) : (
                                    <button onClick={() => handleAssign(task.id, null, null)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar</span></button>
                                  )}
                                  <button onClick={() => handleAddComment(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700 relative" disabled={flow.status === 'pending' || !task.commission_flow_task_id}>
                                    <MessageSquare className="h-5 w-5 mr-1" /><span>Comentar</span>
                                    {task.comments_count > 0 && (<span className="absolute -top-1 -right-1 h-4 w-4 text-xs flex items-center justify-center bg-blue-600 text-white rounded-full">{task.comments_count}</span>)}
                                  </button>
                                  <button onClick={() => toggleTaskComments(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700" disabled={flow.status === 'pending' || task.comments_count === 0 || !task.commission_flow_task_id}>
                                    <span>Ver comentarios</span> <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${expandedTaskId === task.commission_flow_task_id ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>

                                <div className="mt-2 text-sm text-gray-500">
                                  {task.started_at && (
                                    <div className="flex flex-col space-y-2">
                                      <div className="flex items-center">
                                        {editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'start' ? (
                                          <input type="datetime-local" defaultValue={task.started_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'start')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                                        ) : (
                                          <div className="flex items-center"><Calendar className="h-4 w-4 mr-1" /><span>Iniciada el {formatDateTime(task.started_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'start' }); if(task.started_at){setTempDateValue(task.started_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de inicio"><Edit className="h-4 w-4" /></button>)}</div>
                                        )}
                                      </div>
                                      {task.completed_at && (
                                        <div className="flex items-center">
                                          {editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'complete' ? (
                                            <input type="datetime-local" defaultValue={task.completed_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'complete')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                                          ) : (
                                            <div className="flex items-center text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" /><span>Completada el {formatDateTime(task.completed_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'complete' }); if(task.completed_at){setTempDateValue(task.completed_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de completado"><Edit className="h-4 w-4" /></button>)}</div>
                                          )}
                                        </div>
                                      )}
                                      {completionTime !== null && (
                                        <div className="flex items-center text-green-600">
                                          <Timer className="h-4 w-4 mr-1" />
                                          <span>
                                            Gestionado en {completionTime} {completionTime === 1 ? 'día' : 'días'}
                                          </span>
                                        </div>
                                      )}
                                      {/* --- CORRECCIÓN: Mostrar Días de Retraso (daysOverdue) --- */}
                                      {task.days_to_complete && !isTaskCompleted && daysOverdue > 0 && (
                                        <div className="flex items-center text-red-600">
                                          <AlertTriangle className="h-4 w-4 mr-1" />
                                          <span>{daysOverdue} {daysOverdue === 1 ? 'día' : 'días'} de retraso</span>
                                        </div>
                                      )}
                                      {task.days_to_complete && ( // Mostrar el plazo siempre si existe
                                        <div className="flex items-center">
                                           <Calendar className="h-4 w-4 mr-1 text-gray-400" /> {/* Icono opcional para plazo */}
                                          <span>Plazo: {task.days_to_complete} días</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {expandedTaskId === task.commission_flow_task_id && task.comments_count > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <CommissionTaskCommentList
                                  taskId={task.commission_flow_task_id!}
                                  commissionFlowId={flow.id}
                                  refreshTrigger={commentRefreshTrigger}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

interface AtRiskPopupProps {
  commissionId: string;
  isAtRisk: boolean;
  reason: string;
  onSave: () => void;
  onClose: () => void;
}

const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ commissionId, isAtRisk, reason, onSave, onClose }) => {
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atRisk, setAtRisk] = useState(isAtRisk);
  const [atRiskReason, setAtRiskReason] = useState(reason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    try {
      setLoading(true); setError(null);
      const { error: updateError } = await supabase.from('broker_commissions').update({ at_risk: atRisk, at_risk_reason: atRisk ? atRiskReason : null }).eq('id', commissionId);
      if (updateError) throw updateError;
      hidePopup();
      onSave();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (<div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>)}
      <div className="space-y-4">
        <div className="flex items-center">
          <input type="checkbox" id="at_risk" checked={atRisk} onChange={(e) => setAtRisk(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
          <label htmlFor="at_risk" className="ml-2 block text-sm text-gray-700">Marcar como En Riesgo</label>
        </div>
        {atRisk && (
          <div>
            <label htmlFor="at_risk_reason" className="block text-sm font-medium text-gray-700">Motivo del Riesgo *</label>
            <textarea id="at_risk_reason" name="at_risk_reason" rows={4} required={atRisk} value={atRiskReason} onChange={(e) => setAtRiskReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Describa el motivo por el que esta operación está en riesgo..."/>
          </div>
        )}
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={() => { hidePopup(); onClose(); }} disabled={loading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={loading} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
          {loading ? (<><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>) : ('Guardar')}
        </button>
      </div>
    </form>
  );
};

export default PaymentFlowPage;