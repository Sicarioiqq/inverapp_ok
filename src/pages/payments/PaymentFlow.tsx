{/* Previous imports and code remain unchanged until the affected line */}
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF'; // Correcta ruta
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,
  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,
  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// --- Definiciones de Tipos (como las tenías) ---
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
      client: { id: string; first_name: string; last_name: string; rut: string;};
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
    };
  };
  current_stage: { id: string; name: string; } | null;
  stages: Stage[];
}
interface User { /* ... (sin cambios) ... */ }
interface FinancialSummaryForPDF {
    totalPayment: number; recoveryPayment: number; minimumPrice: number;
    difference: number; totalCommissionUF: number; firstPaymentUF: number;
    secondPaymentUF?: number; totalPromotionsAgainstDiscount: number;
}

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

  // ... (rest of the component code remains unchanged until the affected line)

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          {/* ... (previous JSX remains unchanged) ... */}
        </div>
        
        <div className="space-y-6">
          {/* ... (previous JSX remains unchanged) ... */}
            
          {/* Etapas y Tareas del Flujo */}
          {flow.stages.map((stage, stageIndex) => (
            <div key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className={`flex items-center justify-between p-4 bg-gray-50 cursor-pointer ${stage.isCompleted ? 'bg-green-50' : ''}`} onClick={() => toggleStage(stageIndex)}>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                  {stage.isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                {stage.isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
              </div>
              
              {stage.isExpanded && (
                <div className="p-4">
                  {stage.tasks.map((task, taskIndex) => (
                    <div key={task.id} className={`border-b last:border-b-0 py-4 ${task.isCollapsed ? 'opacity-75' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <button onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} className="text-gray-900 font-medium hover:text-blue-600 transition-colors">
                              {task.name}
                            </button>
                            {getStatusIcon(task.status)}
                            {task.comments_count > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {task.comments_count}
                              </span>
                            )}
                          </div>
                          
                          {!task.isCollapsed && (
                            <div className="space-y-3 mt-2">
                              <div className="flex items-center space-x-4 text-sm">
                                <div className="flex items-center text-gray-500">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {getStatusText(task.status)}
                                </div>
                                
                                {task.assignee ? (
                                  <button onClick={() => handleAssign(task.id, task.assignee, task.default_assignee)} className="flex items-center text-gray-500 hover:text-blue-600">
                                    <UserCircle className="h-4 w-4 mr-1" />
                                    {task.assignee.first_name} {task.assignee.last_name}
                                  </button>
                                ) : (
                                  <button onClick={() => handleAssign(task.id, null, task.default_assignee)} className="flex items-center text-gray-500 hover:text-blue-600">
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Asignar
                                  </button>
                                )}
                                
                                {task.started_at && (
                                  <div className="flex items-center text-gray-500">
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Iniciado: {formatDate(task.started_at)}
                                  </div>
                                )}
                                
                                {task.completed_at && (
                                  <div className="flex items-center text-gray-500">
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Completado: {formatDate(task.completed_at)}
                                  </div>
                                )}
                              </div>
                              
                              {task.status !== 'completed' && task.days_to_complete && (
                                <div className="flex items-center space-x-4 text-sm">
                                  <div className="flex items-center text-gray-500">
                                    <Timer className="h-4 w-4 mr-1" />
                                    Plazo: {task.days_to_complete} días
                                  </div>
                                  
                                  {getExpectedDate(task) && (
                                    <div className="flex items-center text-gray-500">
                                      <Calendar className="h-4 w-4 mr-1" />
                                      Fecha Esperada: {formatDate(getExpectedDate(task))}
                                    </div>
                                  )}
                                  
                                  {getDaysOverdue(task) > 0 && (
                                    <div className="flex items-center text-red-500">
                                      <AlertTriangle className="h-4 w-4 mr-1" />
                                      {getDaysOverdue(task)} días de retraso
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-2">
                                {task.status === 'pending' && (
                                  <button onClick={() => handleStatusChange(task.id, 'in_progress')} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                    <Play className="h-4 w-4 mr-1" />
                                    Iniciar
                                  </button>
                                )}
                                
                                {task.status === 'in_progress' && (
                                  <button onClick={() => handleStatusChange(task.id, 'completed')} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Completar
                                  </button>
                                )}
                                
                                <button onClick={() => handleAddComment(task.commission_flow_task_id)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Comentar
                                </button>
                              </div>
                              
                              {expandedTaskId === task.commission_flow_task_id && (
                                <CommissionTaskCommentList taskId={task.commission_flow_task_id} onRefresh={() => setCommentRefreshTrigger(prev => prev + 1)} />
                              )}
                            </div>
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
    </Layout>
  );
};

export default PaymentFlowPage;