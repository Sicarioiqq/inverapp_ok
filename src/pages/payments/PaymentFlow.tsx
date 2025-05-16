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
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// [Previous type definitions remain unchanged]

const PaymentFlowPage: React.FC = () => {
  // [Previous state definitions remain unchanged]

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

  // [Previous useEffect and function definitions remain unchanged]

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-8 p-4 bg-red-50 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar el flujo de pago</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => navigate('/pagos')}
                className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Volver a la lista de pagos
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!flow) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-8 p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Flujo de pago no encontrado</h3>
              <p className="mt-1 text-sm text-yellow-700">No se pudo encontrar el flujo de pago solicitado.</p>
              <button
                onClick={() => navigate('/pagos')}
                className="mt-3 text-sm font-medium text-yellow-600 hover:text-yellow-500"
              >
                Volver a la lista de pagos
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const canCreateSecondPaymentFlow = flow?.status === 'completed' && 
    flow?.broker_commission?.number_of_payments === 2 && 
    !flow?.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" /> Volver
          </button>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 text-center">
            {flow?.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow?.broker_commission?.reservation?.reservation_number || 'N/A'}
          </h1>
          <div className="flex space-x-1 md:space-x-2">
            <button onClick={navigateToEditClient} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Cliente">
              <Users className="h-5 w-5" />
            </button>
            <button onClick={navigateToEditReservation} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Reserva">
              <Edit2 className="h-5 w-5" />
            </button>
            <button onClick={navigateToEditCommission} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Comisión">
              <DollarSign className="h-5 w-5" />
            </button>
            <button onClick={navigateToReservationFlow} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Flujo de Reserva">
              <ListChecks className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-blue-600"/>Información General
                </h2>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">Cliente</dt>
                    <dd className="text-gray-800">
                      {flow?.broker_commission?.reservation?.client?.first_name} {flow?.broker_commission?.reservation?.client?.last_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Proyecto</dt>
                    <dd className="text-gray-800">
                      {flow?.broker_commission?.reservation?.project?.name} {flow?.broker_commission?.reservation?.project?.stage} - {flow?.broker_commission?.reservation?.apartment_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Broker</dt>
                    <dd className="text-gray-800">{flow?.broker_commission?.reservation?.broker?.name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Monto Comisión</dt>
                    <dd className="text-gray-800 font-semibold">
                      {flow?.is_second_payment 
                        ? `${formatCurrency(((100 - (flow?.broker_commission?.first_payment_percentage || 0)) / 100 * (flow?.broker_commission?.commission_amount || 0)))} UF (${100 - (flow?.broker_commission?.first_payment_percentage || 0)}%)`
                        : `${formatCurrency((((flow?.broker_commission?.first_payment_percentage || 0) / 100) * (flow?.broker_commission?.commission_amount || 0)))} UF (${flow?.broker_commission?.first_payment_percentage || 0}%)`
                      }
                    </dd>
                  </div>
                  {flow?.broker_commission?.number_of_payments === 2 && (
                    <div>
                      <dt className="font-medium text-gray-500">Tipo de Pago</dt>
                      <dd className="text-gray-800">{flow?.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd>
                    </div>
                  )}
                  {flow?.broker_commission?.at_risk && (
                    <div>
                      <dt className="font-medium text-gray-500">Estado Riesgo</dt>
                      <dd className="flex items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle className="h-4 w-4 mr-1" />En Riesgo
                        </span>
                        {flow?.broker_commission?.at_risk_reason && (
                          <span className="ml-2 text-gray-600 italic text-xs">{flow?.broker_commission?.at_risk_reason}</span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-blue-600"/>Estado del Proceso
                  </h2>
                  <div className="flex space-x-2">
                    {isAdmin && flow?.status === 'pending' && (
                      <button 
                        onClick={handleStartFlow} 
                        disabled={startingFlow} 
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {startingFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Play className="h-4 w-4 mr-1" />Proceder</>}
                      </button>
                    )}
                    {canCreateSecondPaymentFlow && (
                      <button 
                        onClick={handleCreateSecondPaymentFlow} 
                        disabled={creatingSecondFlow} 
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        {creatingSecondFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />2do Pago</>}
                      </button>
                    )}
                    {flow?.status === 'in_progress' && !flow?.broker_commission?.at_risk && (
                      <button 
                        onClick={handleToggleAtRisk} 
                        disabled={markingAtRisk} 
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                      >
                        {markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</>}
                      </button>
                    )}
                    {flow?.status === 'in_progress' && flow?.broker_commission?.at_risk && (
                      <button 
                        onClick={handleToggleAtRisk} 
                        disabled={markingAtRisk} 
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><Edit className="h-4 w-4 mr-1" />Editar Riesgo</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex justify-between font-medium text-gray-500 mb-0.5">
                      <span>Progreso</span>
                      <span>{Math.round(calculateProgress())}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${calculateProgress()}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Iniciado</dt>
                    <dd className="text-gray-800">
                      {flow?.started_at ? (
                        <div className="flex items-center text-xs">
                          {editingStartDate ? (
                            <input 
                              type="datetime-local" 
                              defaultValue={flow.started_at.split('.')[0]} 
                              onChange={(e) => handleStartDateChange(e.target.value)} 
                              className="text-xs border-gray-300 rounded-md" 
                            />
                          ) : (
                            <>
                              <span>{formatDateTime(flow.started_at)}</span>
                              {isAdmin && (
                                <button 
                                  onClick={() => setEditingStartDate(true)} 
                                  className="ml-1.5 text-blue-600 hover:text-blue-800" 
                                  title="Editar fecha"
                                >
                                  <Edit className="h-3 w-3" />
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
                  {flow?.completed_at && (
                    <div>
                      <dt className="font-medium text-gray-500">Completado</dt>
                      <dd className="text-gray-800 text-xs">{formatDateTime(flow.completed_at)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium text-gray-500">Días Transcurridos</dt>
                    <dd className="text-gray-800">{getDaysElapsed(flow?.started_at || undefined, flow?.completed_at)} días</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Etapa Actual</dt>
                    <dd className="text-gray-800">{flow?.current_stage?.name || 'No iniciado'}</dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informes y Documentos card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-gray-700" />
              Informes y Documentos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {flow && flow?.broker_commission?.reservation?.id && !loadingPdfData && financialSummaryForPDF && (
                <PDFDownloadLink
                  document={
                    <LiquidacionPagoBrokerPDF 
                      flowData={flow} 
                      appliedPromotions={appliedPromotions}
                      financialSummary={financialSummaryForPDF} 
                      formatDate={formatDateChile} 
                      formatCurrency={formatCurrency}
                    />
                  }
                  fileName={`Liquidacion_Broker_${flow?.broker_commission?.reservation?.reservation_number || id}.pdf`}
                  className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {({ loading: pdfLoading }) =>
                    pdfLoading ? (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generando PDF...</>
                    ) : (
                      <><FileText className="h-5 w-5 mr-2" /> Descargar Liquidación</>
                    )
                  }
                </PDFDownloadLink>
              )}
              {loadingPdfData && !financialSummaryForPDF && (
                <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-500 opacity-75 cursor-not-allowed" disabled>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos PDF...
                </button>
              )}
              <button 
                onClick={navigateToDocuments} 
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" 
                title="Documentos del Cliente"
              >
                <Users className="h-5 w-5 mr-2" /> Documentos Cliente
              </button>
              <button 
                onClick={navigateToTaskTracking} 
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" 
                title="Seguimiento de Tareas"
              >
                <ClipboardList className="h-5 w-5 mr-2" /> Seguimiento Tareas
              </button>
            </div>
          </div>

          {/* Etapas y Tareas del Flujo */}
          {flow?.stages?.map((stage, stageIndex) => (
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
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Completada
                  </span>
                )}
              </div>
              {stage.isExpanded && (
                <div className="divide-y divide-gray-200">
                  {stage.tasks.map((task, taskIndex) => {
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
                            <button 
                              onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} 
                              className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" 
                              title="Expandir tarea"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3">
                                <div className="mt-1">
                                  {getStatusIcon(task.status)}
                                </div>
                                <div>
                                  <h4 className="text-base font-medium text-gray-900">{task.name}</h4>
                                  <div className="mt-1 flex items-center space-x-2 text-sm text-gray-500">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                      {getStatusText(task.status)}
                                    </span>
                                    {task.days_to_complete && (
                                      <span className="flex items-center">
                                        <Timer className="h-4 w-4 mr-1" />
                                        {task.days_to_complete} días
                                      </span>
                                    )}
                                    {daysOverdue > 0 && task.status !== 'completed' && (
                                      <span className="text-red-600 flex items-center">
                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                        {daysOverdue} días de retraso
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isTaskCompleted && (
                                  <button 
                                    onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} 
                                    className="p-1 text-gray-400 hover:text-gray-500" 
                                    title="Colapsar tarea"
                                  >
                                    <ChevronDown className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">Asignado a</span>
                                  <button 
                                    onClick={() => handleAssign(task.id, task.assignee || null, task.default_assignee || null)} 
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {task.assignee ? <Edit className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                                  </button>
                                </div>
                                {task.assignee ? (
                                  <div className="flex items-center space-x-2">
                                    {task.assignee.avatar_url ? (
                                      <img 
                                        src={task.assignee.avatar_url} 
                                        alt={`${task.assignee.first_name} ${task.assignee.last_name}`} 
                                        className="h-6 w-6 rounded-full"
                                      />
                                    ) : (
                                      <UserCircle className="h-6 w-6 text-gray-400" />
                                    )}
                                    <span className="text-sm text-gray-900">
                                      {task.assignee.first_name} {task.assignee.last_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">Sin asignar</span>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">Fechas</span>
                                  {(task.status === 'pending' || task.status === 'in_progress') && (
                                    <div className="flex space-x-2">
                                      {!task.started_at && (
                                        <button 
                                          onClick={() => handleStatusChange(task.id, 'in_progress')} 
                                          className="text-blue-600 hover:text-blue-800"
                                        >
                                          <Play className="h-4 w-4" />
                                        </button>
                                      )}
                                      {task.started_at && !task.completed_at && (
                                        <button 
                                          onClick={() => handleStatusChange(task.id, 'completed')} 
                                          className="text-green-600 hover:text-green-800"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Inicio</span>
                                    <span className="text-gray-900">
                                      {task.started_at ? formatDateTime(task.started_at) : 'No iniciado'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Fin</span>
                                    <span className="text-gray-900">
                                      {task.completed_at ? formatDateTime(task.completed_at) : 'No completado'}
                                    </span>
                                  </div>
                                  {completionTime !== null && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">Tiempo total</span>
                                      <span className="text-gray-900">{completionTime} días</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <button 
                                  onClick={() => handleAddComment(task.commission_flow_task_id)} 
                                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Comentar
                                </button>
                                {task.comments_count > 0 && (
                                  <button 
                                    onClick={() => toggleTaskComments(task.commission_flow_task_id)} 
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                  >
                                    Ver {task.comments_count} comentario{task.comments_count !== 1 ? 's' : ''}
                                  </button>
                                )}
                              </div>
                            </div>

                            {expandedTaskId === task.commission_flow_task_id && (
                              <div className="mt-4">
                                <CommissionTaskCommentList 
                                  taskId={task.commission_flow_task_id || ''} 
                                  onCommentAdded={() => setCommentRefreshTrigger(prev => prev + 1)}
                                />
                              </div>
                            )}
                          </div>
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

export default PaymentFlowPage;