import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,
  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,
  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift, Ban
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale'; // Asegúrate que esta importación sea necesaria si usas date-fns con locale
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// --- INICIO: Definiciones de Tipos ---
export const PROMOTION_TYPES_ARRAY = [
  'Arriendo garantizado', 'Cashback', 'Giftcard', 'Bono Ejecutivo', 'Crédito al Pie', 'Dividendo Garantizado'
] as const;
export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];
export interface AppliedPromotion {
  id: string; reservation_id: string; promotion_type: PromotionType;
  is_against_discount: boolean; observations?: string | null; amount: number; 
  beneficiary: string; rut: string; bank: string; account_type: string;
  account_number: string; email: string; purchase_order?: string | null;
  document_number?: string | null; document_date?: string | null; 
  payment_date?: string | null;  created_at?: string;
}
interface Task {
  id: string; commission_flow_task_id?: string; name: string; status: string;
  started_at?: string; completed_at?: string; assigned_at?: string;
  expected_date?: string; days_to_complete?: number;
  assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  default_assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  comments_count: number; isCollapsed?: boolean;
}
interface Stage {
  id: string; name: string; tasks: Task[]; isCompleted: boolean; isExpanded: boolean;
}
interface PaymentFlow {
  id: string; status: string; started_at: string | null; completed_at: string | null;
  is_second_payment: boolean; flow: { id: string; };
  broker_commission: {
    id: string; commission_amount: number; number_of_payments: number;
    first_payment_percentage: number; at_risk: boolean; at_risk_reason: string | null;
    reservation: {
      id: string; reservation_number: string; 
      total_payment?: number; 
      subsidy_payment?: number; 
      minimum_price?: number; 
      is_rescinded?: boolean; 
      rescinded_at?: string;
      rescinded_reason?: string;
      client: { id: string; first_name: string; last_name: string; rut: string;};
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
    };
  } | null; 
  current_stage: { id: string; name: string; } | null;
  stages: Stage[];
}
interface User {
  id: string; first_name: string; last_name: string; position: string; avatar_url?: string;
}
interface FinancialSummaryForPDF {
    totalPayment: number; recoveryPayment: number; minimumPrice: number;
    difference: number; totalCommissionUF: number; firstPaymentUF: number;
    secondPaymentUF?: number; totalPromotionsAgainstDiscount: number;
}
interface AtRiskPopupProps {
  commissionId: string; isAtRisk: boolean; reason: string | null;
  onSave: () => void; onClose: () => void;
}
// --- FIN: Definiciones de Tipos ---

const retryOperation = async (operation: () => Promise<any>, maxRetries: number = 3, initialDelay: number = 1000): Promise<any> => {
    let retries = 0;
    let delay = initialDelay;
    while (true) {
        try { return await operation(); } catch (error: any) {
        const isRetryableError = error?.message?.includes('cannot ALTER TABLE') || error?.code === '55006';
        if (retries >= maxRetries || !isRetryableError) { throw error; }
        retries++; console.log(`Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        }
    }
};

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<PaymentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdfData, setLoadingPdfData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [startingFlow, setStartingFlow] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingTaskDate, setEditingTaskDate] = useState<{ taskId: string; type: 'start' | 'complete';} | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  const [creatingSecondFlow, setCreatingSecondFlow] = useState(false);
  const [tempDateValue, setTempDateValue] = useState('');
  const [markingAtRisk, setMarkingAtRisk] = useState(false);
  
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);
  const [financialSummaryForPDF, setFinancialSummaryForPDF] = useState<FinancialSummaryForPDF | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null); 
      Promise.all([
        fetchFlow(),
        fetchUsers(),
        checkAdminStatus()
      ]).catch((err) => {
        console.error("Error en la carga inicial:", err);
        setError(err.message || "Error al cargar datos del flujo.");
      }).finally(() => {
        setLoading(false);
      });
    } else {
      navigate('/pagos');
    }
  }, [id, commentRefreshTrigger]);

  useEffect(() => {
    const loadDependentData = async () => {
      if (flow && flow.broker_commission && flow.broker_commission.reservation && flow.broker_commission.reservation.id) {
        const reservationId = flow.broker_commission.reservation.id;
        setLoadingPdfData(true); 
        try {
          const { data: promos, error: promoError } = await supabase
            .from('promotions').select('*').eq('reservation_id', reservationId).order('created_at', { ascending: true });
          if (promoError) throw promoError;
          const currentPromotions = (promos as AppliedPromotion[]) || [];
          setAppliedPromotions(currentPromotions);

          const commissionData = flow.broker_commission;
          const reservationData = flow.broker_commission.reservation;

          if (reservationData.total_payment !== undefined && 
              reservationData.subsidy_payment !== undefined &&
              reservationData.minimum_price !== undefined &&
              commissionData.commission_amount !== undefined) {

            const totalPaymentVal = reservationData.total_payment;
            const subsidyPaymentVal = reservationData.subsidy_payment;
            const recoveryPaymentVal = totalPaymentVal - subsidyPaymentVal;
            const minimumPriceVal = reservationData.minimum_price;
            const commissionAmountForCalc = commissionData.commission_amount;
            const totalPromosAgainstDiscount = currentPromotions.reduce((sum, promo) => promo.is_against_discount ? sum + (promo.amount || 0) : sum, 0);
            const differenceVal = recoveryPaymentVal - minimumPriceVal - commissionAmountForCalc - totalPromosAgainstDiscount;
            const firstPaymentUFCalc = commissionAmountForCalc * (commissionData.first_payment_percentage / 100);
            const secondPaymentUFCalc = commissionData.number_of_payments === 2 ? commissionAmountForCalc - firstPaymentUFCalc : 0;

            setFinancialSummaryForPDF({
              totalPayment: totalPaymentVal, recoveryPayment: recoveryPaymentVal, minimumPrice: minimumPriceVal,
              difference: differenceVal, totalCommissionUF: commissionAmountForCalc,
              firstPaymentUF: firstPaymentUFCalc, secondPaymentUF: secondPaymentUFCalc,
              totalPromotionsAgainstDiscount: totalPromosAgainstDiscount,
            });
          } else { setFinancialSummaryForPDF(null); }
        } catch (err: any) {
          console.error("Error cargando datos dependientes para PDF:", err);
          setError(prev => prev ? `${prev}\nError PDF: ${err.message}` : `Error PDF: ${err.message}`);
          setAppliedPromotions([]); 
          setFinancialSummaryForPDF(null);
        } finally { setLoadingPdfData(false); }
      } else if (flow) { 
          setLoadingPdfData(false); 
          setAppliedPromotions([]);
          setFinancialSummaryForPDF(null);
      }
    };
    if (flow) { loadDependentData(); }
  }, [flow]); 

  const checkAdminStatus = async () => { /* ... (tu código como estaba) ... */ };
  const fetchUsers = async () => { /* ... (tu código como estaba) ... */ };
  
  // --- MODIFICACIÓN CLAVE: fetchFlow más robusto ---
  const fetchFlow = async () => {
    try {
      // setLoading(true); // Ya se maneja en el useEffect que lo llama
      // setError(null);   // Ya se maneja en el useEffect que lo llama
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
              total_payment, subsidy_payment, minimum_price, /* CAMPOS NECESARIOS */
              is_rescinded, rescinded_at, rescinded_reason,
              client:clients(id, first_name, last_name, rut),
              project:projects(name, stage),
              broker:brokers(id, name, business_name)
            )
          )
        `)
        .eq('id', id) // 'id' aquí es el commission_flow_id
        .single();
      
      if (flowError) { // Si hay error de Supabase (ej. RLS, problema de red)
        setFlow(null); // Asegura que flow se limpie
        throw flowError;
      }
      if (!flowData) { // Si .single() no encontró nada, flowData es null
        setFlow(null); 
        throw new Error(`Flujo de comisión con ID ${id} no encontrado.`);
      }
      if (!flowData.broker_commission) {
        setFlow(null); 
        throw new Error(`El flujo de comisión ${flowData.id} no tiene una comisión de broker asociada.`);
      }
       if (!flowData.broker_commission.reservation) {
        setFlow(null);
        throw new Error(`La comisión del broker para el flujo ${flowData.id} no tiene una reserva asociada.`);
      }

      const { data: stagesData, error: stagesError } = await supabase
        .from('payment_flow_stages').select(`id, name, order, tasks:payment_flow_tasks(id, name, days_to_complete, default_assignee:profiles(id, first_name, last_name, avatar_url))`)
        .eq('flow_id', flowData.flow.id).order('order', { ascending: true });
      if (stagesError) throw stagesError;
      if (!stagesData) throw new Error("Etapas del flujo no encontradas.");


      const { data: flowTasks, error: tasksError } = await supabase
        .from('commission_flow_tasks').select(`id, task_id, status, started_at, completed_at, assigned_at, assignee:profiles(id, first_name, last_name, avatar_url)`)
        .eq('commission_flow_id', id);
      if (tasksError) throw tasksError;
      
      const commissionFlowTaskIds = flowTasks?.map(ft => ft.id) || [];
      let commentsData: { commission_flow_task_id: string }[] = [];
      if (commissionFlowTaskIds.length > 0) {
        const { data: fetchedCommentsData, error: commentsFetchError } = await supabase
          .from('commission_task_comments').select('commission_flow_task_id').in('commission_flow_task_id', commissionFlowTaskIds);
        if (commentsFetchError) throw commentsFetchError;
        commentsData = fetchedCommentsData || [];
      }
      
      const commentCounts: Record<string, number> = {};
      commentsData.forEach(comment => { if (comment.commission_flow_task_id) { commentCounts[comment.commission_flow_task_id] = (commentCounts[comment.commission_flow_task_id] || 0) + 1; } });

      const stages = stagesData.map(stage => {
        const stageTasks = stage.tasks.map(taskTemplate => {
          const flowTaskInstance = flowTasks?.find(ft => ft.task_id === taskTemplate.id);
          return {
            id: taskTemplate.id, commission_flow_task_id: flowTaskInstance?.id, name: taskTemplate.name,
            status: flowTaskInstance?.status || 'blocked', started_at: flowTaskInstance?.started_at,
            completed_at: flowTaskInstance?.completed_at, assigned_at: flowTaskInstance?.assigned_at,
            days_to_complete: taskTemplate.days_to_complete, assignee: flowTaskInstance?.assignee,
            default_assignee: taskTemplate.default_assignee, 
            comments_count: flowTaskInstance ? (commentCounts[flowTaskInstance.id] || 0) : 0,
            isCollapsed: flowTaskInstance?.status === 'completed', 
          };
        });
        return { id: stage.id, name: stage.name, tasks: stageTasks, isCompleted: stageTasks.every(task => task.status === 'completed'), isExpanded: flowData.current_stage_id === stage.id || !stageTasks.every(task => task.status === 'completed') };
      });
      setFlow({ ...flowData, stages } as PaymentFlow); // Todo bien, se establece el flujo
    } catch (err) {
      setFlow(null); // --- IMPORTANTE: Asegurar que flow sea null en CUALQUIER error ---
      throw err; // Propagar para que el useEffect principal lo capture en setError
    }
    // El finally setLoading(false) lo maneja el useEffect que llama a Promise.all
  };

  const handleStartFlow = async () => { if (!flow) return; try { setStartingFlow(true); setError(null); const { error: updateError } = await supabase.from('commission_flows').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', flow.id); if (updateError) throw updateError; await fetchFlow(); } catch (err: any) { setError(err.message); } finally { setStartingFlow(false); }};
  const handleStartDateChange = async (date: string) => { if (!flow) return; try { setLoading(true); const { error: e } = await supabase.from('commission_flows').update({ started_at: date }).eq('id', flow.id); if (e) throw e; await fetchFlow(); setEditingStartDate(false); } catch (err: any) { setError(err.message); } finally { setLoading(false); }};
  const handleTaskDateChange = async (templateTaskId: string, date: string, type: 'start' | 'complete') => { if (!flow) return; try { setLoading(true); const { data: ft, error: te } = await supabase.from('commission_flow_tasks').select('id').eq('commission_flow_id', flow.id).eq('task_id', templateTaskId).maybeSingle(); if (te) throw te; if (ft) { await retryOperation(async () => { const { error: ue } = await supabase.from('commission_flow_tasks').update({ [type === 'start' ? 'started_at' : 'completed_at']: date }).eq('id', ft.id); if (ue) throw ue; });} await fetchFlow(); setEditingTaskDate(null); } catch (err: any) { setError(err.message); } finally { setLoading(false); }};
  const handleAssign = async (templateTaskId: string, currentAssignee: User | null, defaultAssignee: User | null) => { /* ... (tu código sin cambios) ... */ };
  const assignUser = async (templateTaskId: string, user: User) => { /* ... (tu código sin cambios) ... */ };
  useEffect(() => { if (flow?.status === 'in_progress') { flow.stages.forEach(stage => stage.tasks.forEach(task => { if (!task.assignee && task.default_assignee) { assignUser(task.id, task.default_assignee); } }));}}, [flow]);
  useEffect(() => { if (!flow) return; const pendingStageId = flow.current_stage?.id || flow.stages.find(s => !s.isCompleted)?.id; if (pendingStageId) { const el = document.getElementById(`stage-${pendingStageId}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}}, [flow]);
  const handleStatusChange = async (templateTaskId: string, newStatus: string) => { /* ... (tu código sin cambios) ... */ };
  const handleAddComment = async (taskInstanceId: string | undefined) => { /* ... (tu código sin cambios) ... */ };
  const toggleTaskComments = (taskInstanceId: string | undefined) => { /* ... (tu código sin cambios) ... */ };
  const toggleTaskCollapse = (stageIndex: number, taskIndex: number) => { /* ... (tu código sin cambios) ... */ };
  const toggleStage = (stageIndex: number) => { /* ... (tu código sin cambios) ... */ };
  const getStatusIcon = (status: string) => { /* ... (tu código sin cambios) ... */ };
  const getStatusText = (status: string) => { /* ... (tu código sin cambios) ... */ };
  const getStatusColor = (status: string) => { /* ... (tu código sin cambios) ... */ };
  const calculateProgress = () => { /* ... (tu código sin cambios) ... */ };
  const getDaysElapsed = (startDate?: string, endDate?: string) => { /* ... (tu código sin cambios) ... */ };
  const getExpectedDate = (task: Task) => { /* ... (tu código sin cambios) ... */ };
  const getDaysOverdue = (task: Task) => { /* ... (tu código sin cambios) ... */ };
  const navigateToEditClient = () => { /* ... (tu código sin cambios) ... */ };
  const navigateToEditReservation = () => { /* ... (tu código sin cambios) ... */ };
  const navigateToEditCommission = () => { /* ... (tu código sin cambios) ... */ };
  const navigateToReservationFlow = async () => { /* ... (tu código sin cambios) ... */ };
  const navigateToDocuments = () => { /* ... (tu código sin cambios) ... */ };
  const navigateToTaskTracking = () => { /* ... (tu código sin cambios) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (tu código sin cambios) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (tu código sin cambios) ... */ };
  
  const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ commissionId, isAtRisk, reason, onSave, onClose }) => { /* ... (tu código sin cambios, eliminando el comentario erróneo del return) ... */ 
    const { hidePopup } = usePopup();
    const [popupLoading, setPopupLoading] = useState(false);
    const [popupError, setPopupError] = useState<string | null>(null);
    const [currentAtRisk, setCurrentAtRisk] = useState(isAtRisk);
    const [currentReason, setCurrentReason] = useState(reason || '');
  
    const handlePopupSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); if (popupLoading) return;
      try {
        setPopupLoading(true); setPopupError(null);
        const { error: updateError } = await supabase.from('broker_commissions').update({ at_risk: currentAtRisk, at_risk_reason: currentAtRisk ? currentReason.trim() : null }).eq('id', commissionId);
        if (updateError) throw updateError;
        hidePopup(); onSave(); 
      } catch (err: any) { setPopupError(err.message); }
      finally { setPopupLoading(false); }
    };
    // --- MODIFICACIÓN: Eliminado comentario erróneo aquí ---
    return (
      <form onSubmit={handlePopupSubmit} className="space-y-6">
        {popupError && (<div className="bg-red-50 text-red-600 p-4 rounded-lg">{popupError}</div>)}
        <div className="space-y-4">
          <div className="flex items-center">
            <input type="checkbox" id="popup_at_risk_flow_page" checked={currentAtRisk} onChange={(e) => setCurrentAtRisk(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
            <label htmlFor="popup_at_risk_flow_page" className="ml-2 block text-sm text-gray-700">Marcar como En Riesgo</label>
          </div>
          {currentAtRisk && (
            <div>
              <label htmlFor="popup_at_risk_reason_flow_page" className="block text-sm font-medium text-gray-700">Motivo del Riesgo *</label>
              <textarea id="popup_at_risk_reason_flow_page" name="popup_at_risk_reason_flow_page" rows={3} required={currentAtRisk} value={currentReason} onChange={(e) => setCurrentReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Describa el motivo..."/>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button type="button" onClick={() => { hidePopup(); onClose(); }} disabled={popupLoading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={popupLoading} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            {popupLoading ? (<><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>) : ('Guardar')}
          </button>
        </div>
      </form>
    );
  };

  const handleToggleAtRisk = () => { /* ... (tu código sin cambios) ... */ };
  
  interface SummaryCardProps { title: string; value: number | string; icon: React.ReactNode; valueColor?: string; subtitle?: string; }
  const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => ( /* ... (tu código sin cambios) ... */ );

  // --- Guardas de Renderizado ---
  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  if (error) { return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">Error: {error} <button onClick={() => navigate('/pagos')} className="ml-4 text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; }
  if (!flow) { return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para este flujo de pago. <button onClick={() => navigate('/pagos')} className="text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; }
  
  const reservationDetails = flow.broker_commission?.reservation;
  const commissionDetails = flow.broker_commission;

  if (!commissionDetails || !reservationDetails) {
    return <Layout><div className="p-4 text-center text-gray-500">Datos de comisión o reserva faltantes para este flujo. <button onClick={() => navigate('/pagos')} className="text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>;
  }
  // --- Fin Guardas ---

  const canCreateSecondPaymentFlow = flow.status === 'completed' && commissionDetails.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* ... (Header - sin cambios) ... */}
        
        <div className="space-y-6">
            {/* ... (Tarjeta de Información General - sin cambios significativos) ... */}
            
            {/* --- Tarjeta: Informes y Documentos (ya la tenías) --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                {/* ... (contenido de la tarjeta de informes con el PDFDownloadLink) ... */}
            </div>
            {/* --- FIN Tarjeta --- */}
            
            {/* --- MODIFICACIÓN CLAVE: JSX de las Tareas Restaurado --- */}
            <div className="space-y-6">
              {flow.stages.map((stage, stageIndex) => (
                  <div id={`stage-${stage.id}`} key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between cursor-pointer" onClick={() => toggleStage(stageIndex)}>
                          <div className="flex items-center">
                              {stage.isExpanded ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                              <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                          </div>
                          {stage.isCompleted && (<span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completada</span>)}
                      </div>
                      {stage.isExpanded && (
                          <div className="divide-y divide-gray-200">
                              {stage.tasks.map((task, taskIndex) => { // Usar taskIndex aquí
                                  const isTaskCompleted = task.status === 'completed';
                                  const showCollapsedView = isTaskCompleted && (task.isCollapsed === undefined ? true : task.isCollapsed); 
                                  const completionTime = task.completed_at && task.started_at ? getDaysElapsed(task.started_at, task.completed_at) : null;
                                  const daysOverdue = getDaysOverdue(task);
                                  
                                  return (
                                  <div key={task.id} className={`p-6 ${showCollapsedView ? 'py-3' : 'hover:bg-gray-50'}`}>
                                      {showCollapsedView ? (
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center">
                                                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                                                  <h4 className="text-base font-medium text-gray-700">{task.name}</h4>
                                              </div>
                                              <button onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" title="Expandir tarea"><ChevronRight className="h-5 w-5" /></button>
                                          </div>
                                      ) : (
                                          <>
                                            <div className="flex items-center justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                  <h4 className={`text-base font-medium ${isTaskCompleted ? 'text-gray-700' : 'text-gray-900'}`}>{task.name}</h4>
                                                  {isTaskCompleted ? (<button onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" title="Colapsar tarea"><ChevronDown className="h-5 w-5" /></button>) 
                                                  : (
                                                    <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)} disabled={flow.status === 'pending'} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)} border-0 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}>
                                                      <option value="pending">Pendiente</option><option value="in_progress">En Proceso</option><option value="completed">Completada</option><option value="blocked">Bloqueada</option>
                                                    </select>
                                                  )}
                                                </div>
                                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                  {task.assignee ? (<div className="flex items-center">{task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt={`${task.assignee.first_name} ${task.assignee.last_name}`} className="h-8 w-8 rounded-full object-cover"/> : <UserCircle className="h-8 w-8 text-gray-400" />}<span className="ml-2 text-sm text-gray-600">{task.assignee.first_name} {task.assignee.last_name}</span></div>) 
                                                  : task.default_assignee ? (<button onClick={() => handleAssign(task.id, null, task.default_assignee)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar a {task.default_assignee.first_name}</span></button>) 
                                                  : (<button onClick={() => handleAssign(task.id, null, null)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar</span></button>)}
                                                  <button onClick={() => handleAddComment(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700 relative" disabled={flow.status === 'pending' || !task.commission_flow_task_id}><MessageSquare className="h-5 w-5 mr-1" /><span>Comentar</span>{task.comments_count > 0 && (<span className="absolute -top-1 -right-1 h-4 w-4 text-xs flex items-center justify-center bg-blue-600 text-white rounded-full">{task.comments_count}</span>)}</button>
                                                  <button onClick={() => toggleTaskComments(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700" disabled={flow.status === 'pending' || task.comments_count === 0 || !task.commission_flow_task_id}><span>Ver comentarios</span> <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${expandedTaskId === task.commission_flow_task_id ? 'rotate-180' : ''}`} /></button>
                                                </div>
                                                <div className="mt-2 text-sm text-gray-500">
                                                  {task.started_at && (
                                                    <div className="flex flex-col space-y-2">
                                                      <div className="flex items-center">{editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'start' ? (<input type="datetime-local" defaultValue={task.started_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'start')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>) : (<div className="flex items-center"><Calendar className="h-4 w-4 mr-1" /><span>Iniciada el {formatDateTime(task.started_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'start' }); if(task.started_at){setTempDateValue(task.started_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de inicio"><Edit className="h-4 w-4" /></button>)}</div>)}</div>
                                                      {task.completed_at && (<div className="flex items-center">{editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'complete' ? (<input type="datetime-local" defaultValue={task.completed_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'complete')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>) : (<div className="flex items-center text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" /><span>Completada el {formatDateTime(task.completed_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'complete' }); if(task.completed_at){setTempDateValue(task.completed_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de completado"><Edit className="h-4 w-4" /></button>)}</div>)}</div>)}
                                                      {completionTime !== null && (<div className="flex items-center text-green-600"><Timer className="h-4 w-4 mr-1" /><span>Gestionado en {completionTime} {completionTime === 1 ? 'día' : 'días'}</span></div>)}
                                                      {task.days_to_complete && !isTaskCompleted && daysOverdue > 0 && (<div className="flex items-center text-red-600"><AlertTriangle className="h-4 w-4 mr-1" /><span>{daysOverdue} {daysOverdue === 1 ? 'día' : 'días'} de retraso</span></div>)}
                                                      {task.days_to_complete && (<div className="flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-400" /><span>Plazo: {task.days_to_complete} días</span></div>)}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            {expandedTaskId === task.commission_flow_task_id && task.comments_count > 0 && (
                                              <div className="mt-4 pt-4 border-t border-gray-200"><CommissionTaskCommentList taskId={task.commission_flow_task_id!} commissionFlowId={flow.id} refreshTrigger={commentRefreshTrigger} /></div>
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
            </div> {/* Fin de space-y-6 para tarjetas de etapas */}
        </div> {/* Fin de space-y-6 principal */}
      </div>
    </Layout>
  );
};

// Componente AtRiskPopup (lo tenías definido aquí)
const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ commissionId, isAtRisk, reason, onSave, onClose }) => {
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAtRisk, setCurrentAtRisk] = useState(isAtRisk);
  const [currentReason, setCurrentReason] = useState(reason || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    try {
      setLoading(true); setError(null);
      const { error: updateError } = await supabase
        .from('broker_commissions')
        .update({ at_risk: currentAtRisk, at_risk_reason: currentAtRisk ? currentReason.trim() : null })
        .eq('id', commissionId);
      if (updateError) throw updateError;
      hidePopup();
      onSave(); 
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (<div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>)}
      <div className="space-y-4">
        <div className="flex items-center">
          <input type="checkbox" id="popup_at_risk_flow_page_unique" checked={currentAtRisk} onChange={(e) => setCurrentAtRisk(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
          <label htmlFor="popup_at_risk_flow_page_unique" className="ml-2 block text-sm text-gray-700">Marcar como En Riesgo</label>
        </div>
        {currentAtRisk && (
          <div>
            <label htmlFor="popup_at_risk_reason_flow_page_unique" className="block text-sm font-medium text-gray-700">Motivo del Riesgo *</label>
            <textarea id="popup_at_risk_reason_flow_page_unique" name="popup_at_risk_reason_flow_page_unique" rows={3} required={currentAtRisk} value={currentReason} onChange={(e) => setCurrentReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Describa el motivo..."/>
          </div>
        )}
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={() => { hidePopup(); onClose(); }} disabled={loading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={loading} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
          {loading ? (<><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>) : ('Guardar')}
        </button>
      </div>
    </form>
  );
};


export default PaymentFlowPage;