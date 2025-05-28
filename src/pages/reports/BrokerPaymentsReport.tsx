import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Download, Search, Calendar, ArrowDown, ArrowUp, Clock, AlertCircle, UserCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface BrokerPaymentTask {
  id: string;
  commission_flow_id: string;
  reservation_number: string;
  project_name: string;
  project_stage: string;
  apartment_number: string;
  broker_name: string;
  commission_amount: number;
  task_name: string;
  task_status: string;
  started_at: string | null;
  assignee: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  days_pending: number;
  days_to_complete: number | null;
  is_overdue: boolean;
  invoice_number: string | null; // Added invoice number field
}

const BrokerPaymentsReport: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BrokerPaymentTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('days_pending');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalAmount, setTotalAmount] = useState<number>(0);

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = tasks.filter(task => 
        task.reservation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.apartment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.broker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.invoice_number && task.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) || // Search by invoice number
        (task.assignee && 
          (`${task.assignee.first_name} ${task.assignee.last_name}`).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setTasks(filtered);
    } else {
      fetchPendingTasks();
    }
  }, [searchTerm]);

  const fetchPendingTasks = async () => {
    try {
      setLoading(true);
      
      // Get all commission flows that are in progress
      const { data: flowsData, error: flowsError } = await supabase
        .from('commission_flows')
        .select(`
          id,
          broker_commission:broker_commissions(
            id,
            commission_amount,
            invoice_1,
            invoice_2,
            reservation:reservations(
              reservation_number,
              apartment_number,
              project:projects(name, stage),
              broker:brokers(name)
            )
          )
        `)
        .eq('status', 'in_progress');

      if (flowsError) throw flowsError;

      // Get all tasks for these flows that are pending or in_progress (not completed or blocked)
      const flowIds = flowsData?.map(flow => flow.id) || [];
      
      if (flowIds.length === 0) {
        setTasks([]);
        setTotalAmount(0);
        setLoading(false);
        return;
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('commission_flow_tasks')
        .select(`
          id,
          commission_flow_id,
          task_id,
          status,
          started_at,
          assignee:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          ),
          task:payment_flow_tasks(
            name,
            days_to_complete
          )
        `)
        .in('commission_flow_id', flowIds)
        .in('status', ['pending', 'in_progress']); // Only pending and in_progress tasks

      if (tasksError) throw tasksError;

      // Map the data to our interface
      const now = new Date();
      const mappedTasks: BrokerPaymentTask[] = [];
      let totalCommissionAmount = 0;

      tasksData?.forEach(task => {
        const flow = flowsData?.find(f => f.id === task.commission_flow_id);
        if (!flow || !flow.broker_commission) return;

        const taskDetails = task.task;
        if (!taskDetails) return;

        const startedAt = task.started_at ? new Date(task.started_at) : null;
        const daysPending = startedAt ? differenceInDays(now, startedAt) : 0;
        const daysToComplete = taskDetails.days_to_complete || null;
        const isOverdue = daysToComplete !== null && daysPending > daysToComplete;

        // Determine which invoice to show (prefer invoice_2 if it exists, otherwise use invoice_1)
        const invoiceNumber = flow.broker_commission.invoice_2 || flow.broker_commission.invoice_1;

        mappedTasks.push({
          id: task.id,
          commission_flow_id: task.commission_flow_id,
          reservation_number: flow.broker_commission.reservation.reservation_number,
          project_name: flow.broker_commission.reservation.project.name,
          project_stage: flow.broker_commission.reservation.project.stage,
          apartment_number: flow.broker_commission.reservation.apartment_number,
          broker_name: flow.broker_commission.reservation.broker.name,
          commission_amount: flow.broker_commission.commission_amount,
          task_name: taskDetails.name || 'Unknown Task',
          task_status: task.status,
          started_at: task.started_at,
          assignee: task.assignee,
          days_pending: daysPending,
          days_to_complete: daysToComplete,
          is_overdue: isOverdue,
          invoice_number: invoiceNumber // Add invoice number to the task data
        });

        // Only count each commission once
        if (!mappedTasks.some(t => 
          t.id !== task.id && 
          t.reservation_number === flow.broker_commission.reservation.reservation_number
        )) {
          totalCommissionAmount += flow.broker_commission.commission_amount;
        }
      });

      setTasks(mappedTasks);
      setTotalAmount(totalCommissionAmount);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) return;

    // Create CSV content
    const headers = [
      'N° Reserva',
      'Proyecto-Depto',
      'Broker',
      'Comisión',
      'N° Factura',
      'Tarea Pendiente',
      'Estado',
      'Responsable',
      'Días Pendientes',
      'Plazo (días)',
      'Atrasado'
    ];

    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        `"${task.reservation_number}"`,
        `"${task.project_name} ${task.project_stage}-${task.apartment_number}"`,
        `"${task.broker_name}"`,
        task.commission_amount,
        `"${task.invoice_number || ''}"`,
        `"${task.task_name}"`,
        `"${task.task_status}"`,
        `"${task.assignee ? `${task.assignee.first_name} ${task.assignee.last_name}` : 'Sin asignar'}"`,
        task.days_pending,
        task.days_to_complete || 'N/A',
        task.is_overdue ? 'Sí' : 'No'
      ].join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_pagos_brokers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (task: BrokerPaymentTask) => {
    navigate(`/pagos/flujo/${task.commission_flow_id}`);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'reservation_number':
        comparison = a.reservation_number.localeCompare(b.reservation_number);
        break;
      case 'project_name':
        comparison = a.project_name.localeCompare(b.project_name);
        break;
      case 'apartment_number':
        comparison = a.apartment_number.localeCompare(b.apartment_number);
        break;
      case 'broker_name':
        comparison = a.broker_name.localeCompare(b.broker_name);
        break;
      case 'commission_amount':
        comparison = a.commission_amount - b.commission_amount;
        break;
      case 'invoice_number':
        comparison = (a.invoice_number || '').localeCompare(b.invoice_number || '');
        break;
      case 'task_name':
        comparison = a.task_name.localeCompare(b.task_name);
        break;
      case 'assignee':
        const aName = a.assignee ? `${a.assignee.first_name} ${a.assignee.last_name}` : '';
        const bName = b.assignee ? `${b.assignee.first_name} ${b.assignee.last_name}` : '';
        comparison = aName.localeCompare(bName);
        break;
      case 'days_pending':
        comparison = a.days_pending - b.days_pending;
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 inline-block ml-1" /> : 
      <ArrowDown className="h-4 w-4 inline-block ml-1" />;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Proceso';
      case 'blocked':
        return 'Bloqueada';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Informe de Pagos Brokers</h1>
          
          <div className="flex space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por reserva, proyecto, factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={handleExportCSV}
              disabled={tasks.length === 0}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No hay tareas pendientes de pago a brokers
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Tareas Pendientes
                  </h2>
                  <p className="text-sm text-gray-500">
                    Total de registros: {tasks.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Comisiones</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(totalAmount)} UF
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('reservation_number')}
                      >
                        N° Reserva <SortIcon field="reservation_number" />
                      </th>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('project_name')}
                      >
                        Proyecto-Depto <SortIcon field="project_name" />
                      </th>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('broker_name')}
                      >
                        Broker <SortIcon field="broker_name" />
                      </th>
                      <th 
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('commission_amount')}
                      >
                        Comisión <SortIcon field="commission_amount" />
                      </th>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('invoice_number')}
                      >
                        N° Factura <SortIcon field="invoice_number" />
                      </th>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('task_name')}
                      >
                        Tarea Pendiente <SortIcon field="task_name" />
                      </th>
                      <th 
                        className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Estado
                      </th>
                      <th 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('assignee')}
                      >
                        Responsable <SortIcon field="assignee" />
                      </th>
                      <th 
                        className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('days_pending')}
                      >
                        Días <SortIcon field="days_pending" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-xs">
                    {sortedTasks.map((task) => (
                      <tr 
                        key={task.id} 
                        className={`hover:bg-gray-50 ${task.is_overdue ? 'bg-red-50' : ''} cursor-pointer`}
                        onClick={() => handleRowClick(task)}
                      >
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">
                          {task.reservation_number}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                          {task.project_name} {task.project_stage}-{task.apartment_number}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                          {task.broker_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right">
                          {formatCurrency(task.commission_amount)} UF
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                          {task.invoice_number || '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                          {task.task_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(task.task_status)}`}>
                            {getStatusText(task.task_status)}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                          {task.assignee ? (
                            <div className="flex items-center">
                              {task.assignee.avatar_url ? (
                                <img 
                                  src={task.assignee.avatar_url} 
                                  alt={`${task.assignee.first_name} ${task.assignee.last_name}`}
                                  className="h-5 w-5 rounded-full mr-1"
                                />
                              ) : (
                                <UserCircle className="h-5 w-5 text-gray-400 mr-1" />
                              )}
                              {task.assignee.first_name} {task.assignee.last_name}
                            </div>
                          ) : (
                            <span className="text-gray-400">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <span className={`font-medium ${task.is_overdue ? 'text-red-600' : 'text-gray-900'}`}>
                              {task.days_pending}
                            </span>
                            {task.is_overdue && (
                              <AlertCircle className="h-3 w-3 text-red-500 ml-1" title="Tarea atrasada" />
                            )}
                          </div>
                          {task.days_to_complete && (
                            <div className="text-xs text-gray-500">
                              Plazo: {task.days_to_complete}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default BrokerPaymentsReport;