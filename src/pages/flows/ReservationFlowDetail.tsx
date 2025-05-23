import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, parseMonthYear, formatMonthYear } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import StageCard from '../../components/StageCard';
import TaskAssignmentPopup from '../../components/TaskAssignmentPopup';
import TaskCommentPopup from '../../components/TaskCommentPopup';
import ClientMultipleReservationsAlert from '../../components/ClientMultipleReservationsAlert';
import RescindReservationPopup from '../../components/RescindReservationPopup';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  Wallet, 
  Edit2, 
  Users, 
  Building2, 
  FileText, 
  ListChecks,
  CreditCard,
  ClipboardList,
  DollarSign,
  Ban
} from 'lucide-react';

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

interface Stage {
  id: string;
  name: string;
  tasks: Task[];
  isCompleted: boolean;
}

interface ReservationFlow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  reservation: {
    id: string;
    reservation_number: string;
    reservation_date: string;
    client: {
      id: string;
      first_name: string;
      last_name: string;
    };
    project: {
      name: string;
      stage: string;
      deadline: string;
    };
    apartment_number: string;
    broker?: {
      id: string;
      name: string;
    } | null;
    bank_name?: string;
    bank_executive?: string;
    bank_executive_email?: string;
    bank_executive_phone?: string;
    promise_date?: string;
    deed_date?: string;
    commission_payment_month?: string;
    commission_projection_month?: string;
    is_rescinded?: boolean;
    rescinded_at?: string;
    rescinded_reason?: string;
  };
  current_stage: {
    id: string;
    name: string;
  } | null;
  stages: Stage[];
}

interface BankFormData {
  bank_name: string;
  bank_executive: string;
  bank_executive_email: string;
  bank_executive_phone: string;
  promise_date: string;
  deed_date: string;
  commission_payment_month: string;
  commission_projection_month: string;
}

// Spanish month names to number mapping
const MONTH_TO_NUMBER: Record<string, string> = {
  'enero': '01',
  'febrero': '02',
  'marzo': '03',
  'abril': '04',
  'mayo': '05',
  'junio': '06',
  'julio': '07',
  'agosto': '08',
  'septiembre': '09',
  'octubre': '10',
  'noviembre': '11',
  'diciembre': '12'
};

// Number to Spanish month names mapping
const NUMBER_TO_MONTH: Record<string, string> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
  '04': 'abril',
  '05': 'mayo',
  '06': 'junio',
  '07': 'julio',
  '08': 'agosto',
  '09': 'septiembre',
  '10': 'octubre',
  '11': 'noviembre',
  '12': 'diciembre'
};

const ReservationFlowDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<ReservationFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankFormData, setBankFormData] = useState<BankFormData>({
    bank_name: '',
    bank_executive: '',
    bank_executive_email: '',
    bank_executive_phone: '',
    promise_date: '',
    deed_date: '',
    commission_payment_month: '',
    commission_projection_month: ''
  });
  const [brokerCommissionId, setBrokerCommissionId] = useState<string | null>(null);
  const [commissionFlowId, setCommissionFlowId] = useState<string | null>(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0); // Add a refresh trigger
  const [hasPaidCommission, setHasPaidCommission] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      checkAdminStatus();
      fetchFlow();
    }
  }, [id]);

  useEffect(() => {
    if (flow) {
      setBankFormData({
        bank_name: flow.reservation.bank_name || '',
        bank_executive: flow.reservation.bank_executive || '',
        bank_executive_email: flow.reservation.bank_executive_email || '',
        bank_executive_phone: flow.reservation.bank_executive_phone || '',
        promise_date: flow.reservation.promise_date || '',
        deed_date: flow.reservation.deed_date || '',
        commission_payment_month: flow.reservation.commission_payment_month ? 
          formatDateToMonthYear(flow.reservation.commission_payment_month) : '',
        commission_projection_month: flow.reservation.commission_projection_month ? 
          formatDateToMonthYear(flow.reservation.commission_projection_month) : ''
      });
      
      // Check if broker commission exists
      if (flow.reservation.broker?.id) {
        fetchBrokerCommission(flow.reservation.id);
      }
    }
  }, [flow]);

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

  const fetchBrokerCommission = async (reservationId: string) => {
    try {
      // Get broker commission
      const { data: commission, error: commissionError } = await supabase
        .from('broker_commissions')
        .select('id, commission_amount, payment_1_date, payment_2_date')
        .eq('reservation_id', reservationId)
        .maybeSingle();

      if (commissionError) throw commissionError;
      
      if (commission) {
        setBrokerCommissionId(commission.id);
        setCommissionAmount(commission.commission_amount);
        setHasPaidCommission(!!(commission.payment_1_date || commission.payment_2_date));
        
        // Check if commission flow exists
        const { data: flow, error: flowError } = await supabase
          .from('commission_flows')
          .select('id')
          .eq('broker_commission_id', commission.id)
          .eq('is_second_payment', false)
          .maybeSingle();
          
        if (flowError) throw flowError;
        
        if (flow) {
          setCommissionFlowId(flow.id);
        }
      }
    } catch (err) {
      console.error('Error fetching broker commission:', err);
    }
  };

  const fetchFlow = async () => {
    try {
      setLoading(true);
      
      // First, fetch the basic reservation data
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservation_flows')
        .select(`
          id,
          status,
          started_at,
          completed_at,
          current_stage:sale_flow_stages(id, name),
          reservation:reservations(
            id,
            reservation_number,
            reservation_date,
            client:clients(id, first_name, last_name),
            project:projects(name, stage, deadline),
            apartment_number,
            broker:brokers(id, name),
            bank_name,
            bank_executive,
            bank_executive_email,
            bank_executive_phone,
            promise_date,
            deed_date,
            commission_payment_month,
            commission_projection_month,
            is_rescinded,
            rescinded_at,
            rescinded_reason
          )
        `)
        .eq('id', id)
        .single();

      if (reservationError) throw reservationError;

      // Get stages and tasks
      const { data: stagesData, error: stagesError } = await supabase
        .from('sale_flow_stages')
        .select(`
          id,
          name,
          tasks:sale_flow_tasks(
            id,
            name
          )
        `)
        .order('order', { ascending: true });

      if (stagesError) throw stagesError;

      // Get task statuses for this flow
      const { data: flowTasks, error: tasksError } = await supabase
        .from('reservation_flow_tasks')
        .select('id, task_id, status, completed_at, assignee_id')
        .eq('reservation_flow_id', id);

      if (tasksError) throw tasksError;

      // Get task assignments with user profiles
      const { data: assignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          user:profiles!task_assignments_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('reservation_flow_id', id);

      if (assignmentsError) throw assignmentsError;

      // Get task comments count
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .in('reservation_flow_task_id', flowTasks?.map(ft => ft.id) || []);

      if (commentsError) throw commentsError;

      // Process and combine the data
      const processStages = async () => {
        const stages = await Promise.all(stagesData?.map(async (stage) => {
          const stageTasks = await Promise.all(stage.tasks.map(async (task) => {
            const flowTask = flowTasks?.find(ft => ft.task_id === task.id);
            
            // Get assignees from both task_assignments and the assignee_id field
            const taskAssignments = assignments?.filter(a => a.task_id === task.id) || [];
            const assigneesFromAssignments = taskAssignments.map(ta => ({
              id: ta.user.id,
              first_name: ta.user.first_name,
              last_name: ta.user.last_name,
              avatar_url: ta.user.avatar_url
            }));
            
            // Add assignee from assignee_id if it exists and is not already included
            let assignees = [...assigneesFromAssignments];
            
            // If there's a direct assignee in the task, add it to assignees if not already there
            if (flowTask?.assignee_id) {
              const { data: assigneeData } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, avatar_url')
                .eq('id', flowTask.assignee_id)
                .single();
                
              if (assigneeData && !assignees.some(a => a.id === assigneeData.id)) {
                assignees.push({
                  id: assigneeData.id,
                  first_name: assigneeData.first_name,
                  last_name: assigneeData.last_name,
                  avatar_url: assigneeData.avatar_url
                });
              }
            }
            
            // If task is completed, ensure no assignees are shown
            if (flowTask?.status === 'completed') {
              assignees = [];
            }
            
            const taskStatus = flowTask?.status || 'pending';
            const taskComments = comments?.filter(c => {
              const relatedFlowTask = flowTasks?.find(ft => ft.task_id === task.id);
              return relatedFlowTask && c.reservation_flow_task_id === relatedFlowTask.id;
            }) || [];
            
            return {
              id: task.id,
              name: task.name,
              status: taskStatus,
              completed_at: flowTask?.completed_at,
              assignees,
              comments_count: taskComments.length
            };
          }));

          return {
            id: stage.id,
            name: stage.name,
            tasks: stageTasks,
            isCompleted: stageTasks.every(task => task.status === 'completed')
          };
        }) || []);

        return stages;
      };

      const stages = await processStages();

      // Ensure date fields are properly handled
      if (reservationData && reservationData.reservation) {
        // Convert empty strings to null for date fields
        if (reservationData.reservation.promise_date === "") {
          reservationData.reservation.promise_date = null;
        }
        if (reservationData.reservation.deed_date === "") {
          reservationData.reservation.deed_date = null;
        }
        if (reservationData.reservation.commission_payment_month === "") {
          reservationData.reservation.commission_payment_month = null;
        }
        if (reservationData.reservation.commission_projection_month === "") {
          reservationData.reservation.commission_projection_month = null;
        }
      }

      setFlow({
        ...reservationData,
        stages
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (taskId: string) => {
    if (!id) return;

    // Find the task to check if it's completed
    const task = flow?.stages
      .flatMap(stage => stage.tasks)
      .find(t => t.id === taskId);
      
    if (task?.status === 'completed' && !isAdmin) {
      setTaskError('No se pueden asignar usuarios a tareas completadas');
      return;
    }

    showPopup(
      <TaskAssignmentPopup
        taskId={taskId}
        reservationFlowId={id}
        currentAssignees={flow?.stages
          .flatMap(stage => stage.tasks)
          .find(t => t.id === taskId)
          ?.assignees.map(a => a.id) || []}
        onSave={() => {
          // Update the task locally without full page refresh
          updateTaskLocally(taskId);
          // Trigger a refresh of comments
          setCommentRefreshTrigger(prev => prev + 1);
        }}
        onClose={() => showPopup(null)}
      />,
      {
        title: 'Asignar Responsables',
        size: 'md'
      }
    );
  };

  const handleComment = (taskId: string) => {
    if (!id) return;

    showPopup(
      <TaskCommentPopup
        taskId={taskId}
        reservationFlowId={id}
        onSave={() => {
          // Update the task locally without full page refresh
          updateTaskLocally(taskId);
          // Trigger a refresh of comments
          setCommentRefreshTrigger(prev => prev + 1);
        }}
        onClose={() => showPopup(null)}
      />,
      {
        title: 'Agregar Comentario',
        size: 'md'
      }
    );
  };

  const updateTaskLocally = async (taskId: string) => {
    try {
      // Get updated task data
      const { data: flowTask, error: taskError } = await supabase
        .from('reservation_flow_tasks')
        .select('id, task_id, status, completed_at, assignee_id')
        .eq('reservation_flow_id', id)
        .eq('task_id', taskId)
        .maybeSingle();

      if (taskError) throw taskError;

      // Get updated assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          user:profiles!task_assignments_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('reservation_flow_id', id)
        .eq('task_id', taskId);

      if (assignmentsError) throw assignmentsError;

      // Get updated comments count
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('reservation_flow_task_id', flowTask?.id || '');

      if (commentsError) throw commentsError;

      // Update the flow state locally
      if (flow) {
        const updatedStages = flow.stages.map(stage => {
          const updatedTasks = stage.tasks.map(async (task) => {
            if (task.id === taskId) {
              // Get assignees from both task_assignments and the assignee_id field
              const assigneesFromAssignments = assignments?.map(a => ({
                id: a.user.id,
                first_name: a.user.first_name,
                last_name: a.user.last_name,
                avatar_url: a.user.avatar_url
              })) || [];
              
              // Add assignee from assignee_id if it exists and is not already included
              let assignees = [...assigneesFromAssignments];
              
              // If there's a direct assignee in the task, add it to assignees if not already there
              if (flowTask?.assignee_id) {
                const { data: assigneeData } = await supabase
                  .from('profiles')
                  .select('id, first_name, last_name, avatar_url')
                  .eq('id', flowTask.assignee_id)
                  .single();
                  
                if (assigneeData && !assignees.some(a => a.id === assigneeData.id)) {
                  assignees.push({
                    id: assigneeData.id,
                    first_name: assigneeData.first_name,
                    last_name: assigneeData.last_name,
                    avatar_url: assigneeData.avatar_url
                  });
                }
              }
              
              // If task is completed, ensure no assignees are shown
              if (flowTask?.status === 'completed') {
                assignees = [];
              }
              
              return {
                ...task,
                status: flowTask?.status || task.status,
                completed_at: flowTask?.completed_at,
                assignees,
                comments_count: comments?.length || task.comments_count
              };
            }
            return task;
          });

          // Use Promise.all to resolve all the async tasks
          return Promise.all(updatedTasks).then(resolvedTasks => ({
            ...stage,
            tasks: resolvedTasks,
            isCompleted: resolvedTasks.every(task => task.status === 'completed')
          }));
        });

        // Resolve all the stage promises
        Promise.all(updatedStages).then(resolvedStages => {
          setFlow({
            ...flow,
            stages: resolvedStages
          });
        });
      }
    } catch (err: any) {
      console.error('Error updating task locally:', err);
    }
  };

  const handleStatusChange = async (taskId: string, status: string, completedAt?: string) => {
    try {
      if (!id) return;
      setTaskError(null);

      // Check if task exists
      const { data: existingTasks } = await supabase
        .from('reservation_flow_tasks')
        .select('id, status, completed_at')
        .eq('reservation_flow_id', id)
        .eq('task_id', taskId);

      if (existingTasks && existingTasks.length > 0) {
        // Update existing task
        const updateData: any = { status };
        
        // If admin is changing status to completed, set completed_at
        if (isAdmin) {
          if (status === 'completed') {
            updateData.completed_at = completedAt || new Date().toISOString();
          } else if (status !== 'completed') {
            updateData.completed_at = null;
          }
        }

        // If task is being completed, clear assignee_id
        if (status === 'completed') {
          updateData.assignee_id = null;
        }

        const { error } = await supabase
          .from('reservation_flow_tasks')
          .update(updateData)
          .eq('id', existingTasks[0].id);

        if (error) {
          if (error.message.includes('Solo los administradores pueden modificar')) {
            setTaskError('Solo los administradores pueden modificar tareas completadas');
            // Update the task locally to restore previous state
            updateTaskLocally(taskId);
            return;
          }
          throw error;
        }

        // Update the task locally without full page refresh
        updateTaskLocally(taskId);
        
        // Trigger a refresh of comments
        setCommentRefreshTrigger(prev => prev + 1);
      } else {
        // Create new task
        const { error } = await supabase
          .from('reservation_flow_tasks')
          .insert({
            reservation_flow_id: id,
            task_id: taskId,
            status,
            completed_at: status === 'completed' ? (completedAt || new Date().toISOString()) : null,
            assignee_id: status === 'completed' ? null : null // No assignee for new tasks
          });

        if (error) throw error;

        // Update the task locally without full page refresh
        updateTaskLocally(taskId);
        
        // Trigger a refresh of comments
        setCommentRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      setTaskError(err.message);
      // Update the task locally to restore previous state
      updateTaskLocally(taskId);
    }
  };

  const isImmediateDelivery = () => {
    if (!flow?.reservation.project.deadline) return false;
    const deadline = new Date(flow.reservation.project.deadline);
    const today = new Date();
    return deadline <= today;
  };

  const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBankFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to format date as "month de year"
  const formatDateToMonthYear = (dateStr: string): string => {
    try {
      // Create a date object
      const date = new Date(dateStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      
      // Get the month and year directly from the date string to avoid timezone issues
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Convert to 0-based month index
        
        // Map month number (0-11) to Spanish month name
        const monthNames = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        // Return formatted string
        return `${monthNames[month]} de ${year}`;
      }
      
      return '';
    } catch (e) {
      console.error('Error formatting date to month year:', e);
      return dateStr;
    }
  };

  const handleSaveBank = async () => {
    if (!flow) return;
    
    try {
      setSavingBank(true);
      
      // Format the data with proper handling for empty strings and date formats
      let formattedData: any = { ...bankFormData };
      
      // Convert empty strings to null
      if (formattedData.promise_date === '') formattedData.promise_date = null;
      if (formattedData.deed_date === '') formattedData.deed_date = null;
      if (formattedData.commission_payment_month === '') formattedData.commission_payment_month = null;
      if (formattedData.commission_projection_month === '') formattedData.commission_projection_month = null;
      
      if (formattedData.commission_payment_month) {
        // Check if it's in "month de year" format (e.g., "abril de 2025")
        const parsedDate = parseMonthYear(formattedData.commission_payment_month);
        if (parsedDate) {
          formattedData.commission_payment_month = parsedDate;
        }
        // If it's already in YYYY-MM format, add the day
        else if (/^\d{4}-\d{2}$/.test(formattedData.commission_payment_month)) {
          formattedData.commission_payment_month = `${formattedData.commission_payment_month}-01`;
        }
      }
      
      if (formattedData.commission_projection_month) {
        // Check if it's in "month de year" format (e.g., "abril de 2025")
        const parsedDate = parseMonthYear(formattedData.commission_projection_month);
        if (parsedDate) {
          formattedData.commission_projection_month = parsedDate;
        }
        // If it's already in YYYY-MM format, add the day
        else if (/^\d{4}-\d{2}$/.test(formattedData.commission_projection_month)) {
          formattedData.commission_projection_month = `${formattedData.commission_projection_month}-01`;
        }
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(formattedData)
        .eq('id', flow.reservation.id);

      if (error) throw error;

      setEditingBank(false);
      setEditingInfo(false);
      
      // Update local state instead of fetching again
      if (flow) {
        setFlow({
          ...flow,
          reservation: {
            ...flow.reservation,
            ...formattedData
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingBank(false);
    }
  };

  // Function to format date for display, correctly handling timezone issues
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No especificada';
    
    // Just return the date part as is from the database
    const dateParts = dateString.split('T')[0].split('-');
    if (dateParts.length === 3) {
      // Format as DD-MM-YYYY
      return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    }
    return dateString;
  };

  // Navigation functions
  const navigateToEditClient = () => {
    if (flow?.reservation.client.id) {
      navigate(`/clientes/editar/${flow.reservation.client.id}`);
    }
  };

  const navigateToEditReservation = () => {
    if (flow?.reservation.id) {
      navigate(`/reservas/editar/${flow.reservation.id}`);
    }
  };

  const navigateToEditBroker = () => {
    if (flow?.reservation.broker?.id) {
      navigate(`/brokers/editar/${flow.reservation.broker.id}`);
    }
  };

  const navigateToEditCommission = () => {
    if (flow?.reservation.id) {
      navigate(`/pagos/${flow.reservation.id}`);
    }
  };

  const navigateToPaymentFlow = () => {
    if (commissionFlowId) {
      navigate(`/pagos/flujo/${commissionFlowId}`);
    } else if (brokerCommissionId) {
      // Create a new payment flow
      createPaymentFlow();
    } else {
      setError('No hay comisión de broker configurada para esta reserva');
    }
  };

  const createPaymentFlow = async () => {
    if (!brokerCommissionId) return;
    
    try {
      setLoading(true);
      
      // Get the default flow ID and first stage
      const { data: flowData, error: flowError } = await supabase
        .from('payment_flows')
        .select('id, stages:payment_flow_stages(id)')
        .eq('name', 'Flujo de Pago Principal')
        .single();

      if (flowError) throw flowError;

      // Create new payment flow
      const { data: newFlow, error: createError } = await supabase
        .from('commission_flows')
        .insert({
          broker_commission_id: brokerCommissionId,
          flow_id: flowData.id,
          current_stage_id: flowData.stages[0].id,
          status: 'pending',
          started_at: null,
          is_second_payment: false
        })
        .select()
        .single();

      if (createError) throw createError;

      // Navigate to the new flow
      setCommissionFlowId(newFlow.id);
      navigate(`/pagos/flujo/${newFlow.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const navigateToDocuments = () => {
    // This would navigate to a documents page if it existed
    // For now, we'll just show a popup
    showPopup(
      <div className="p-4">
        <p>Funcionalidad de documentos en desarrollo.</p>
      </div>,
      {
        title: 'Documentos del Cliente',
        size: 'md'
      }
    );
  };

  const navigateToTaskTracking = () => {
    navigate('/seguimiento');
  };

  const handleRescind = () => {
    if (!flow) return;
    
    showPopup(
      <RescindReservationPopup
        reservationId={flow.reservation.id}
        reservationNumber={flow.reservation.reservation_number}
        hasPaidCommission={hasPaidCommission}
        commissionAmount={commissionAmount}
        brokerCommissionId={brokerCommissionId}
        onSave={() => {
          // Refresh the flow data after rescinding
          fetchFlow();
        }}
        onClose={() => showPopup(null)}
      />,
      {
        title: 'Resciliar Reserva',
        size: 'md'
      }
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !flow) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'Flujo no encontrado'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
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
            {flow.reservation.is_rescinded && (
              <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                Resciliada
              </span>
            )}
          </h1>
          
          {/* Navigation Icons */}
          <div className="flex space-x-3">
            <button
              onClick={navigateToEditClient}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Editar Cliente"
            >
              <Users className="h-5 w-5" />
            </button>
            
            <button
              onClick={navigateToEditReservation}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Editar Reserva"
            >
              <Edit2 className="h-5 w-5" />
            </button>
            
            {flow.reservation.broker?.id && (
              <>
                <button
                  onClick={navigateToEditBroker}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Editar Broker"
                >
                  <Building2 className="h-5 w-5" />
                </button>
                
                <button
                  onClick={navigateToEditCommission}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Editar Comisión"
                >
                  <DollarSign className="h-5 w-5" />
                </button>
                
                <button
                  onClick={navigateToPaymentFlow}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Flujo de Pago"
                >
                  <Wallet className="h-5 w-5" />
                </button>
              </>
            )}
            
            <button
              onClick={navigateToDocuments}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Documentos"
            >
              <FileText className="h-5 w-5" />
            </button>
            
            <button
              onClick={navigateToTaskTracking}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Seguimiento de Tareas"
            >
              <ClipboardList className="h-5 w-5" />
            </button>

            {isAdmin && !flow.reservation.is_rescinded && (
              <button
                onClick={handleRescind}
                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                title="Resciliar Reserva"
              >
                <Ban className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {taskError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {taskError}
          </div>
        )}

        {/* Información de la Reserva */}
        <div className={`bg-white rounded-lg shadow-md p-6 mb-6 ${flow.reservation.is_rescinded ? 'border-2 border-red-300' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Información de la Reserva
              {flow.reservation.is_rescinded && (
                <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                  Resciliada
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setEditingInfo(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Editar
            </button>
          </div>
          
          {flow.reservation.is_rescinded && (
            <div className="mb-4 p-3 bg-red-50 rounded-md border border-red-200">
              <p className="text-sm font-medium text-red-800">Reserva resciliada</p>
              {flow.reservation.rescinded_reason && (
                <p className="text-sm text-red-700 mt-1">
                  <span className="font-medium">Motivo:</span> {flow.reservation.rescinded_reason}
                </p>
              )}
              {flow.reservation.rescinded_at && (
                <p className="text-sm text-red-700 mt-1">
                  <span className="font-medium">Fecha:</span> {formatDate(flow.reservation.rescinded_at)}
                </p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cliente
              </label>
              <div className="mt-1 text-gray-900">
                {`${flow.reservation.client.first_name} ${flow.reservation.client.last_name}`}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Proyecto
              </label>
              <div className="mt-1 text-gray-900">
                {`${flow.reservation.project.name} ${flow.reservation.project.stage}`}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Departamento
              </label>
              <div className="mt-1 text-gray-900">
                {flow.reservation.apartment_number}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Etapa Actual
              </label>
              <div className="mt-1 text-gray-900">
                {flow.current_stage?.name || 'No iniciado'}
              </div>
            </div>

            {flow.reservation.broker && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Broker
                </label>
                <div className="mt-1 text-gray-900">
                  {flow.reservation.broker.name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha Reserva
              </label>
              <div className="mt-1 text-gray-900">
                {formatDate(flow.reservation.reservation_date)}
              </div>
            </div>

            {editingInfo ? (
              <>
                <div>
                  <label htmlFor="promise_date" className="block text-sm font-medium text-gray-700">
                    Fecha Promesa
                  </label>
                  <input
                    type="date"
                    id="promise_date"
                    name="promise_date"
                    value={bankFormData.promise_date}
                    onChange={handleBankChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="deed_date" className="block text-sm font-medium text-gray-700">
                    Fecha Escritura
                  </label>
                  <input
                    type="date"
                    id="deed_date"
                    name="deed_date"
                    value={bankFormData.deed_date}
                    onChange={handleBankChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="commission_payment_month" className="block text-sm font-medium text-gray-700">
                    Mes Pago Comisión
                  </label>
                  <input
                    type="month"
                    id="commission_payment_month"
                    name="commission_payment_month"
                    value={bankFormData.commission_payment_month ? bankFormData.commission_payment_month.substring(0, 7) : ''}
                    onChange={handleBankChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Formato: YYYY-MM (ej: 2025-04 para abril de 2025)
                  </p>
                </div>

                <div>
                  <label htmlFor="commission_projection_month" className="block text-sm font-medium text-gray-700">
                    Proyección Comisión
                  </label>
                  <input
                    type="month"
                    id="commission_projection_month"
                    name="commission_projection_month"
                    value={bankFormData.commission_projection_month ? bankFormData.commission_projection_month.substring(0, 7) : ''}
                    onChange={handleBankChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Formato: YYYY-MM (ej: 2025-04 para abril de 2025)
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Promesa
                  </label>
                  <div className="mt-1 text-gray-900">
                    {flow.reservation.promise_date ? formatDate(flow.reservation.promise_date) : 'No especificada'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Escritura
                  </label>
                  <div className="mt-1 text-gray-900">
                    {flow.reservation.deed_date ? formatDate(flow.reservation.deed_date) : 'No especificada'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mes Pago Comisión
                  </label>
                  <div className="mt-1 text-gray-900">
                    {flow.reservation.commission_payment_month ? 
                      formatDateToMonthYear(flow.reservation.commission_payment_month) : 
                      'No especificado'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Proyección Comisión
                  </label>
                  <div className="mt-1 text-gray-900">
                    {flow.reservation.commission_projection_month ? 
                      formatDateToMonthYear(flow.reservation.commission_projection_month) : 
                      'No especificado'}
                  </div>
                </div>
              </>
            )}
          </div>

          {editingInfo && (
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setEditingInfo(false);
                  setBankFormData({
                    bank_name: flow.reservation.bank_name || '',
                    bank_executive: flow.reservation.bank_executive || '',
                    bank_executive_email: flow.reservation.bank_executive_email || '',
                    bank_executive_phone: flow.reservation.bank_executive_phone || '',
                    promise_date: flow.reservation.promise_date || '',
                    deed_date: flow.reservation.deed_date || '',
                    commission_payment_month: flow.reservation.commission_payment_month ? 
                      formatDateToMonthYear(flow.reservation.commission_payment_month) : '',
                    commission_projection_month: flow.reservation.commission_projection_month ? 
                      formatDateToMonthYear(flow.reservation.commission_projection_month) : ''
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBank}
                disabled={savingBank}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {savingBank ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Banco Escrituración - Solo para entrega inmediata */}
        {isImmediateDelivery() && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Banco Escrituración
              </h2>
              <button
                onClick={() => setEditingBank(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {editingBank ? (
                <>
                  <div>
                    <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                      Banco
                    </label>
                    <input
                      type="text"
                      id="bank_name"
                      name="bank_name"
                      value={bankFormData.bank_name}
                      onChange={handleBankChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="bank_executive" className="block text-sm font-medium text-gray-700">
                      Ejecutivo
                    </label>
                    <input
                      type="text"
                      id="bank_executive"
                      name="bank_executive"
                      value={bankFormData.bank_executive}
                      onChange={handleBankChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="bank_executive_email" className="block text-sm font-medium text-gray-700">
                      Correo Ejecutivo
                    </label>
                    <input
                      type="email"
                      id="bank_executive_email"
                      name="bank_executive_email"
                      value={bankFormData.bank_executive_email}
                      onChange={handleBankChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="bank_executive_phone" className="block text-sm font-medium text-gray-700">
                      Teléfono Ejecutivo
                    </label>
                    <input
                      type="text"
                      id="bank_executive_phone"
                      name="bank_executive_phone"
                      value={bankFormData.bank_executive_phone}
                      onChange={handleBankChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Banco
                    </label>
                    <div className="mt-1 text-gray-900">
                      {flow.reservation.bank_name || 'No especificado'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Ejecutivo
                    </label>
                    <div className="mt-1 text-gray-900">
                      {flow.reservation.bank_executive || 'No especificado'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Correo Ejecutivo
                    </label>
                    <div className="mt-1 text-gray-900">
                      {flow.reservation.bank_executive_email || 'No especificado'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Teléfono Ejecutivo
                    </label>
                    <div className="mt-1 text-gray-900">
                      {flow.reservation.bank_executive_phone || 'No especificado'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {editingBank && (
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBank(false);
                    setBankFormData({
                      bank_name: flow.reservation.bank_name || '',
                      bank_executive: flow.reservation.bank_executive || '',
                      bank_executive_email: flow.reservation.bank_executive_email || '',
                      bank_executive_phone: flow.reservation.bank_executive_phone || '',
                      promise_date: flow.reservation.promise_date || '',
                      deed_date: flow.reservation.deed_date || '',
                      commission_payment_month: flow.reservation.commission_payment_month ? 
                        formatDateToMonthYear(flow.reservation.commission_payment_month) : '',
                      commission_projection_month: flow.reservation.commission_projection_month ? 
                        formatDateToMonthYear(flow.reservation.commission_projection_month) : ''
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveBank}
                  disabled={savingBank}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {savingBank ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Etapas y Tareas */}
        <div className="space-y-6">
          {flow.stages.map((stage) => (
            <StageCard
              key={stage.id}
              title={stage.name}
              tasks={stage.tasks}
              isCompleted={stage.isCompleted}
              onAssign={handleAssign}
              onComment={handleComment}
              onStatusChange={handleStatusChange}
              reservationFlowId={flow.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ReservationFlowDetail;