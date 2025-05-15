import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Download, Search, Calendar, ArrowDown, ArrowUp, Building2 } from 'lucide-react';

interface BrokerReportItem {
  id: string;
  reservation_number: string;
  client_name: string;
  project_name: string;
  project_stage: string;
  apartment_number: string;
  broker_name: string;
  broker_id: string;
  commission_amount: number | null;
  reservation_date: string;
  promise_date: string | null;
  deed_date: string | null;
  has_payment_flow: boolean;
  payment_flow_started: boolean;
  is_rescinded: boolean;
}

const BrokerReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<BrokerReportItem[]>([]);
  const [brokers, setBrokers] = useState<{id: string, name: string}[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
    dateType: 'reservation_date' | 'promise_date' | 'deed_date';
  }>({
    startDate: '',
    endDate: '',
    dateType: 'reservation_date'
  });
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [sortField, setSortField] = useState<string>('reservation_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchBrokers();
  }, []);

  useEffect(() => {
    if (selectedBroker || (dateRange.startDate && dateRange.endDate)) {
      fetchReservationData();
    } else {
      setReservations([]);
    }
  }, [selectedBroker, dateRange]);

  const fetchBrokers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setBrokers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReservationData = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('reservations')
        .select(`
          id,
          reservation_number,
          reservation_date,
          promise_date,
          deed_date,
          client:clients(first_name, last_name),
          project:projects(name, stage),
          apartment_number,
          broker:brokers(id, name),
          broker_commission:broker_commissions(
            commission_amount,
            commission_flows:commission_flows(id, status, started_at)
          ),
          is_rescinded
        `)
        .eq('is_with_broker', true);

      // Apply broker filter if selected
      if (selectedBroker) {
        query = query.eq('broker_id', selectedBroker);
      }

      // Apply date range filter if provided
      if (dateRange.startDate && dateRange.endDate) {
        // Create dates with UTC to avoid timezone issues
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        
        // Format dates as ISO strings with only the date part
        const startISO = startDate.toISOString().split('T')[0];
        const endISO = endDate.toISOString().split('T')[0];
        
        query = query
          .gte(dateRange.dateType, startISO)
          .lte(dateRange.dateType, endISO);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = data.map(item => {
        // Check if there's a payment flow and if it has been started
        const hasPaymentFlow = item.broker_commission?.commission_flows && 
                              item.broker_commission.commission_flows.length > 0;
        
        const paymentFlowStarted = hasPaymentFlow && 
                                  item.broker_commission.commission_flows.some(
                                    (flow: any) => flow.status === 'in_progress' && flow.started_at !== null
                                  );
        
        return {
          id: item.id,
          reservation_number: item.reservation_number,
          client_name: `${item.client.first_name} ${item.client.last_name}`,
          project_name: item.project.name,
          project_stage: item.project.stage,
          apartment_number: item.apartment_number,
          broker_name: item.broker?.name || 'Sin broker',
          broker_id: item.broker?.id || '',
          commission_amount: item.broker_commission?.commission_amount || null,
          reservation_date: item.reservation_date,
          promise_date: item.promise_date,
          deed_date: item.deed_date,
          has_payment_flow: hasPaymentFlow,
          payment_flow_started: paymentFlowStarted,
          is_rescinded: item.is_rescinded || false
        };
      });

      setReservations(formattedData);

      // Calculate total commission
      const totalCommission = formattedData.reduce((sum, item) => sum + (item.commission_amount || 0), 0);
      setTotalCommission(totalCommission);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No especificada';
    
    try {
      // Create a date object with the UTC date string to avoid timezone issues
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return dateString;
      
      // Get day, month, year components using UTC methods to avoid timezone issues
      const day = date.getUTCDate();
      const month = date.getUTCMonth() + 1; // JavaScript months are 0-based
      const year = date.getUTCFullYear();
      
      // Format as DD/MM/YYYY
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const handleExportCSV = () => {
    if (reservations.length === 0) return;

    // Create CSV content
    const headers = [
      'N° Reserva',
      'Cliente',
      'Proyecto',
      'Etapa',
      'Departamento',
      'Broker',
      'Fecha Reserva',
      'Fecha Promesa',
      'Fecha Escritura',
      'Comisión',
      'Estado'
    ];

    const csvContent = [
      headers.join(','),
      ...reservations.map(item => [
        `"${item.reservation_number}"`,
        `"${item.client_name}"`,
        `"${item.project_name}"`,
        `"${item.project_stage}"`,
        `"${item.apartment_number}"`,
        `"${item.broker_name}"`,
        formatDate(item.reservation_date),
        formatDate(item.promise_date),
        formatDate(item.deed_date),
        item.commission_amount || 0,
        item.is_rescinded ? 'Resciliada' : (item.payment_flow_started ? 'En proceso de pago' : '')
      ].join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_brokers_${new Date().toISOString().split('T')[0]}.csv`);
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

  const sortedReservations = [...reservations].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'reservation_number':
        comparison = a.reservation_number.localeCompare(b.reservation_number);
        break;
      case 'client_name':
        comparison = a.client_name.localeCompare(b.client_name);
        break;
      case 'project_name':
        comparison = a.project_name.localeCompare(b.project_name);
        break;
      case 'broker_name':
        comparison = a.broker_name.localeCompare(b.broker_name);
        break;
      case 'reservation_date':
        comparison = new Date(a.reservation_date).getTime() - new Date(b.reservation_date).getTime();
        break;
      case 'promise_date':
        const aPromiseDate = a.promise_date ? new Date(a.promise_date).getTime() : 0;
        const bPromiseDate = b.promise_date ? new Date(b.promise_date).getTime() : 0;
        comparison = aPromiseDate - bPromiseDate;
        break;
      case 'deed_date':
        const aDeedDate = a.deed_date ? new Date(a.deed_date).getTime() : 0;
        const bDeedDate = b.deed_date ? new Date(b.deed_date).getTime() : 0;
        comparison = aDeedDate - bDeedDate;
        break;
      case 'commission_amount':
        comparison = (a.commission_amount || 0) - (b.commission_amount || 0);
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Informe de Brokers</h1>
          
          <div className="flex space-x-4">
            <button
              onClick={handleExportCSV}
              disabled={reservations.length === 0}
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

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filtros</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Broker filter */}
            <div>
              <label htmlFor="broker" className="block text-sm font-medium text-gray-700 mb-1">
                Broker
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="broker"
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos los brokers</option>
                  {brokers.map(broker => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date type selector */}
            <div>
              <label htmlFor="dateType" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Fecha
              </label>
              <select
                id="dateType"
                value={dateRange.dateType}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  dateType: e.target.value as 'reservation_date' | 'promise_date' | 'deed_date'
                }))}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="reservation_date">Fecha de Reserva</option>
                <option value="promise_date">Fecha de Promesa</option>
                <option value="deed_date">Fecha de Escritura</option>
              </select>
            </div>

            {/* Start date */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Inicio
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="startDate"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* End date */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Fin
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="endDate"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            {selectedBroker || (dateRange.startDate && dateRange.endDate) ? 
              'No hay reservas para los filtros seleccionados' : 
              'Seleccione un broker o un rango de fechas para ver las reservas'}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Resultados
                  </h2>
                  <p className="text-sm text-gray-500">
                    Total de registros: {reservations.length}
                  </p>
                </div>
                <div className="text-right">
                  <div>
                    <span className="text-sm text-gray-500">Total Comisiones:</span>
                    <span className="ml-2 text-lg font-semibold text-gray-900">
                      {formatCurrency(totalCommission)} UF
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('reservation_number')}
                      >
                        N° Reserva <SortIcon field="reservation_number" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('client_name')}
                      >
                        Cliente <SortIcon field="client_name" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('project_name')}
                      >
                        Proyecto - Depto <SortIcon field="project_name" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('broker_name')}
                      >
                        Broker <SortIcon field="broker_name" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('reservation_date')}
                      >
                        Fecha Reserva <SortIcon field="reservation_date" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('promise_date')}
                      >
                        Fecha Promesa <SortIcon field="promise_date" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('deed_date')}
                      >
                        Fecha Escritura <SortIcon field="deed_date" />
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('commission_amount')}
                      >
                        Comisión <SortIcon field="commission_amount" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedReservations.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-gray-50 ${
                          item.is_rescinded ? 'bg-red-50' : 
                          item.payment_flow_started ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.reservation_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.client_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.project_name} {item.project_stage} - {item.apartment_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.broker_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.reservation_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.promise_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.deed_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {item.commission_amount ? formatCurrency(item.commission_amount) : '-'} UF
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        Total Comisiones:
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(totalCommission)} UF
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default BrokerReport;