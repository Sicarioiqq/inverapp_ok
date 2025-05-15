import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';
import { Download, Search, Calendar, ArrowDown, ArrowUp, Clock, AlertCircle, UserCircle, CheckCircle2 } from 'lucide-react';
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
}

const BrokerPaymentsApproval: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BrokerPaymentTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('days_pending');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPendingApprovals();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (searchTerm.trim() && tasks.length > 0) {
      const filtered = tasks.filter(task => 
        task.reservation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.apartment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.broker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.assignee && 
          (`${task.assignee.first_name} ${task.assignee.last_name}`).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setTasks(filtered);
    } else if (!searchTerm.trim()) {
      fetchPendingApprovals();
    }
  }, [searchTerm]);

  const fetchPendingApprovals = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Get all VB Jefe Inversiones tasks that are pending and assigned to the current user
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
          )
        `)
        .eq('status', 'pending')
        .eq('assignee_id', session.user.id);

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setTotalAmount(0);
        setLoading(false);
        return;
      }

      // Get task details for VB Jefe Inversiones
      const taskIds = tasksData.map(task => task.task_id);
      const { data: taskDetailsData, error: taskDetailsError } = await supabase
        .from('payment_flow_tasks')
        .select(`
          id,
          name,
          days_to_complete
        `)
        .eq('name', 'VB Jefe Inversiones')
        .in('id', taskIds);

      if (taskDetailsError) throw taskDetailsError;

      // Create a map of task details by ID
      const taskDetailsMap = new Map();
      taskDetailsData?.forEach(task => {
        taskDetailsMap.set(task.id, task);
      });

      // Get flow information for these tasks
      const flowIds = tasksData.map(task => task.commission_flow_id);
      
      const { data: flowsData, error: flowsError } = await supabase
        .from('commission_flows')
        .select(`
          id,
          broker_commission:broker_commissions(
            commission_amount,
            reservation:reservations(
              reservation_number,
              apartment_number,
              project:projects(name, stage),
              broker:brokers(name)
            )
          )
        `)
        .in('id', flowIds);

      if (flowsError) throw flowsError;

      // Map the data to our interface
      const now = new Date();
      const mappedTasks: BrokerPaymentTask[] = [];
      let totalCommissionAmount = 0;

      tasksData.forEach(task => {
        const flow = flowsData?.find(f => f.id === task.commission_flow_id);
        if (!flow || !flow.broker_commission) return;

        const taskDetails = taskDetailsMap.get(task.task_id);
        if (!taskDetails) return;

        const startedAt = task.started_at ? new Date(task.started_at) : null;
        const daysPending = startedAt ? differenceInDays(now, startedAt) : 0;
        const daysToComplete = taskDetails.days_to_complete || null;
        const isOverdue = daysToComplete !== null && daysPending > daysToComplete;

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
          is_overdue: isOverdue
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
    link.setAttribute('download', `aprobaciones_pendientes_${new Date().toISOString().split('T')[0]}.csv`);
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
    navigate(`/informes/aprobacion-liquidaciones/${task.id}`);
  };

  const toggleSelectTask = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    setSelectedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(task => task.id));
    }
  };

  const handleApproveSelected = async () => {
    if (selectedTasks.length === 0) return;
    
    try {
      setIsApproving(true);
      
      // Update each selected task to completed status
      for (const taskId of selectedTasks) {
        const { error } = await supabase
          .from('commission_flow_tasks')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', taskId);
          
        if (error) throw error;
      }
      
      // Refresh the list
      await fetchPendingApprovals();
      
      // Clear selection
      setSelectedTasks([]);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsApproving(false);
    }
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
          <h1 className="text-2xl font-semibold text-gray-900">Aprobación de Liquidaciones</h1>
          
          <div className="flex space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar..."
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
            No hay aprobaciones pendientes asignadas a tu usuario
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Aprobaciones Pendientes
                  </h2>
                  <p className="text-sm text-gray-500">
                    Total de registros: {tasks.length}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Comisiones</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {formatCurrency(totalAmount)} UF
                    </p>
                  </div>
                  
                  <button
                    onClick={handleApproveSelected}
                    disabled={selectedTasks.length === 0 || isApproving}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApproving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Aprobando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Aprobar Seleccionados ({selectedTasks.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedTasks.length === tasks.length && tasks.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
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
                        <td className="px-4 py-2 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(task.id)}
                            onChange={(e) => toggleSelectTask(e, task.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
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

export default BrokerPaymentsApproval;