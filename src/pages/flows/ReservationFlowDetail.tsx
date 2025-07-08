import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, parseMonthYear, formatMonthYear } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import StageCard from '../../components/StageCard';
import TaskAssignmentPopup from '../../components/TaskAssignmentPopup';
import TaskCommentPopup from '../../components/TaskCommentPopup';
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
  Ban,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Airplay,
  ChevronDown
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import FormularioONUPDF from '../../components/pdf/FormularioONUPDF';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import DevolucionReservaPDF from '../../components/pdf/DevolucionReservaPDF';

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
      rut: string;
      direccion: string;
      comuna: string;
      email?: string;
    };
    project: {
      name: string;
      stage: string;
      deadline: string;
      commune?: string;
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
    total_payment?: number;
    seller_id?: string;
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

interface ClientReservation {
  id: string;
  reservation_number: string;
  reservation_date: string;
  project?: { name: string; stage: string };
  apartment_number: string;
  reservation_flow: { id: string };
  promise_date?: string;
  deed_date?: string;
  commission_payment_month?: string;
  commission_projection_month?: string;
}

const ReservationFlowDetail = () => {
  const { id } = useParams();
  const location = useLocation();
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
  // Estados para el modal de gestión documental
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentos, setDocumentos] = useState({
    pre_aprobacion: false,
    cedula_identidad: false,
    certificado_afp: false,
    liquidaciones_sueldo: false,
    dicom_cmf: false,
    pep: false,
    dof: false,
    formulario_onu: false
  });
  const [clientReservations, setClientReservations] = useState<ClientReservation[]>([]);
  const [showReservationsPanel, setShowReservationsPanel] = useState(false);
  const [showONUDialog, setShowONUDialog] = useState(false);
  const [jefaturas, setJefaturas] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [selectedJefatura, setSelectedJefatura] = useState<any>(null);
  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);
  const [onuPDFReady, setOnuPDFReady] = useState(false);
  const [showDocumentOptions, setShowDocumentOptions] = useState(false);
  const [showDevolucionDialog, setShowDevolucionDialog] = useState(false);
  const comunaProyecto = flow?.reservation?.project?.commune;
  const [devolucionForm, setDevolucionForm] = useState({
    monto_pagado_uf: '',
    monto_pagado_pesos: '',
    monto_devolucion_pesos: '',
    banco: '',
    tipo_cuenta: '',
    numero_cuenta: '',
    correo_cliente: '',
    causa_motivo: '',
    comentarios: ''
  });
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  // 1. Estado para saber si ya existe devolución
  const [devolucionExistente, setDevolucionExistente] = useState<any>(null);
  const [showMobySuiteModal, setShowMobySuiteModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    reserva: true,
    promesa: false,
    escritura: false,
    modificaciones: false
  });

  useEffect(() => {
    console.log('ReservationFlowDetail id:', id);
    if (id) {
      setLoading(true);
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

  useEffect(() => {
    if (flow?.reservation?.id) {
      cargarEstadosDocumentos(flow.reservation.id);
    }
  }, [flow?.reservation?.id]);

  useEffect(() => {
    const fetchClientReservations = async () => {
      if (flow?.reservation?.client?.id) {
        const { data, error } = await supabase
          .from('reservations')
          .select(`
            id,
            reservation_number,
            reservation_date,
            promise_date,
            deed_date,
            commission_payment_month,
            commission_projection_month,
            project:projects(name, stage),
            apartment_number,
            reservation_flow:reservation_flows!reservation_flows_reservation_id_fkey(id)
          `)
          .eq('client_id', flow.reservation.client.id)
          .order('reservation_date', { ascending: false });
        if (!error && data) {
          setClientReservations(data.map((r: any) => ({
            id: r.id,
            reservation_number: r.reservation_number,
            reservation_date: r.reservation_date,
            promise_date: r.promise_date,
            deed_date: r.deed_date,
            commission_payment_month: r.commission_payment_month,
            commission_projection_month: r.commission_projection_month,
            project: r.project,
            apartment_number: r.apartment_number,
            reservation_flow: r.reservation_flow
          })));
        }
      }
    };
    fetchClientReservations();
  }, [flow?.reservation?.client?.id]);

  // Mostrar el panel lateral solo cuando el usuario lo solicite
  useEffect(() => {
    setShowReservationsPanel(false);
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tareaId = params.get('tarea');
    if (tareaId) {
      setTimeout(() => {
        const el = document.getElementById(`tarea-${tareaId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
        }
      }, 800);
    }
  }, [location.search, flow]);

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
      // Traer total_payment y seller_id
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
            client:clients(id, first_name, last_name, rut, direccion, comuna, email),
            project:projects(name, stage, deadline, commune),
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
            rescinded_reason,
            total_payment,
            seller_id
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (reservationError) {
        setError('No se pudo cargar el flujo de reserva. Intenta nuevamente.');
        return;
      }
      if (!reservationData) {
        setError('No se encontró el flujo de reserva.');
        return;
      }

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
            const assigneesFromAssignments = taskAssignments.map(ta => {
              if (!ta || !ta.user) return undefined;
              const user = Array.isArray(ta.user) ? ta.user[0] : ta.user;
              return user ? {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                avatar_url: user.avatar_url
              } : undefined;
            }).filter(Boolean) as {
              id: string;
              first_name: string;
              last_name: string;
              avatar_url?: string;
            }[];
            
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

      // Transformar relaciones a objetos si vienen como array en reservationData
      let reservationObj = reservationData.reservation;
      if (Array.isArray(reservationObj)) reservationObj = reservationObj[0];
      if (reservationObj) {
        reservationObj.client = Array.isArray(reservationObj.client) ? reservationObj.client[0] : reservationObj.client;
        reservationObj.project = Array.isArray(reservationObj.project) ? reservationObj.project[0] : reservationObj.project;
        reservationObj.broker = Array.isArray(reservationObj.broker) ? reservationObj.broker[0] : reservationObj.broker;
      }
      setFlow({
        ...reservationData,
        reservation: reservationObj,
        stages
      });
      setLoading(false);
    } catch (err) {
      setError('Ocurrió un error al cargar el flujo de reserva.');
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
              const assigneesFromAssignments = assignments?.map(a => {
                if (!a || !a.user) return undefined;
                const user = Array.isArray(a.user) ? a.user[0] : a.user;
                return user ? {
                  id: user.id,
                  first_name: user.first_name,
                  last_name: user.last_name,
                  avatar_url: user.avatar_url
                } : undefined;
              }).filter(Boolean) as {
                id: string;
                first_name: string;
                last_name: string;
                avatar_url?: string;
              }[];
              
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

  const fetchONUUsers = async () => {
    const { data: jefes } = await supabase.from('profiles').select('id, first_name, last_name, rut, position').in('position', ['SUB GERENTE COMERCIAL', 'JEFE CANAL INVERSIONES']);
    const { data: vends } = await supabase.from('profiles').select('id, first_name, last_name, rut, position').eq('position', 'KEY ACCOUNT MANAGER');
    setJefaturas(jefes || []);
    setVendedores(vends || []);
  };

  const openONUDialog = () => {
    fetchONUUsers();
    setShowONUDialog(true);
  };

  const navigateToDocuments = () => {
    setShowDocumentOptions(true);
  };

  const navigateToTaskTracking = () => {
    setShowMobySuiteModal(true);
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

  // Función para cargar los estados de los documentos
  const cargarEstadosDocumentos = async (reservationId: string) => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();
      if (error) throw error;
      if (data) {
        setDocumentos({
          pre_aprobacion: data.pre_aprobacion_estado || false,
          cedula_identidad: data.cedula_identidad_estado || false,
          certificado_afp: data.certificado_afp_estado || false,
          liquidaciones_sueldo: data.liquidaciones_sueldo_estado || false,
          dicom_cmf: data.dicom_cmf_estado || false,
          pep: data.pep_estado || false,
          dof: data.dof_estado || false,
          formulario_onu: data.formulario_onu_estado || false
        });
      }
    } catch (err) {
      // No hacer nada
    }
  };

  // Función para manejar cambios en el checklist
  const handleDocumentChange = (documento: keyof typeof documentos) => {
    setDocumentos(prev => ({
      ...prev,
      [documento]: !prev[documento]
    }));
  };

  // Guardar estados de los documentos
  const guardarEstadosDocumentos = async () => {
    try {
      if (!flow?.reservation?.id) return;
      const { error } = await supabase
        .from('reservations')
        .update({
          pre_aprobacion_estado: documentos.pre_aprobacion,
          cedula_identidad_estado: documentos.cedula_identidad,
          certificado_afp_estado: documentos.certificado_afp,
          liquidaciones_sueldo_estado: documentos.liquidaciones_sueldo,
          dicom_cmf_estado: documentos.dicom_cmf,
          pep_estado: documentos.pep,
          dof_estado: documentos.dof,
          formulario_onu_estado: documentos.formulario_onu,
          documentos_actualizados_at: new Date().toISOString()
        })
        .eq('id', flow.reservation.id);
      if (error) throw error;
      setShowDocumentModal(false);
    } catch (err) {
      setShowDocumentModal(false);
    }
  };

  // Modal de gestión documental
  const renderDocumentModal = () => (
    <Dialog open={showDocumentModal} onClose={() => setShowDocumentModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
        <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6 z-10">
          <Dialog.Title className="text-xl font-bold mb-4 text-blue-700">Gestión Documental</Dialog.Title>
          <div className="space-y-4">
            {Object.entries(documentos).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">
                  {key === 'pre_aprobacion' ? 'Pre Aprobación / Aprobación' :
                   key === 'cedula_identidad' ? 'Cédula de Identidad' :
                   key === 'certificado_afp' ? 'Certificado de AFP' :
                   key === 'liquidaciones_sueldo' ? 'Liquidaciones de Sueldo' :
                   key === 'dicom_cmf' ? 'DICOM / CMF' :
                   key === 'pep' ? 'PEP' :
                   key === 'dof' ? 'DOF' :
                   key === 'formulario_onu' ? 'Formulario ONU' : key}
                </span>
                <button
                  onClick={() => handleDocumentChange(key as keyof typeof documentos)}
                  className={`p-2 rounded-full ${value ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                >
                  {value ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => setShowDocumentModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold"
            >
              Cerrar
            </button>
            <button
              onClick={guardarEstadosDocumentos}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
            >
              Guardar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  // Modal de opciones de documentos
  const renderDocumentOptionsModal = () => (
    <Dialog open={showDocumentOptions} onClose={() => setShowDocumentOptions(false)} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
        <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6 z-10">
          <Dialog.Title className="text-xl font-bold mb-4 text-blue-700">Seleccionar Documento</Dialog.Title>
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowDocumentOptions(false);
                fetchONUUsers();
                setShowONUDialog(true);
              }}
              className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-between"
            >
              <span className="font-medium">Formulario ONU</span>
              <ChevronRight className="h-5 w-5 text-blue-600" />
            </button>
            <button
              onClick={() => {
                setShowDocumentOptions(false);
                setShowDevolucionDialog(true);
              }}
              className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
            >
              <span className="font-medium flex items-center gap-2">
                Devolución de Reserva
                {devolucionExistente && (
                  <>
                    <Edit2 className="h-4 w-4 text-gray-400 ml-1" />
                    <span className="text-xs text-gray-500">(creada)</span>
                  </>
                )}
              </span>
              <ChevronRight className="h-5 w-5 text-green-600" />
            </button>
            {/* Aquí se pueden agregar más opciones de documentos en el futuro */}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowDocumentOptions(false)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  // 2. Al cargar el flujo, consultar si existe devolución y traer nombre del vendedor
  useEffect(() => {
    const fetchDevolucionYVendedor = async () => {
      if (flow?.reservation?.id) {
        // Consultar devolución existente
        const { data: devolucion, error } = await supabase
          .from('devolucion_reserva')
          .select('*')
          .eq('reservation_id', flow.reservation.id)
          .maybeSingle();
        if (!error && devolucion) {
          setDevolucionExistente(devolucion);
          setDevolucionForm({
            monto_pagado_uf: devolucion.monto_pagado_uf || '',
            monto_pagado_pesos: devolucion.monto_pagado_pesos || '',
            monto_devolucion_pesos: devolucion.monto_devolucion_pesos || '',
            banco: devolucion.banco || '',
            tipo_cuenta: devolucion.tipo_cuenta || '',
            numero_cuenta: devolucion.numero_cuenta || '',
            causa_motivo: devolucion.causa_motivo || '',
            comentarios: devolucion.comentarios || '',
          });
        } else {
          setDevolucionExistente(null);
          setDevolucionForm({
            monto_pagado_uf: '',
            monto_pagado_pesos: '',
            monto_devolucion_pesos: '',
            banco: '',
            tipo_cuenta: '',
            numero_cuenta: '',
            causa_motivo: '',
            comentarios: '',
          });
        }
        // Traer nombre del vendedor
        if (flow.reservation.seller_id) {
          const { data: vendedor } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', flow.reservation.seller_id)
            .maybeSingle();
          setVendedorNombre(vendedor ? `${vendedor.first_name} ${vendedor.last_name}` : '');
        }
      }
    };
    fetchDevolucionYVendedor();
  }, [flow?.reservation?.id, flow?.reservation?.seller_id]);

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
      <div className="max-w-7xl mx-auto relative">
        {/* Panel lateral de reservas del cliente */}
        {showReservationsPanel && (
          <div className="fixed top-20 right-0 w-80 h-[calc(100vh-5rem)] bg-white border-l shadow-lg z-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-blue-700">Reservas del Cliente</h3>
              <button onClick={() => setShowReservationsPanel(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <ul className="space-y-2">
              {clientReservations.map(rsv => (
                <li key={rsv.id}>
                  <button
                    className={`w-full text-left px-3 py-2 rounded hover:bg-blue-50 flex items-center justify-between ${rsv.id === flow.reservation.id ? 'bg-blue-100 font-bold' : ''}`}
                    disabled={rsv.id === flow.reservation.id}
                    onClick={() => {
                      const flowId = rsv.reservation_flow?.id;
                      if (flowId) {
                        setShowReservationsPanel(false);
                        navigate(`/flujo-reservas/${flowId}`);
                      }
                    }}
                  >
                    <span>
                      <span className="block text-sm text-gray-900">Reserva {rsv.reservation_number}</span>
                      <span className="block text-xs text-gray-500">{rsv.project?.name} {rsv.project?.stage} - Depto {rsv.apartment_number}</span>
                      <span className="block text-xs text-gray-400 mt-1">Promesa: {rsv.promise_date ? formatDate(rsv.promise_date) : '-'}</span>
                      <span className="block text-xs text-gray-400">Escritura: {rsv.deed_date ? formatDate(rsv.deed_date) : '-'}</span>
                      <span className="block text-xs text-gray-400">Pago Comisión: {rsv.commission_payment_month ? formatDateToMonthYear(rsv.commission_payment_month) : '-'}</span>
                      <span className="block text-xs text-gray-400">Proy. Comisión: {rsv.commission_projection_month ? formatDateToMonthYear(rsv.commission_projection_month) : '-'}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Botón flotante para abrir el panel si está oculto */}
        {clientReservations.length > 1 && !showReservationsPanel && (
          <button
            className="fixed top-1/2 right-0 z-30 bg-blue-600 text-white px-3 py-2 rounded-l shadow-lg hover:bg-blue-700"
            onClick={() => setShowReservationsPanel(true)}
          >
            Ver Reservas
          </button>
        )}
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
            <div className="w-20"></div> {/* Espaciador para centrar el título */}
          </div>

          {/* Navigation Icons - Nueva fila */}
          <div className="flex justify-end mb-6 sticky top-0 z-30 bg-gray-50 py-4 shadow-sm">
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
                title="Gestión MobySuite"
              >
                <Airplay className="h-5 w-5" />
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
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(true)}
                  className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition-colors font-semibold"
                >
                  {(() => {
                    const checks = [
                      documentos.pre_aprobacion,
                      documentos.cedula_identidad,
                      documentos.certificado_afp,
                      documentos.liquidaciones_sueldo,
                      documentos.dicom_cmf,
                      documentos.pep,
                      documentos.dof,
                      documentos.formulario_onu
                    ];
                    const total = checks.length;
                    const completos = checks.filter(Boolean).length;
                    if (completos === total) {
                      return <Check className="h-5 w-5 mr-1 text-green-300" />;
                    } else if (completos === 0) {
                      return <X className="h-5 w-5 mr-1 text-red-300" />;
                    } else {
                      return <AlertCircle className="h-5 w-5 mr-1 text-yellow-300" />;
                    }
                  })()}
                  Gestión Documental
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInfo(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Editar
                </button>
              </div>
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
                projectName={flow.reservation.project.name}
                apartmentNumber={flow.reservation.apartment_number}
              />
            ))}
          </div>
        </div>

        {/* Renderizar el modal de gestión documental */}
        {renderDocumentModal()}

        {showONUDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Generar Formulario ONU</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Jefatura</label>
                <select className="w-full border rounded p-2" value={selectedJefatura?.id || ''} onChange={e => setSelectedJefatura(jefaturas.find(j => j.id === e.target.value))}>
                  <option value="">Seleccione una jefatura</option>
                  {jefaturas.map(j => (
                    <option key={j.id} value={j.id}>{j.first_name} {j.last_name} - {j.position}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Vendedor</label>
                <select className="w-full border rounded p-2" value={selectedVendedor?.id || ''} onChange={e => setSelectedVendedor(vendedores.find(v => v.id === e.target.value))}>
                  <option value="">Seleccione un vendedor</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.first_name} {v.last_name} - {v.position}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowONUDialog(false)}>Cancelar</button>
                {selectedJefatura && selectedVendedor ? (
                  <PDFDownloadLink
                    document={<FormularioONUPDF
                      jefatura={{ nombre: `${selectedJefatura.first_name} ${selectedJefatura.last_name}`, rut: selectedJefatura.rut, cargo: selectedJefatura.position }}
                      vendedor={{ nombre: `${selectedVendedor.first_name} ${selectedVendedor.last_name}`, rut: selectedVendedor.rut }}
                      cliente={{ nombre: `${flow.reservation.client.first_name} ${flow.reservation.client.last_name}`, rut: flow.reservation.client.rut, direccion: flow.reservation.client.direccion, comuna: flow.reservation.client.comuna, nacionalidad: flow.reservation.client.nacionalidad || 'chilena' }}
                      proyecto={flow.reservation.project.name}
                      fechaHora={new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}
                      comunaProyecto={comunaProyecto || '________'}
                    />}
                    fileName={`Formulario_ONU_${flow.reservation.client.first_name}_${flow.reservation.client.last_name}.pdf`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Generar PDF
                  </PDFDownloadLink>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Modal de opciones de documentos */}
        {renderDocumentOptionsModal()}

        {showDevolucionDialog && (
          <Dialog open={showDevolucionDialog} onClose={() => setShowDevolucionDialog(false)} className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
              <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6 z-10">
                <Dialog.Title className="text-xl font-bold mb-4 text-green-700">Devolución de Reserva</Dialog.Title>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!flow) return;
                    const correo_cliente = flow.reservation.client.email;
                    const devolucionPayload = {
                      reservation_id: flow.reservation.id,
                      cliente_nombre: `${flow.reservation.client.first_name} ${flow.reservation.client.last_name}`,
                      cliente_rut: flow.reservation.client.rut,
                      proyecto: flow.reservation.project.name,
                      fecha_reserva: flow.reservation.reservation_date,
                      numero_departamento: flow.reservation.apartment_number,
                      valor_total: flow.reservation.total_payment,
                      fecha_desistimiento: new Date().toISOString().slice(0,10),
                      monto_pagado_uf: devolucionForm.monto_pagado_uf,
                      monto_pagado_pesos: devolucionForm.monto_pagado_pesos,
                      monto_cancelado: devolucionForm.monto_pagado_pesos,
                      monto_devolucion_pesos: devolucionForm.monto_devolucion_pesos,
                      ejecutivo_ventas_id: flow.reservation.seller_id,
                      ejecutivo_ventas_nombre: vendedorNombre,
                      causa_motivo: devolucionForm.causa_motivo,
                      banco: devolucionForm.banco,
                      tipo_cuenta: devolucionForm.tipo_cuenta,
                      numero_cuenta: devolucionForm.numero_cuenta,
                      correo_cliente,
                      comentarios: devolucionForm.comentarios || null
                    };
                    if (devolucionExistente) {
                      await supabase.from('devolucion_reserva').update(devolucionPayload).eq('id', devolucionExistente.id);
                    } else {
                      await supabase.from('devolucion_reserva').insert(devolucionPayload);
                    }
                    // Generar PDF y descargar automáticamente
                    const doc = (
                      <DevolucionReservaPDF
                        cliente_nombre={`${flow.reservation.client.first_name} ${flow.reservation.client.last_name}`}
                        cliente_rut={flow.reservation.client.rut}
                        proyecto={flow.reservation.project.name}
                        fecha_reserva={flow.reservation.reservation_date}
                        numero_departamento={flow.reservation.apartment_number}
                        valor_total={flow.reservation.total_payment}
                        fecha_desistimiento={new Date().toISOString().slice(0,10)}
                        monto_pagado_uf={devolucionForm.monto_pagado_uf}
                        monto_pagado_pesos={devolucionForm.monto_pagado_pesos}
                        monto_cancelado={devolucionForm.monto_pagado_pesos}
                        monto_devolucion_pesos={devolucionForm.monto_devolucion_pesos}
                        ejecutivo_ventas_nombre={vendedorNombre}
                        causa_motivo={devolucionForm.causa_motivo}
                        banco={devolucionForm.banco}
                        tipo_cuenta={devolucionForm.tipo_cuenta}
                        numero_cuenta={devolucionForm.numero_cuenta}
                        correo_cliente={correo_cliente}
                        comentarios={devolucionForm.comentarios}
                        fecha_creacion={new Date().toLocaleDateString('es-CL')}
                      />
                    );
                    const asPdf = pdf([]);
                    asPdf.updateContainer(doc);
                    const blob = await asPdf.toBlob();
                    const url = URL.createObjectURL(blob);
                    setPdfBlobUrl(url);
                    setShowDevolucionDialog(false);
                    // Descargar automáticamente
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Devolucion_Reserva_${flow.reservation.client.first_name}_${flow.reservation.client.last_name}.pdf`;
                    a.click();
                  }}
                >
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Monto Pagado en UF</label>
                    <input type="number" step="0.0001" className="w-full border rounded p-2" value={devolucionForm.monto_pagado_uf} onChange={e => setDevolucionForm(f => ({...f, monto_pagado_uf: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Monto Pagado en Pesos</label>
                    <input type="number" step="0.01" className="w-full border rounded p-2" value={devolucionForm.monto_pagado_pesos} onChange={e => setDevolucionForm(f => ({...f, monto_pagado_pesos: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Causa o Motivos</label>
                    <textarea className="w-full border rounded p-2" value={devolucionForm.causa_motivo} onChange={e => setDevolucionForm(f => ({...f, causa_motivo: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Monto Devolución en Pesos</label>
                    <input type="number" step="0.01" className="w-full border rounded p-2" value={devolucionForm.monto_devolucion_pesos} onChange={e => setDevolucionForm(f => ({...f, monto_devolucion_pesos: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Banco</label>
                    <input type="text" className="w-full border rounded p-2" value={devolucionForm.banco} onChange={e => setDevolucionForm(f => ({...f, banco: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Tipo Cuenta</label>
                    <select className="w-full border rounded p-2" value={devolucionForm.tipo_cuenta} onChange={e => setDevolucionForm(f => ({...f, tipo_cuenta: e.target.value}))} required>
                      <option value="">Seleccione</option>
                      <option value="Vista">Vista</option>
                      <option value="Cuenta Corriente">Cuenta Corriente</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">N° Cuenta</label>
                    <input type="text" className="w-full border rounded p-2" value={devolucionForm.numero_cuenta} onChange={e => setDevolucionForm(f => ({...f, numero_cuenta: e.target.value}))} required />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Comentarios (opcional)</label>
                    <textarea className="w-full border rounded p-2" value={devolucionForm.comentarios} onChange={e => setDevolucionForm(f => ({...f, comentarios: e.target.value}))} />
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowDevolucionDialog(false)}>Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Guardar y Generar PDF</button>
                  </div>
                </form>
              </Dialog.Panel>
            </div>
          </Dialog>
        )}

        {/* Modal de Gestión MobySuite */}
        {showMobySuiteModal && (
          <Dialog open={showMobySuiteModal} onClose={() => setShowMobySuiteModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black opacity-30 z-0"></div>
              <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto p-6 z-10">
                <Dialog.Title className="text-xl font-bold mb-4 text-blue-700">Gestión MobySuite</Dialog.Title>
                <div className="space-y-4">
                  {/* Sección Reserva */}
                  <div className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedSections(prev => ({ 
                        reserva: !prev.reserva, 
                        promesa: false, 
                        escritura: false, 
                        modificaciones: false 
                      }))}
                      className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-t-lg flex items-center justify-between font-semibold text-blue-700"
                    >
                      <span>Reserva</span>
                      {expandedSections.reserva ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    {expandedSections.reserva && (
                      <div className="p-4 space-y-2">
                        <a
                          href={`https://ecasa.mobysuite.com/reservation/payment-plan-detail/${flow?.reservation?.reservation_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Detalle Plan de Pago</span>
                          <ChevronRight className="h-5 w-5 text-blue-600" />
                        </a>
                        <a
                          href={`https://ecasa.mobysuite.com/reserve/${flow?.reservation?.reservation_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Ver Reserva</span>
                          <ChevronRight className="h-5 w-5 text-blue-600" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Sección Promesa */}
                  <div className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedSections(prev => ({ 
                        reserva: false, 
                        promesa: !prev.promesa, 
                        escritura: false, 
                        modificaciones: false 
                      }))}
                      className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 rounded-t-lg flex items-center justify-between font-semibold text-green-700"
                    >
                      <span>Promesa</span>
                      {expandedSections.promesa ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    {expandedSections.promesa && (
                      <div className="p-4 space-y-2">
                        <a
                          href={`https://ecasa.mobysuite.com/promise/${flow?.reservation?.reservation_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Promesar Unidad</span>
                          <ChevronRight className="h-5 w-5 text-green-600" />
                        </a>
                        <a
                          href={`https://ecasa.mobysuite.com/promise/${flow?.reservation?.reservation_number}/tracking-signatures`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Seguimiento Firmas</span>
                          <ChevronRight className="h-5 w-5 text-green-600" />
                        </a>
                        <a
                          href={`https://ecasa.mobysuite.com/promise/${flow?.reservation?.reservation_number}/tracking-signatures`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Gestión Documental</span>
                          <ChevronRight className="h-5 w-5 text-green-600" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Sección Escritura */}
                  <div className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedSections(prev => ({ 
                        reserva: false, 
                        promesa: false, 
                        escritura: !prev.escritura, 
                        modificaciones: false 
                      }))}
                      className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-t-lg flex items-center justify-between font-semibold text-purple-700"
                    >
                      <span>Escritura</span>
                      {expandedSections.escritura ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    {expandedSections.escritura && (
                      <div className="p-4 space-y-2">
                        <a
                          href={`https://ecasa.mobysuite.com/deed/6940/milestone-tracking/3417`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Seguimiento</span>
                          <ChevronRight className="h-5 w-5 text-purple-600" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Sección Modificaciones */}
                  <div className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedSections(prev => ({ 
                        reserva: false, 
                        promesa: false, 
                        escritura: false, 
                        modificaciones: !prev.modificaciones 
                      }))}
                      className="w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-t-lg flex items-center justify-between font-semibold text-orange-700"
                    >
                      <span>Modificaciones</span>
                      {expandedSections.modificaciones ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    {expandedSections.modificaciones && (
                      <div className="p-4 space-y-2">
                        <a
                          href={`https://ecasa.mobysuite.com/accounting/payment-plan-detail/${flow?.reservation?.reservation_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Plan de Pago</span>
                          <ChevronRight className="h-5 w-5 text-orange-600" />
                        </a>
                        <a
                          href={`https://ecasa.mobysuite.com/modification/edit/${flow?.reservation?.reservation_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">Modificar Negocio</span>
                          <ChevronRight className="h-5 w-5 text-orange-600" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowMobySuiteModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default ReservationFlowDetail;