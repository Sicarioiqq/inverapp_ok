import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Download, Search, Calendar, ArrowDown, ArrowUp } from 'lucide-react';

interface CommissionReportItem {
  id: string;
  reservation_number: string;
  client_name: string;
  project_name: string;
  project_stage: string;
  apartment_number: string;
  broker_name: string;
  commission_amount: number;
  total_payment: number;
  subsidy_payment: number;
  net_amount: number;
  commission_payment_month: string;
  reservation_id: string;
  reservation_flow_id?: string;
}

const CommissionReport: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<CommissionReportItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalNetAmount, setTotalNetAmount] = useState<number>(0);
  const [sortField, setSortField] = useState<string>('reservation_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchCommissionData(selectedMonth);
    } else {
      setCommissions([]);
    }
  }, [selectedMonth]);

  const fetchAvailableMonths = async () => {
    try {
      setLoading(true);
      
      // Consulta directa para obtener todos los meses únicos
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: `
          SELECT DISTINCT 
            EXTRACT(YEAR FROM commission_payment_month)::text || '-' || 
            LPAD(EXTRACT(MONTH FROM commission_payment_month)::text, 2, '0') as month_year
          FROM reservations 
          WHERE commission_payment_month IS NOT NULL 
          ORDER BY month_year DESC
        `
      });

      if (error) throw error;

      console.log('Meses disponibles:', data);
      
      // Extraer los meses únicos
      const uniqueMonths = data.map((item: any) => item.month_year);
      setAvailableMonths(uniqueMonths);

      // Establecer el mes más reciente como predeterminado si está disponible
      if (uniqueMonths.length > 0) {
        setSelectedMonth(uniqueMonths[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissionData = async (month: string) => {
    try {
      setLoading(true);
      
      // Crear fechas para el primer y último día del mes
      const [year, monthNum] = month.split('-');
      
      // Crear fechas para el primer y último día del mes
      const startDate = `${year}-${monthNum}-01`;
      
      // Calcular el último día del mes (considerando meses con diferentes días)
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum}-${lastDay}`;
      
      console.log('Consultando comisiones para el período:', {
        startDate,
        endDate,
        month
      });
      
      // Usar una consulta SQL directa para evitar problemas de zona horaria
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: `
          SELECT 
            r.id as reservation_id,
            r.reservation_number,
            c.first_name || ' ' || c.last_name as client_name,
            p.name as project_name,
            p.stage as project_stage,
            r.apartment_number,
            b.name as broker_name,
            COALESCE(bc.commission_amount, 0) as commission_amount,
            r.total_payment,
            r.subsidy_payment,
            r.total_payment - r.subsidy_payment - COALESCE(bc.commission_amount, 0) as net_amount,
            r.commission_payment_month,
            (SELECT rf.id FROM reservation_flows rf WHERE rf.reservation_id = r.id LIMIT 1) as reservation_flow_id
          FROM reservations r
          JOIN clients c ON r.client_id = c.id
          JOIN projects p ON r.project_id = p.id
          LEFT JOIN brokers b ON r.broker_id = b.id
          LEFT JOIN broker_commissions bc ON r.id = bc.reservation_id
          WHERE r.commission_payment_month >= '${startDate}'::date
          AND r.commission_payment_month <= '${endDate}'::date
        `
      });

      if (error) throw error;

      console.log(`Encontradas ${data?.length || 0} reservas para el mes ${month}`);
      console.log('Datos obtenidos:', data);
      
      setCommissions(data || []);

      // Calcular totales
      const totalCommission = data.reduce((sum: number, item: any) => sum + parseFloat(item.commission_amount || 0), 0);
      const totalNet = data.reduce((sum: number, item: any) => sum + parseFloat(item.net_amount || 0), 0);
      
      setTotalAmount(totalCommission);
      setTotalNetAmount(totalNet);
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

  const formatMonthYear = (monthStr: string) => {
    if (!monthStr) return '';
    try {
      // Si es formato YYYY-MM, extraer año y mes
      const [year, month] = monthStr.split('-');
      
      // Convertir número de mes a nombre en español
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const monthIndex = parseInt(month) - 1; // Convertir a índice base 0
      return `${monthNames[monthIndex]} de ${year}`;
    } catch (e) {
      console.error('Error al formatear mes y año:', e);
      return monthStr;
    }
  };

  const handleExportCSV = () => {
    if (commissions.length === 0) return;

    // Create CSV content
    const headers = [
      'N° Reserva',
      'Cliente',
      'Proyecto',
      'Etapa',
      'Departamento',
      'Broker',
      'Comisión',
      'Monto Neto'
    ];

    const csvContent = [
      headers.join(','),
      ...commissions.map(item => [
        `"${item.reservation_number}"`,
        `"${item.client_name}"`,
        `"${item.project_name}"`,
        `"${item.project_stage}"`,
        `"${item.apartment_number}"`,
        `"${item.broker_name}"`,
        item.commission_amount,
        item.net_amount
      ].join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_comisiones_${selectedMonth}.csv`);
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

  const handleRowClick = (item: CommissionReportItem) => {
    if (item.reservation_flow_id) {
      navigate(`/flujo-reservas/${item.reservation_flow_id}`);
    }
  };

  const sortedCommissions = [...commissions].sort((a, b) => {
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
      case 'apartment_number':
        comparison = a.apartment_number.localeCompare(b.apartment_number);
        break;
      case 'broker_name':
        comparison = a.broker_name.localeCompare(b.broker_name);
        break;
      case 'commission_amount':
        comparison = a.commission_amount - b.commission_amount;
        break;
      case 'net_amount':
        comparison = a.net_amount - b.net_amount;
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

  const toggleMonthDropdown = () => {
    setShowMonthDropdown(!showMonthDropdown);
  };

  const selectMonth = (month: string) => {
    setSelectedMonth(month);
    setShowMonthDropdown(false);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Informe de Comisiones</h1>
          
          <div className="flex space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <button
                onClick={toggleMonthDropdown}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white w-48 text-left"
              >
                {selectedMonth ? formatMonthYear(selectedMonth) : 'Seleccionar mes'}
              </button>
              
              {showMonthDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                  {availableMonths.map(month => (
                    <button
                      key={month}
                      onClick={() => selectMonth(month)}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        selectedMonth === month ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {formatMonthYear(month)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleExportCSV}
              disabled={commissions.length === 0}
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
        ) : commissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            {selectedMonth ? 'No hay comisiones para el mes seleccionado' : 'Seleccione un mes para ver las comisiones'}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Comisiones para {formatMonthYear(selectedMonth)}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Total de registros: {commissions.length}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Comisiones</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(totalAmount)} UF
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Neto</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(totalNetAmount)} UF
                    </p>
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
                        Proyecto <SortIcon field="project_name" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('apartment_number')}
                      >
                        Depto. <SortIcon field="apartment_number" />
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('broker_name')}
                      >
                        Broker <SortIcon field="broker_name" />
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('commission_amount')}
                      >
                        Comisión <SortIcon field="commission_amount" />
                      </th>
                      <th 
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('net_amount')}
                      >
                        Monto Neto <SortIcon field="net_amount" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedCommissions.map((item) => (
                      <tr 
                        key={`${item.id}`} 
                        className={`hover:bg-gray-50 ${item.reservation_flow_id ? 'cursor-pointer' : ''}`}
                        onClick={() => item.reservation_flow_id && handleRowClick(item)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.reservation_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.client_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.project_name} {item.project_stage}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.apartment_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.broker_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(item.commission_amount)} UF
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(item.net_amount)} UF
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        Total:
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(totalAmount)} UF
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(totalNetAmount)} UF
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

export default CommissionReport;