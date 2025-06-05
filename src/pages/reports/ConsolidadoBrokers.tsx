import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Download, Search, Calendar, ArrowDown, ArrowUp, Building2, Loader2, Ban, AlertCircle, ShieldCheck } from 'lucide-react';
import { usePopup } from '../../contexts/PopupContext';

interface Broker {
  id: string;
  name: string;
  business_name: string;
}

interface ConsolidadoBrokersItem {
  id: string;
  reservation_number: string;
  project_name: string;
  project_stage: string;
  apartment_number: string;
  purchase_order: string | null;
  invoice_1: string | null;
  payment_1_date: string | null;
  invoice_2: string | null;
  payment_2_date: string | null;
  commission_amount: number;
  first_payment_percentage: number;
  first_payment_amount: number | null;
  second_payment_amount: number | null;
  penalty: number | null;
  at_risk: boolean;
  at_risk_reason: string | null;
  reservation_id: string;
  commission_flow_id: string | null;
  is_rescinded: boolean;
  has_payment_flow: boolean;
  is_payment_in_progress: boolean;
  neteada: boolean;
  neteador: boolean;
}

interface AtRiskPopupProps {
  reservationId: string;
  brokerId: string;
  isAtRisk: boolean;
  reason: string | null;
  onSave: () => void;
  onClose: () => void;
}

type NeteoCastigoModalProps = {
  saldoAFavor: number;
  castigadas: ConsolidadoBrokersItem[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const ConsolidadoBrokers: React.FC = () => {
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [consolidatedData, setConsolidatedData] = useState<ConsolidadoBrokersItem[]>([]);
  const [sortField, setSortField] = useState<string>('reservation_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [totals, setTotals] = useState({
    totalCommission: 0,
    totalPaid: 0,
    totalPending: 0,
    totalAtRisk: 0,
    totalInProgress: 0
  });
  const [showNeteoModal, setShowNeteoModal] = useState(false);
  const [absorbedUnit, setAbsorbedUnit] = useState<ConsolidadoBrokersItem | null>(null);
  const [selectedCastigadas, setSelectedCastigadas] = useState<string[]>([]);
  const [neteoDetalles, setNeteoDetalles] = useState<any[]>([]);

  useEffect(() => {
    fetchBrokers();
  }, []);

  useEffect(() => {
    if (selectedBroker) {
      fetchConsolidatedData(selectedBroker);
    } else {
      setConsolidatedData([]);
      setTotals({
        totalCommission: 0,
        totalPaid: 0,
        totalPending: 0,
        totalAtRisk: 0,
        totalInProgress: 0
      });
    }
  }, [selectedBroker]);

  const fetchBrokers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brokers')
        .select('id, name, business_name')
        .order('name');

      if (error) throw error;
      setBrokers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsolidatedData = async (brokerId: string) => {
    try {
      setLoading(true);
      
      // Obtener todas las comisiones para el broker seleccionado
      const { data, error } = await supabase
        .from('broker_commissions')
        .select(`
          id,
          commission_amount,
          first_payment_percentage,
          purchase_order,
          invoice_1,
          invoice_1_date,
          payment_1_date,
          invoice_2,
          invoice_2_date,
          payment_2_date,
          penalty_amount,
          at_risk,
          at_risk_reason,
          reservation:reservations!inner(
            id,
            reservation_number,
            apartment_number,
            project:projects!inner(name, stage),
            is_rescinded
          ),
          broker:brokers!inner(id, name),
          es_neteada,
          es_neteador
        `)
        .eq('broker_id', brokerId);

      if (error) throw error;

      // Get commission flows for each commission
      const commissionFlowsData = await Promise.all(
        data.map(async (commission) => {
          const { data: flows } = await supabase
            .from('commission_flows')
            .select('id, is_second_payment')
            .eq('broker_commission_id', commission.id)
            .order('is_second_payment', { ascending: true });
          
          return {
            commission_id: commission.id,
            reservation_id: commission.reservation.id,
            flows: flows || []
          };
        })
      );

      // Formatear los datos para la tabla
      const formattedData = data.map((item: any) => {
        // Calcular montos de pagos
        const firstPaymentAmount = item.payment_1_date 
          ? (item.commission_amount * (item.first_payment_percentage / 100)) 
          : null;
          
        // Calcular el segundo pago solo si hay fecha de pago 2
        // Si hay fecha de pago 2, el segundo pago es la diferencia entre el monto total de comisión y el primer pago
        const secondPaymentAmount = item.payment_2_date
          ? (item.commission_amount - (firstPaymentAmount || 0))
          : null;

        // Find commission flow ID for this commission
        const commissionFlowInfo = commissionFlowsData.find(cf => cf.commission_id === item.id);
        const commissionFlowId = commissionFlowInfo?.flows?.[0]?.id || null;

        return {
          id: item.id,
          reservation_id: item.reservation?.id,
          reservation_number: item.reservation?.reservation_number,
          project_name: item.reservation?.project?.name,
          project_stage: item.reservation?.project?.stage,
          apartment_number: item.reservation?.apartment_number,
          purchase_order: item.purchase_order,
          invoice_1: item.invoice_1,
          payment_1_date: item.payment_1_date,
          invoice_2: item.invoice_2,
          payment_2_date: item.payment_2_date,
          commission_amount: item.commission_amount,
          first_payment_percentage: item.first_payment_percentage,
          first_payment_amount: firstPaymentAmount,
          second_payment_amount: secondPaymentAmount,
          penalty: item.penalty_amount,
          at_risk: item.at_risk || false,
          at_risk_reason: item.at_risk_reason,
          commission_flow_id: commissionFlowId,
          is_rescinded: item.reservation?.is_rescinded,
          has_payment_flow: commissionFlowId !== null,
          is_payment_in_progress: commissionFlowId !== null && !item.payment_1_date && !item.payment_2_date,
          neteada: item.es_neteada || false,
          neteador: item.es_neteador || false
        };
      });

      setConsolidatedData(formattedData);

      // Calcular totales considerando el estado en riesgo
      const calculatedTotals = calculateTotals();
      setTotals(calculatedTotals);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Santiago'
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const handleExportCSV = () => {
    if (consolidatedData.length === 0) return;

    // Create CSV content
    const headers = [
      'N° Reserva',
      'Proyecto',
      'Departamento',
      'Estado',
      'En Riesgo',
      'Motivo Riesgo',
      'N° OC',
      'N° Factura 1',
      'Fecha de Pago Factura 1',
      'Comisión',
      'Pago 1',
      'N° Factura 2',
      'Fecha de Pago Factura 2',
      'Pago 2',
      'Castigo'
    ];

    const csvContent = [
      headers.join(','),
      ...consolidatedData.map(item => [
        `"${item.reservation_number}"`,
        `"${item.project_name} ${item.project_stage}"`,
        `"${item.apartment_number}"`,
        `"${item.is_rescinded ? 'Resciliada' : ''}"`,
        `"${item.at_risk ? 'En Riesgo' : ''}"`,
        `"${item.at_risk_reason || ''}"`,
        `"${item.purchase_order || ''}"`,
        `"${item.invoice_1 || ''}"`,
        item.payment_1_date ? formatDate(item.payment_1_date) : '',
        item.commission_amount,
        item.first_payment_amount || '',
        `"${item.invoice_2 || ''}"`,
        item.payment_2_date ? formatDate(item.payment_2_date) : '',
        item.second_payment_amount || '',
        item.penalty || ''
      ].join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consolidado_broker_${new Date().toISOString().split('T')[0]}.csv`);
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

  const handleRowClick = (item: ConsolidadoBrokersItem) => {
    if (item.commission_flow_id) {
      navigate(`/pagos/flujo/${item.commission_flow_id}`);
    } else {
      // If no commission flow exists yet, navigate to the payment edit page
      navigate(`/pagos/${item.reservation_id}`);
    }
  };

  const handleToggleAtRisk = (item: ConsolidadoBrokersItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    showPopup(
      <AtRiskPopup
        reservationId={item.reservation_id}
        brokerId={selectedBroker}
        isAtRisk={item.at_risk}
        reason={item.at_risk_reason}
        onSave={() => fetchConsolidatedData(selectedBroker)}
        onClose={() => {}}
      />,
      {
        title: item.at_risk ? 'Editar Estado En Riesgo' : 'Marcar Como En Riesgo',
        size: 'md'
      }
    );
  };

  const handleConfirmNeteo = async () => {
    if (!absorbedUnit) return;
    setLoading(true);
    try {
      // Suma de castigos seleccionados
      const castigadasSeleccionadas = castigadasDisponibles.filter(u => selectedCastigadas.includes(u.id));
      const sumaCastigos = castigadasSeleccionadas.reduce((sum, u) => sum + (u.penalty || 0), 0);

      // 1. Insertar neteo
      const { data: neteo, error: neteoError } = await supabase
        .from('neteos')
        .insert({
          unidad_absorbente_id: absorbedUnit.id,
          monto_total_neteado: sumaCastigos
        })
        .select()
        .single();
      if (neteoError) throw neteoError;

      // 2. Insertar detalles de neteo
      const detalles = castigadasSeleccionadas.map(u => ({
        neteo_id: neteo.id,
        unidad_castigada_id: u.id,
        monto_castigo: u.penalty || 0
      }));
      const { error: detallesError } = await supabase
        .from('neteo_detalles')
        .insert(detalles);
      if (detallesError) throw detallesError;

      // 3. Actualizar flags en broker_commissions
      // Absorbente
      const { error: updateAbsError } = await supabase
        .from('broker_commissions')
        .update({
          commission_amount: absorbedUnit.commission_amount - sumaCastigos,
          es_neteador: true
        })
        .eq('id', absorbedUnit.id);
      if (updateAbsError) throw updateAbsError;
      // Castigadas
      const { error: updateCastigadasError } = await supabase
        .from('broker_commissions')
        .update({ es_neteada: true })
        .in('id', castigadasSeleccionadas.map(u => u.id));
      if (updateCastigadasError) throw updateCastigadasError;

      // 4. Refrescar datos
      await fetchConsolidatedData(selectedBroker);
      setShowNeteoModal(false);
      setSelectedCastigadas([]);
      setAbsorbedUnit(null);
      setLoading(false);
      showPopup(
        <div className="p-4 text-green-700">¡Neteo realizado y guardado correctamente!</div>,
        { title: 'Éxito', size: 'sm', duration: 2500 }
      );
    } catch (err: any) {
      setLoading(false);
      showPopup(
        <div className="p-4 text-red-700">Error al guardar el neteo: {err.message}</div>,
        { title: 'Error', size: 'sm', duration: 4000 }
      );
    }
  };

  const sortedData = [...consolidatedData].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'reservation_number':
        comparison = a.reservation_number.localeCompare(b.reservation_number);
        break;
      case 'project_name':
        comparison = (a.project_name + a.project_stage).localeCompare(b.project_name + b.project_stage);
        break;
      case 'apartment_number':
        comparison = a.apartment_number.localeCompare(b.apartment_number);
        break;
      case 'purchase_order':
        comparison = (a.purchase_order || '').localeCompare(b.purchase_order || '');
        break;
      case 'invoice_1':
        comparison = (a.invoice_1 || '').localeCompare(b.invoice_1 || '');
        break;
      case 'payment_1_date':
        const dateA = a.payment_1_date ? new Date(a.payment_1_date).getTime() : 0;
        const dateB = b.payment_1_date ? new Date(b.payment_1_date).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'commission_amount':
        comparison = a.commission_amount - b.commission_amount;
        break;
      case 'first_payment_amount':
        comparison = (a.first_payment_amount || 0) - (b.first_payment_amount || 0);
        break;
      case 'invoice_2':
        comparison = (a.invoice_2 || '').localeCompare(b.invoice_2 || '');
        break;
      case 'payment_2_date':
        const date2A = a.payment_2_date ? new Date(a.payment_2_date).getTime() : 0;
        const date2B = b.payment_2_date ? new Date(b.payment_2_date).getTime() : 0;
        comparison = date2A - date2B;
        break;
      case 'second_payment_amount':
        comparison = (a.second_payment_amount || 0) - (b.second_payment_amount || 0);
        break;
      case 'at_risk':
        comparison = (a.at_risk ? 1 : 0) - (b.at_risk ? 1 : 0);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-3 w-3 inline-block ml-1" aria-label="Orden ascendente" /> : 
      <ArrowDown className="h-3 w-3 inline-block ml-1" aria-label="Orden descendente" />;
  };

  // Calcular totales considerando el estado en riesgo
  const calculateTotals = () => {
    // Total de comisiones (excluyendo resciliadas y en riesgo)
    const totalCommission = consolidatedData.reduce((sum, item) => {
      // Si está resciliada o en riesgo, no considerar para el total de comisiones
      if (item.is_rescinded || item.at_risk) {
        return sum;
      }
      return sum + item.commission_amount;
    }, 0);
    
    // Total pagado (incluyendo resciliadas)
    const totalPaid = consolidatedData.reduce((sum, item) => {
      let paidAmount = 0;
      if (item.first_payment_amount) paidAmount += item.first_payment_amount;
      if (item.second_payment_amount) paidAmount += item.second_payment_amount;
      return sum + paidAmount;
    }, 0);
    
    // Total en riesgo: suma pagos de registros en riesgo y solo los castigos NO neteados
    const totalAtRisk = consolidatedData.reduce((sum, item) => {
      let subtotal = 0;
      if (!item.is_rescinded && item.at_risk) {
        if (item.first_payment_amount) subtotal += item.first_payment_amount;
        if (item.second_payment_amount) subtotal += item.second_payment_amount;
      }
      // Sumar castigo solo si NO está neteada
      if (item.penalty && !item.neteada) subtotal += item.penalty;
      return sum + subtotal;
    }, 0);

    // Total en proceso de pago (solo el porcentaje correspondiente a la etapa en proceso, excluyendo resciliadas y en riesgo)
    const totalInProgress = consolidatedData.reduce((sum, item) => {
      if (!item.is_rescinded && !item.at_risk && item.has_payment_flow) {
        let inProgressAmount = 0;
        // Primer pago en proceso
        if (item.invoice_1 && !item.payment_1_date) {
          inProgressAmount += item.commission_amount * (item.first_payment_percentage / 100);
        }
        // Segundo pago en proceso
        if (item.invoice_2 && !item.payment_2_date) {
          inProgressAmount += item.commission_amount * (1 - item.first_payment_percentage / 100);
        }
        return sum + inProgressAmount;
      }
      return sum;
    }, 0);
    
    // Total pendiente (comisión total menos pagado, excluyendo resciliadas)
    const totalPending = totalCommission - totalPaid;

    return {
      totalCommission,
      totalPaid,
      totalPending,
      totalAtRisk,
      totalInProgress
    };
  };

  // Recalcular totales para asegurar que estén actualizados
  const calculatedTotals = calculateTotals();

  // Filtra unidades castigadas no neteadas
  const castigadasDisponibles = consolidatedData.filter(item => item.penalty && item.penalty > 0 && !item.neteada);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Consolidado Brokers</h1>
          
          <div className="flex space-x-4">
            <button
              onClick={handleExportCSV}
              disabled={consolidatedData.length === 0}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <option value="">Seleccione un broker</option>
                  {brokers.map(broker => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name} - {broker.business_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : consolidatedData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            {selectedBroker ? 'No hay comisiones para el broker seleccionado' : 'Seleccione un broker para ver sus comisiones'}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Resultados
                  </h2>
                  <p className="text-sm text-gray-500">
                    Total de registros: {consolidatedData.length}
                  </p>
                </div>
                <div className="mt-4 md:mt-0 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Comisiones</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(calculatedTotals.totalCommission)} UF
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Pagado</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(calculatedTotals.totalPaid)} UF
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total En Riesgo</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {formatCurrency(calculatedTotals.totalAtRisk)} UF
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total En Proceso</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {formatCurrency(calculatedTotals.totalInProgress)} UF
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Pendiente</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {formatCurrency(calculatedTotals.totalPending - calculatedTotals.totalInProgress)} UF
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('reservation_number')}
                      >
                        N° Reserva <SortIcon field="reservation_number" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('project_name')}
                      >
                        Proyecto <SortIcon field="project_name" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('apartment_number')}
                      >
                        Depto. <SortIcon field="apartment_number" />
                      </th>
                      <th 
                        className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('at_risk')}
                      >
                        En Riesgo <SortIcon field="at_risk" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('purchase_order')}
                      >
                        N° OC <SortIcon field="purchase_order" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('invoice_1')}
                      >
                        N° Factura 1 <SortIcon field="invoice_1" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('payment_1_date')}
                      >
                        Fecha Pago 1 <SortIcon field="payment_1_date" />
                      </th>
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('commission_amount')}
                      >
                        Comisión <SortIcon field="commission_amount" />
                      </th>
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('first_payment_amount')}
                      >
                        Pago 1 <SortIcon field="first_payment_amount" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('invoice_2')}
                      >
                        N° Factura 2 <SortIcon field="invoice_2" />
                      </th>
                      <th 
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('payment_2_date')}
                      >
                        Fecha Pago 2 <SortIcon field="payment_2_date" />
                      </th>
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('second_payment_amount')}
                      >
                        Pago 2 <SortIcon field="second_payment_amount" />
                      </th>
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Castigo
                      </th>
                      <th 
                        className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedData.map((item) => (
                      <tr 
                        key={item.id}
                        onClick={() => handleRowClick(item)}
                        className={`cursor-pointer hover:bg-gray-50 ${(
                          !item.is_rescinded && item.has_payment_flow && 
                          (
                            (item.invoice_1 && !item.payment_1_date) || 
                            (item.invoice_2 && !item.payment_2_date)
                          )
                        ) ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                          <div className="flex items-center">
                            {item.reservation_number}
                            {item.is_rescinded && (
                              <Ban className="h-4 w-4 ml-1 text-red-500" />
                            )}
                            {!item.is_rescinded && item.at_risk && (
                              <AlertCircle className="h-4 w-4 ml-1 text-amber-500" />
                            )}
                            {item.neteador && (
                              <ShieldCheck className="h-4 w-4 ml-1 text-blue-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {item.project_name} {item.project_stage}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {item.apartment_number}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-center">
                          {item.at_risk ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              En Riesgo
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {item.purchase_order || '-'}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {item.invoice_1 || '-'}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(item.payment_1_date)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right">
                          {item.is_rescinded || item.at_risk ? (
                            <span className={item.is_rescinded ? "text-red-600 line-through" : "text-amber-600 line-through"}>
                              {formatCurrency(item.commission_amount)} UF
                            </span>
                          ) : (
                            <span className="text-gray-900">
                              {formatCurrency(item.commission_amount)} UF
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-right">
                          {item.first_payment_amount ? (
                            <span className={item.at_risk ? "text-amber-600" : "text-green-600"}>
                              {formatCurrency(item.first_payment_amount)} UF
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {item.invoice_2 || '-'}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(item.payment_2_date)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-right">
                          {item.second_payment_amount ? (
                            <span className={item.at_risk ? "text-amber-600" : "text-green-600"}>
                              {formatCurrency(item.second_payment_amount)} UF
                            </span>
                          ) : item.at_risk && !item.payment_2_date && item.first_payment_percentage < 100 ? (
                            <span className="text-amber-600 line-through">
                              {formatCurrency(item.commission_amount * (1 - item.first_payment_percentage/100))} UF
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 text-right">
                          {item.penalty ? (
                            item.neteada ? (
                              <span className="text-gray-400 line-through">{formatCurrency(item.penalty)} UF</span>
                            ) : (
                              <span className="text-red-600">{formatCurrency(item.penalty)} UF</span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleToggleAtRisk(item, e)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              item.at_risk 
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                            disabled={item.is_rescinded}
                            title={item.is_rescinded ? "No se puede marcar en riesgo una unidad resciliada" : ""}
                          >
                            {item.at_risk ? 'Editar Riesgo' : 'Marcar En Riesgo'}
                          </button>
                          {/* Botón Neteo Castigo */}
                          {item.commission_amount > 0 && !item.at_risk && !item.is_rescinded && !item.neteador && castigadasDisponibles.length > 0 && (
                            <button
                              onClick={(e) => { setAbsorbedUnit(item); setShowNeteoModal(true); }}
                              className="ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200"
                              title="Neteo Castigo"
                            >
                              Neteo Castigo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={7} className="px-2 py-2 text-right text-xs font-medium text-gray-900">
                        Totales:
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-gray-900">
                        {formatCurrency(calculatedTotals.totalCommission)} UF
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-green-600">
                        {formatCurrency(calculatedTotals.totalPaid)} UF
                      </td>
                      <td colSpan={3} className="px-2 py-2 text-right text-xs font-medium text-gray-900">
                        En Riesgo:
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-amber-600">
                        {formatCurrency(calculatedTotals.totalAtRisk)} UF
                      </td>
                      <td colSpan={2} className="px-2 py-2 text-right text-xs font-bold text-orange-600">
                        Pendiente: {formatCurrency(calculatedTotals.totalPending - calculatedTotals.totalInProgress)} UF
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Renderiza el modal de neteo si corresponde */}
      {showNeteoModal && absorbedUnit && (
        <NeteoCastigoModal
          saldoAFavor={absorbedUnit.commission_amount}
          castigadas={castigadasDisponibles}
          selected={selectedCastigadas}
          onSelect={setSelectedCastigadas}
          onClose={() => { setShowNeteoModal(false); setAbsorbedUnit(null); setSelectedCastigadas([]); }}
          onConfirm={handleConfirmNeteo}
        />
      )}
    </Layout>
  );
};

// Componente para el popup de marcar/editar en riesgo
const AtRiskPopup: React.FC<AtRiskPopupProps> = ({
  reservationId,
  brokerId,
  isAtRisk,
  reason,
  onSave,
  onClose
}) => {
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atRisk, setAtRisk] = useState(isAtRisk);
  const [atRiskReason, setAtRiskReason] = useState(reason || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      // Obtener el ID de la comisión para esta reserva y broker
      const { data: commissionData, error: commissionError } = await supabase
        .from('broker_commissions')
        .select('id')
        .eq('reservation_id', reservationId)
        .eq('broker_id', brokerId)
        .single();

      if (commissionError) throw commissionError;

      // Actualizar el estado de riesgo
      const { error: updateError } = await supabase
        .from('broker_commissions')
        .update({
          at_risk: atRisk,
          at_risk_reason: atRisk ? atRiskReason : null
        })
        .eq('id', commissionData.id);

      if (updateError) throw updateError;

      hidePopup();
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="at_risk"
            checked={atRisk}
            onChange={(e) => setAtRisk(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="at_risk" className="ml-2 block text-sm text-gray-700">
            Marcar como En Riesgo
          </label>
        </div>

        {atRisk && (
          <div>
            <label htmlFor="at_risk_reason" className="block text-sm font-medium text-gray-700">
              Motivo del Riesgo *
            </label>
            <textarea
              id="at_risk_reason"
              name="at_risk_reason"
              rows={4}
              required={atRisk}
              value={atRiskReason}
              onChange={(e) => setAtRiskReason(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Describa el motivo por el que esta operación está en riesgo..."
            />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => {
            hidePopup();
            onClose();
          }}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Guardando...
            </>
          ) : (
            'Guardar'
          )}
        </button>
      </div>
    </form>
  );
};

// Componente Modal para Neteo de Castigo
const NeteoCastigoModal: React.FC<NeteoCastigoModalProps> = ({ saldoAFavor, castigadas, selected, onSelect, onClose, onConfirm }) => {
  const sumaCastigos = castigadas.filter((u) => selected.includes(u.id)).reduce((sum, u) => sum + (u.penalty || 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold mb-4 text-blue-700">Neteo Castigo</h2>
        <div className="mb-4">
          <div className="mb-2 text-sm">Saldo a favor: <span className="font-bold text-green-700">{saldoAFavor.toLocaleString('es-CL', {minimumFractionDigits:2})} UF</span></div>
          <div className="mb-2 text-sm">Castigos seleccionados: <span className="font-bold text-red-700">{sumaCastigos.toLocaleString('es-CL', {minimumFractionDigits:2})} UF</span></div>
        </div>
        <div className="max-h-60 overflow-y-auto border rounded mb-4">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th></th>
                <th>N° Reserva</th>
                <th>Proyecto</th>
                <th>Depto</th>
                <th>Monto Castigo</th>
              </tr>
            </thead>
            <tbody>
              {castigadas.map((u) => (
                <tr key={u.id}>
                  <td><input type="checkbox" checked={selected.includes(u.id)} onChange={e => {
                    if (e.target.checked) onSelect([...selected, u.id]);
                    else onSelect(selected.filter((id) => id !== u.id));
                  }} disabled={sumaCastigos + (u.penalty || 0) > saldoAFavor && !selected.includes(u.id)} /></td>
                  <td>{u.reservation_number}</td>
                  <td>{u.project_name}</td>
                  <td>{u.apartment_number}</td>
                  <td className="text-red-700">{u.penalty?.toLocaleString('es-CL', {minimumFractionDigits:2})} UF</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold">Cancelar</button>
          <button onClick={() => onConfirm()} disabled={sumaCastigos === 0 || sumaCastigos > saldoAFavor} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:opacity-50">Confirmar Neteo</button>
        </div>
      </div>
    </div>
  );
};

export default ConsolidadoBrokers;