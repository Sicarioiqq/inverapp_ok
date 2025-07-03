import React, { useState, useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';

import { usePopup } from '../../contexts/PopupContext';
import { Dialog } from '@headlessui/react';

import Layout from '../../components/Layout';

import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';

import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

import { PDFDownloadLink } from '@react-pdf/renderer';

import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF';

import {

  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,

  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,

  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,

  ClipboardList, DollarSign, Plus, Info, Airplay, Wallet

} from 'lucide-react';

import { formatDistanceToNow, format, differenceInDays, addDays } from 'date-fns';

import { es } from 'date-fns/locale';



// --- TIPOS ADICIONALES PARA LIQUIDACIÓN ---

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

  payment_date?: string | null; created_at?: string;

}

//export interface FinancialSummaryForPDF {

  //totalPayment: number;

  //recoveryPayment: number;

//  minimumPrice: number;

 // difference: number;

//  totalCommissionUF: number;

 // firstPaymentUF: number;

//  secondPaymentUF?: number;

 // totalPromotionsAgainstDiscount: number;

//}



interface Task {



id: string;



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







// Function to implement retry logic with exponential backoff



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



// Check if this is the specific error we want to retry



const isRetryableError =



error?.message?.includes('cannot ALTER TABLE') ||



error?.code === '55006';





// If we've reached max retries or it's not a retryable error, throw



if (retries >= maxRetries || !isRetryableError) {



throw error;



}





// Increment retry count and wait before trying again



retries++;



console.log(`Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);





// Wait for the delay period



await new Promise(resolve => setTimeout(resolve, delay));





// Exponential backoff - double the delay for next retry



delay *= 2;



}



}



};







const PaymentFlow: React.FC = () => {



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
const [showMobySuiteModal, setShowMobySuiteModal] = useState(false);
const [expandedSections, setExpandedSections] = useState({
  reserva: true,
  promesa: false,
  escritura: false,
  modificaciones: false
});







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







const fetchUsers = async () => {



try {



const { data, error } = await supabase



.from('profiles')



.select('id, first_name, last_name, position, avatar_url')



.order('first_name');







if (error) throw error;



setUsers(data || []);



} catch (err: any) {



console.error('Error fetching users:', err);



}



};







const fetchFlow = async () => {



try {



setLoading(true);



setError(null);





// Get basic flow information



const { data: flowData, error: flowError } = await supabase



.from('commission_flows')



.select(`



id,



status,



started_at,



completed_at,



is_second_payment,



flow:payment_flows(id),



current_stage:payment_flow_stages(id, name),



broker_commission:broker_commissions(



id,



commission_amount,



number_of_payments,



first_payment_percentage,



at_risk,



at_risk_reason,



reservation:reservations(



id,



reservation_number,



apartment_number,



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



id,



name,



tasks:payment_flow_tasks(



id,



name,



days_to_complete,



default_assignee:profiles(



id,



first_name,



last_name,



avatar_url



)



)



`)



.eq('flow_id', flowData.flow.id)



.order('order', { ascending: true });







if (stagesError) throw stagesError;







const { data: flowTasks, error: tasksError } = await supabase



.from('commission_flow_tasks')



.select(`



id,



task_id,



status,



started_at,



completed_at,



assigned_at,



assignee:profiles(



id,



first_name,



last_name,



avatar_url



)



`)



.eq('commission_flow_id', id);







if (tasksError) throw tasksError;







// Get comments count for each task



const { data: commentsData, error: commentsError } = await supabase



.from('commission_task_comments')



.select('commission_flow_task_id');







if (commentsError) throw commentsError;







// Group comments by task ID



const commentCounts: Record<string, number> = {};



commentsData?.forEach(comment => {



if (comment.commission_flow_task_id) {



commentCounts[comment.commission_flow_task_id] = (commentCounts[comment.commission_flow_task_id] || 0) + 1;



}



});







const stages = stagesData?.map(stage => {



const stageTasks = stage.tasks.map(task => {



const flowTask = flowTasks?.find(ft => ft.task_id === task.id);





// Find comments count for this task



const taskCommentCount = flowTask ? (commentCounts[flowTask.id] || 0) : 0;





return {



id: task.id,



name: task.name,



status: flowTask?.status || 'blocked',



started_at: flowTask?.started_at,



completed_at: flowTask?.completed_at,



assigned_at: flowTask?.assigned_at,



days_to_complete: task.days_to_complete,



assignee: flowTask?.assignee,



default_assignee: task.default_assignee,



comments_count: taskCommentCount



};



});







// Determinar si la etapa debería estar expandida inicialmente

const allTasksCompleted = stageTasks.every(task => task.status === 'completed');

const hasActiveTasks = stageTasks.some(task => 

  task.status === 'pending' || task.status === 'in_progress' || task.status === 'blocked'

);

const shouldBeExpanded = hasActiveTasks;





return {



id: stage.id,



name: stage.name,



tasks: stageTasks,



isCompleted: allTasksCompleted,



isExpanded: shouldBeExpanded // Expandir solo si hay tareas activas



};



}) || [];







console.log('📥 Estado inicial de etapas:', stages.map(s => ({ name: s.name, isExpanded: s.isExpanded, tasks: s.tasks.map(t => ({ name: t.name, status: t.status })) })));





setFlow({



...flowData,



stages



});



// La contracción automática ya se aplica en la inicialización de las etapas

console.log('✅ Flujo cargado con contracción automática aplicada');



} catch (err: any) {



setError(err.message);



} finally {



setLoading(false);



}



};







const handleStartFlow = async () => {



if (!flow) return;







try {



setStartingFlow(true);



setError(null);







const { error: updateError } = await supabase



.from('commission_flows')



.update({



status: 'in_progress',



started_at: new Date().toISOString()



})



.eq('id', flow.id);







if (updateError) throw updateError;







await fetchFlow().then(() => {



// Después de actualizar el flujo, manejar la contracción automática

handleAutoCollapseStages();



});



} catch (err: any) {



setError(err.message);



} finally {



setStartingFlow(false);



}



};







const handleStartDateChange = async (date: string) => {



if (!flow) return;







try {



setLoading(true);



const { error } = await supabase



.from('commission_flows')



.update({ started_at: date })



.eq('id', flow.id);







if (error) throw error;







await fetchFlow().then(() => {



// Después de actualizar el flujo, manejar la contracción automática

handleAutoCollapseStages();



});



setEditingStartDate(false);



} catch (err: any) {



setError(err.message);



} finally {



setLoading(false);



}



};







const handleTaskDateChange = async (taskId: string, date: string, type: 'start' | 'complete') => {



if (!flow) return;







try {



setLoading(true);



// Get the task ID first



const { data: flowTask, error: taskError } = await supabase



.from('commission_flow_tasks')



.select('id')



.eq('commission_flow_id', flow.id)



.eq('task_id', taskId)



.maybeSingle();







if (taskError) throw taskError;







if (flowTask) {



// Use the retry operation for the update



await retryOperation(async () => {



const { error: updateError } = await supabase



.from('commission_flow_tasks')



.update({



[type === 'start' ? 'started_at' : 'completed_at']: date



})



.eq('id', flowTask.id);







if (updateError) throw updateError;



});



}







await fetchFlow().then(() => {



// Después de actualizar el flujo, manejar la contracción automática

handleAutoCollapseStages();



});



setEditingTaskDate(null);





// Trigger a refresh of comments



setCommentRefreshTrigger(prev => prev + 1);



} catch (err: any) {



setError(err.message);



} finally {



setLoading(false);



}



};







const handleAssign = async (taskId: string, currentAssignee: User | null, defaultAssignee: User | null) => {



if (!flow || flow.status === 'pending') return;







try {



if (!currentAssignee && defaultAssignee) {



await assignUser(taskId, defaultAssignee);



return;



}







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



title: 'Asignar Responsable',



size: 'md'



}



);



});







if (!selectedUser) return;







await assignUser(taskId, selectedUser);





// Trigger a refresh of comments



setCommentRefreshTrigger(prev => prev + 1);



} catch (err: any) {



setError(err.message);



}



};







const assignUser = async (taskId: string, user: User) => {



if (!flow) return;







try {



// Use retry operation for getting the task



const { data: flowTask, error: taskError } = await retryOperation(async () => {



return await supabase



.from('commission_flow_tasks')



.select('id')



.eq('commission_flow_id', flow.id)



.eq('task_id', taskId)



.maybeSingle();



});







if (taskError) throw taskError;







if (flowTask) {



// Use retry operation for updating the task



await retryOperation(async () => {



const { error: updateError } = await supabase



.from('commission_flow_tasks')



.update({



assignee_id: user.id || null,



assigned_at: user.id ? new Date().toISOString() : null



})



.eq('id', flowTask.id);







if (updateError) throw updateError;



});



} else {



// Use retry operation for creating the task



await retryOperation(async () => {



const { error: createError } = await supabase



.from('commission_flow_tasks')



.insert({



commission_flow_id: flow.id,



task_id: taskId,



status: 'pending',



assignee_id: user.id || null,



assigned_at: user.id ? new Date().toISOString() : null



});







if (createError) throw createError;



});



}







fetchFlow().then(() => {



// Después de actualizar el flujo, manejar la contracción automática

handleAutoCollapseStages();



});



} catch (err: any) {



setError(err.message);



}



};



  // Aquí, justo **después** de assignUser, pega esto UNA VEZ:

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

  }, [flow?.status]);



  useEffect(() => {

  if (!flow) return;



  // Determina qué etapa está "pendiente":

  // Podrías usar flow.current_stage.id, o buscar la primera stage.isCompleted === false.

  const pendingStageId =

flow.current_stage?.id ||

flow.stages.find(s => !s.isCompleted)?.id;



  if (pendingStageId) {

const el = document.getElementById(`stage-${pendingStageId}`);

if (el) {

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

}

  }

}, [flow]);







const handleStatusChange = async (taskId: string, newStatus: string) => {



console.log(`🔄 Cambiando estado de tarea ${taskId} a ${newStatus}`);

if (!flow || flow.status === 'pending') return;







try {



// Use retry operation for getting the task



const { data: flowTask, error: taskError } = await retryOperation(async () => {



return await supabase



.from('commission_flow_tasks')



.select('id')



.eq('commission_flow_id', flow.id)



.eq('task_id', taskId)



.maybeSingle();



});







if (taskError) throw taskError;







if (flowTask) {



// Use retry operation for updating the task



await retryOperation(async () => {



const { error: updateError } = await supabase



.from('commission_flow_tasks')



.update({ status: newStatus })



.eq('id', flowTask.id);







if (updateError) throw updateError;



});



} else {



// Use retry operation for creating the task



await retryOperation(async () => {



const { error: createError } = await supabase



.from('commission_flow_tasks')



.insert({



commission_flow_id: flow.id,



task_id: taskId,



status: newStatus



});







if (createError) throw createError;



});



}







fetchFlow().then(() => {



// Después de actualizar el flujo, manejar la contracción automática

handleAutoCollapseStages();



});





// Trigger a refresh of comments



setCommentRefreshTrigger(prev => prev + 1);



} catch (err: any) {



setError(err.message);



}



};







const handleAddComment = async (taskId: string) => {



if (!flow || flow.status === 'pending') return;







showPopup(



<CommissionTaskCommentPopup



taskId={taskId}



commissionFlowId={flow.id}



onSave={() => {



fetchFlow();



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







const toggleTaskComments = (taskId: string) => {



setExpandedTaskId(expandedTaskId === taskId ? null : taskId);



// Refresh comments when expanding a task



if (expandedTaskId !== taskId) {



setCommentRefreshTrigger(prev => prev + 1);



}



};







const toggleStage = (stageIndex: number) => {



if (!flow) return;





const updatedStages = [...flow.stages];



updatedStages[stageIndex].isExpanded = !updatedStages[stageIndex].isExpanded;





setFlow({



...flow,



stages: updatedStages



});



};





// Función para manejar la contracción automática de etapas completadas

const handleAutoCollapseStages = () => {



if (!flow) return;





console.log('🔍 Ejecutando handleAutoCollapseStages');





const updatedStages = flow.stages.map(stage => {



// Verificar si todas las tareas de la etapa están completadas

const allTasksCompleted = stage.tasks.every(task => task.status === 'completed');



// Verificar si hay al menos una tarea pendiente, en proceso o bloqueada

const hasActiveTasks = stage.tasks.some(task => 



task.status === 'pending' || task.status === 'in_progress' || task.status === 'blocked'

);





console.log(`📋 Etapa: ${stage.name}`);

console.log(`   - Todas completadas: ${allTasksCompleted}`);

console.log(`   - Tiene tareas activas: ${hasActiveTasks}`);

console.log(`   - Estado actual: ${stage.isExpanded ? 'Expandida' : 'Contraída'}`);

console.log(`   - Tareas:`, stage.tasks.map(t => ({ name: t.name, status: t.status })));





// Si todas las tareas están completadas, contraer la etapa

// Si hay tareas activas (pendientes, en proceso o bloqueadas), mantener expandida

const shouldBeExpanded = hasActiveTasks;





console.log(`   - Debería estar: ${shouldBeExpanded ? 'Expandida' : 'Contraída'}`);





return {



...stage,



isExpanded: shouldBeExpanded



};



});





console.log('🔄 Actualizando flow con etapas:', updatedStages.map(s => ({ name: s.name, isExpanded: s.isExpanded })));





setFlow({



...flow,



stages: updatedStages



});



console.log('✅ Flow actualizado con nuevas etapas');



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







const calculateProgress = () => {



if (!flow) return 0;



const totalTasks = flow.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);



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



if (!task.started_at || !task.days_to_complete) return 0;



const endDate = task.completed_at ? new Date(task.completed_at) : new Date();



const daysElapsed = differenceInDays(endDate, new Date(task.started_at));



return Math.max(0, daysElapsed - task.days_to_complete!);



};







const formatDate = (dateString: string) => {



return formatDateChile(dateString);



};







const formatDateTime = (dateString: string) => {



return formatDateTimeChile(dateString);



};







// Navigation functions



const navigateToEditClient = () => {



if (flow?.broker_commission.reservation.client.id) {



navigate(`/clientes/editar/${flow.broker_commission.reservation.client.id}`);



}



};







const navigateToEditReservation = () => {



if (flow?.broker_commission.reservation.id) {



navigate(`/reservas/editar/${flow.broker_commission.reservation.id}`);



}



};







const navigateToEditCommission = () => {



if (flow?.broker_commission.reservation.id) {



navigate(`/pagos/${flow.broker_commission.reservation.id}`);



}



};







const navigateToReservationFlow = async () => {



if (!flow?.broker_commission.reservation.id) return;





try {



// Get the reservation flow ID



const { data, error } = await supabase



.from('reservation_flows')



.select('id')



.eq('reservation_id', flow.broker_commission.reservation.id)



.single();





if (error) throw error;





if (data) {



navigate(`/flujo-reservas/${data.id}`);



}



} catch (err: any) {



setError(err.message);



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



setShowMobySuiteModal(true);



};







const handleCreateSecondPaymentFlow = async () => {



if (!flow || !flow.broker_commission.id) return;





try {



setCreatingSecondFlow(true);





// Check if a second payment flow already exists



const { data: existingFlow, error: checkError } = await supabase



.from('commission_flows')



.select('id')



.eq('broker_commission_id', flow.broker_commission.id)



.eq('is_second_payment', true)



.maybeSingle();







if (checkError) throw checkError;







// If flow exists, navigate to it



if (existingFlow) {



navigate(`/pagos/flujo/${existingFlow.id}`);



return;



}







// Get the second payment flow ID and first stage



const { data: flowData, error: flowError } = await supabase



.from('payment_flows')



.select('id, stages:payment_flow_stages(id)')



.eq('name', 'Flujo de Segundo Pago')



.single();







if (flowError) throw flowError;







// Create new second payment flow



const { data: newFlow, error: createError } = await supabase



.from('commission_flows')



.insert({



broker_commission_id: flow.broker_commission.id,



flow_id: flowData.id,



current_stage_id: flowData.stages[0].id,



status: 'pending',



started_at: null,



is_second_payment: true



})



.select()



.single();







if (createError) throw createError;







// Navigate to the new flow



navigate(`/pagos/flujo/${newFlow.id}`);



} catch (err: any) {



setError(err.message);



} finally {



setCreatingSecondFlow(false);



}



};







// Function to handle date input change and auto-save



const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, taskId: string, type: 'start' | 'complete') => {



const newDate = e.target.value;



setTempDateValue(newDate);





// Auto-save after a short delay



if (newDate) {



await handleTaskDateChange(taskId, newDate, type);



}



};







// Function to handle marking a reservation as at risk



const handleToggleAtRisk = () => {



if (!flow) return;







showPopup(



<AtRiskPopup



commissionId={flow.broker_commission.id}



isAtRisk={flow.broker_commission.at_risk || false}



reason={flow.broker_commission.at_risk_reason || ''}



onSave={fetchFlow}



onClose={() => {}}



/>,



{



title: flow.broker_commission.at_risk ? 'Editar Estado En Riesgo' : 'Marcar Como En Riesgo',



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







const canCreateSecondPaymentFlow =



flow.status === 'completed' &&



flow.broker_commission.number_of_payments === 2 &&



!flow.is_second_payment;







return (



<Layout>



<div className="max-w-5xl mx-auto">



<div className="flex items-center justify-between mb-6">



<button



onClick={() => navigate('/pagos')}



className="flex items-center text-gray-600 hover:text-gray-900"



>



<ArrowLeft className="h-5 w-5 mr-2" />



Volver



</button>



<h1 className="text-2xl font-semibold text-gray-900">



{flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow.broker_commission.reservation.reservation_number}



</h1>



<div className="flex space-x-3 mt-4 mb-8">
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
  <button
    onClick={navigateToEditCommission}
    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
    title="Editar Comisión"
  >
    <DollarSign className="h-5 w-5" />
  </button>
  <button
    onClick={navigateToReservationFlow}
    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
    title="Flujo de Reserva"
  >
    <ListChecks className="h-5 w-5" />
  </button>
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
  <button
    disabled
    className="p-2 text-blue-600 bg-blue-50 rounded-full border border-blue-200 transition-colors cursor-default"
    title="Flujo de Pago (actual)"
  >
    <Wallet className="h-5 w-5" />
  </button>
  </div>
</div>







<div className="bg-white rounded-lg shadow-md p-6 mb-6">



<div className="grid grid-cols-1 md:grid-cols-2 gap-6">



<div>



<h2 className="text-lg font-semibold text-gray-900 mb-4">



Información General



</h2>



<dl className="space-y-2">



<div>



<dt className="text-sm font-medium text-gray-500">Cliente</dt>



<dd className="text-sm text-gray-900">



{flow.broker_commission.reservation.client.first_name} {flow.broker_commission.reservation.client.last_name}



</dd>



</div>



<div>



<dt className="text-sm font-medium text-gray-500">Proyecto</dt>



<dd className="text-sm text-gray-900">



{flow.broker_commission.reservation.project.name} {flow.broker_commission.reservation.project.stage} - {flow.broker_commission.reservation.apartment_number}



</dd>



</div>



<div>



<dt className="text-sm font-medium text-gray-500">Broker</dt>



<dd className="text-sm text-gray-900">



{flow.broker_commission.reservation.broker.name}



</dd>



</div>



<div>



<dt className="text-sm font-medium text-gray-500">Monto Comisión</dt>



<dd className="text-sm text-gray-900">



{flow.is_second_payment ?



`${((100 - flow.broker_commission.first_payment_percentage) / 100 * flow.broker_commission.commission_amount).toFixed(2)} UF (${100 - flow.broker_commission.first_payment_percentage}%)` :



`${((flow.broker_commission.first_payment_percentage / 100) * flow.broker_commission.commission_amount).toFixed(2)} UF (${flow.broker_commission.first_payment_percentage}%)`



}



</dd>



</div>



{flow.broker_commission.number_of_payments === 2 && (



<div>



<dt className="text-sm font-medium text-gray-500">Tipo de Pago</dt>



<dd className="text-sm text-gray-900">



{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}



</dd>



</div>



)}



{flow.broker_commission.at_risk && (



<div>



<dt className="text-sm font-medium text-gray-500">Estado</dt>



<dd className="text-sm flex items-center">



<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">



<AlertCircle className="h-4 w-4 mr-1" />



En Riesgo



</span>



{flow.broker_commission.at_risk_reason && (



<span className="ml-2 text-gray-500 italic">



{flow.broker_commission.at_risk_reason}



</span>



)}



</dd>



</div>



)}



</dl>



</div>







<div>



<div className="flex items-center justify-between mb-4">



<h2 className="text-lg font-semibold text-gray-900">



Estado del Proceso



</h2>



<div className="flex space-x-2">



{isAdmin && flow.status === 'pending' && (



<button



onClick={handleStartFlow}



disabled={startingFlow}



className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"



>



{startingFlow ? (



<>



<Loader2 className="animate-spin h-4 w-4 mr-2" />



Iniciando...



</>



) : (



<>



<Play className="h-4 w-4 mr-2" />



Proceder con Pago



</>



)}



</button>



)}





{canCreateSecondPaymentFlow && (



<button



onClick={handleCreateSecondPaymentFlow}



disabled={creatingSecondFlow}



className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"



>



{creatingSecondFlow ? (



<>



<Loader2 className="animate-spin h-4 w-4 mr-2" />



Creando...



</>



) : (



<>



<Plus className="h-4 w-4 mr-2" />



Crear Segundo Pago



</>



)}



</button>



)}





{flow.status === 'in_progress' && !flow.broker_commission.at_risk && (



<button



onClick={handleToggleAtRisk}



disabled={markingAtRisk}



className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"



>



{markingAtRisk ? (



<>



<Loader2 className="animate-spin h-4 w-4 mr-2" />



Procesando...



</>



) : (



<>



<Edit className="h-4 w-4 mr-2" />



Editar Estado Riesgo



</>



)}



</button>



)}





{flow.status === 'in_progress' && flow.broker_commission.at_risk && (



<button



onClick={handleToggleAtRisk}



disabled={markingAtRisk}



className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"



>



{markingAtRisk ? (



<>



<Loader2 className="animate-spin h-4 w-4 mr-2" />



Procesando...



</>



) : (



<>



<Edit className="h-4 w-4 mr-2" />



Editar Estado Riesgo



</>



)}



</button>



)}



</div>



</div>



<div className="space-y-4">



<div>



<div className="flex justify-between text-sm font-medium text-gray-500 mb-1">



<span>Progreso</span>



<span>{Math.round(calculateProgress())}%</span>



</div>



<div className="w-full bg-gray-200 rounded-full h-2.5">



<div



className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"



style={{ width: `${calculateProgress()}%` }}



></div>



</div>



</div>







<div>



<dt className="text-sm font-medium text-gray-500">Iniciado</dt>



<dd className="text-sm text-gray-900">



{flow.started_at ? (



<div className="flex items-center">



{editingStartDate ? (



<input



type="datetime-local"



defaultValue={flow.started_at.split('.')[0]}



onChange={(e) => handleStartDateChange(e.target.value)}



className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"



/>



) : (



<>



<span>{formatDateTime(flow.started_at)}</span>



{isAdmin && (



<button



onClick={() => setEditingStartDate(true)}



className="ml-2 text-blue-600 hover:text-blue-800"



title="Editar fecha"



>



<Edit className="h-4 w-4" />



</button>



)}



</>



)}



</div>



) : (



<span className="text-gray-500">No iniciado</span>



)}



</dd>



</div>







{flow.completed_at && (



<div>



<dt className="text-sm font-medium text-gray-500">Completado</dt>



<dd className="text-sm text-gray-900">



{formatDateTime(flow.completed_at)}



</dd>



</div>



)}







<div>



<dt className="text-sm font-medium text-gray-500">Días Transcurridos</dt>



<dd className="text-sm text-gray-900">



{getDaysElapsed(flow.started_at || undefined, flow.completed_at)} días



</dd>



</div>







<div>



<dt className="text-sm font-medium text-gray-500">Etapa Actual</dt>



<dd className="text-sm text-gray-900">



{flow.current_stage?.name || 'No iniciado'}



</dd>



</div>



</div>



</div>



</div>



</div>









<div className="space-y-6">



{flow.stages.map((stage, stageIndex) => (

  <div
    id={`stage-${stage.id}`}
    key={stage.id}
    className="bg-white rounded-lg shadow-md overflow-hidden"
  >

    <div
      className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between cursor-pointer"
      onClick={() => toggleStage(stageIndex)}
    >

      <div className="flex items-center">

        {stage.isExpanded ? (
          <ChevronDown className="h-5 w-5 mr-2" />
        ) : (
          <ChevronRight className="h-5 w-5 mr-2" />
        )}

        <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>

      </div>

      {stage.isCompleted && (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          Completada
        </span>
      )}

    </div>

    {stage.isExpanded && (
      <div className="divide-y divide-gray-200">
        {stage.tasks.map((task) => {
          const completionTime = task.completed_at && task.started_at ?
            getDaysElapsed(task.started_at, task.completed_at) : null;
          const daysOverdue = getDaysOverdue(task);
          const expectedDate = getExpectedDate(task);
          const hasComments = task.comments_count > 0;

          return (
            <div key={task.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Nombre de la tarea */}
                  <div className="mb-3">
                    <h4 className="text-base font-medium text-gray-900">
                      {task.name}
                    </h4>
                  </div>

                  {/* Usuario asignado */}
                  <div className="mb-3">
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
                        <span className="ml-2 text-sm text-gray-600">
                          {task.assignee.first_name} {task.assignee.last_name}
                        </span>
                      </div>
                    ) : task.default_assignee ? (
                      <button
                        onClick={() => handleAssign(task.id, null, task.default_assignee)}
                        className="flex items-center text-blue-600 hover:text-blue-800"
                        disabled={flow.status === 'pending'}
                      >
                        <UserPlus className="h-5 w-5 mr-1" />
                        <span>Asignar a {task.default_assignee.first_name}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAssign(task.id, null, null)}
                        className="flex items-center text-blue-600 hover:text-blue-800"
                        disabled={flow.status === 'pending'}
                      >
                        <UserPlus className="h-5 w-5 mr-1" />
                        <span>Asignar</span>
                      </button>
                    )}
                  </div>

                  {/* Fechas de inicio y completado debajo del usuario */}
                  <div className="space-y-2 mb-3">
                    {task.started_at && (
                      <div className="flex items-center text-sm text-gray-500">
                        {editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'start' ? (
                          <div className="flex items-center">
                            <input
                              type="datetime-local"
                              value={tempDateValue}
                              onChange={(e) => handleDateInputChange(e, task.id, 'start')}
                              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              Iniciada el {formatDateTime(task.started_at)}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setEditingTaskDate({ taskId: task.id, type: 'start' });
                                  setTempDateValue(task.started_at.split('.')[0]);
                                }}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                                title="Editar fecha de inicio"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {task.completed_at && (
                      <div className="flex items-center text-sm text-green-600">
                        {editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'complete' ? (
                          <div className="flex items-center">
                            <input
                              type="datetime-local"
                              value={tempDateValue}
                              onChange={(e) => handleDateInputChange(e, task.id, 'complete')}
                              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            <span>
                              Completada el {formatDateTime(task.completed_at)}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setEditingTaskDate({ taskId: task.id, type: 'complete' });
                                  setTempDateValue(task.completed_at?.split('.')[0] || '');
                                }}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                                title="Editar fecha de completado"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botones de comentarios */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <button
                      onClick={() => handleAddComment(task.id)}
                      className="flex items-center text-gray-500 hover:text-gray-700 relative"
                      disabled={flow.status === 'pending'}
                    >
                      <MessageSquare className="h-5 w-5 mr-1" />
                      <span>Comentar</span>
                      {task.comments_count > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 text-xs flex items-center justify-center bg-blue-600 text-white rounded-full">
                          {task.comments_count}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => toggleTaskComments(task.id)}
                      className="flex items-center text-gray-500 hover:text-gray-700"
                      disabled={flow.status === 'pending' || task.comments_count === 0}
                    >
                      <span>Ver comentarios</span>
                      <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${
                        expandedTaskId === task.id ? 'rotate-180' : ''
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Selector de estado y información de gestión a la derecha */}
                <div className="flex flex-col items-end space-y-3 text-sm text-gray-500 ml-4">
                  {/* Selector de estado en la esquina superior derecha */}
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

                  {/* Gestionado en */}
                  {completionTime !== null && (
                    <div className="flex items-center text-green-600">
                      <Timer className="h-4 w-4 mr-1" />
                      <span>
                        Gestionado en {completionTime} {completionTime === 1 ? 'día' : 'días'}
                      </span>
                    </div>
                  )}

                  {/* Plazo */}
                  {task.days_to_complete && (
                    <div className="flex flex-col items-end">
                      <span>Plazo: {task.days_to_complete} días</span>
                      {daysOverdue > 0 && (
                        <span className="flex items-center text-red-600 mt-1">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          {daysOverdue} días de retraso
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
))}

</div>

</div>

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
              {expandedSections.reserva ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            {expandedSections.reserva && (
              <div className="p-4 space-y-2">
                <a
                  href={`https://ecasa.mobysuite.com/reservation/payment-plan-detail/${flow?.broker_commission?.reservation?.reservation_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">Detalle Plan de Pago</span>
                  <ChevronRight className="h-5 w-5 text-blue-600" />
                </a>
                <a
                  href={`https://ecasa.mobysuite.com/reserve/${flow?.broker_commission?.reservation?.reservation_number}`}
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
              {expandedSections.promesa ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            {expandedSections.promesa && (
              <div className="p-4 space-y-2">
                <a
                  href={`https://ecasa.mobysuite.com/promise/${flow?.broker_commission?.reservation?.reservation_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">Promesar Unidad</span>
                  <ChevronRight className="h-5 w-5 text-green-600" />
                </a>
                <a
                  href={`https://ecasa.mobysuite.com/promise/${flow?.broker_commission?.reservation?.reservation_number}/tracking-signatures`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">Seguimiento Firmas</span>
                  <ChevronRight className="h-5 w-5 text-green-600" />
                </a>
                <a
                  href={`https://ecasa.mobysuite.com/promise/${flow?.broker_commission?.reservation?.reservation_number}/tracking-signatures`}
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
              {expandedSections.escritura ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
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
              {expandedSections.modificaciones ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            {expandedSections.modificaciones && (
              <div className="p-4 space-y-2">
                <a
                  href={`https://ecasa.mobysuite.com/accounting/payment-plan-detail/${flow?.broker_commission?.reservation?.reservation_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">Plan de Pago</span>
                  <ChevronRight className="h-5 w-5 text-orange-600" />
                </a>
                <a
                  href={`https://ecasa.mobysuite.com/modification/edit/${flow?.broker_commission?.reservation?.reservation_number}`}
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
        <div className="flex justify-end mt-6">
          <button
            onClick={() => setShowMobySuiteModal(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </Dialog.Panel>
    </div>
  </Dialog>
)}

</Layout>
);
}

export default PaymentFlow;