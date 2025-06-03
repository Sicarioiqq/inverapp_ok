import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Search, Loader2, Clock, CheckCircle2, AlertCircle, UserCircle, XCircle } from 'lucide-react';
import { Dialog } from '@headlessui/react';

interface ReservationFlow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  reservation: {
    reservation_number: string;
    client: { first_name: string; last_name: string; };
    project: { name: string; stage: string; };
    apartment_number: string;
    is_rescinded: boolean;
    reservation_date: string;
    pre_aprobacion_estado?: boolean;
    cedula_identidad_estado?: boolean;
    certificado_afp_estado?: boolean;
    liquidaciones_sueldo_estado?: boolean;
    dicom_cmf_estado?: boolean;
    pep_estado?: boolean;
    dof_estado?: boolean;
    formulario_onu_estado?: boolean;
  };
  current_stage: {
    name: string;
  } | null;
  assigned_users: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }[];
}

// Tipo auxiliar para datos crudos desde Supabase
interface RawReservationFlow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  reservation: any | any[];
  current_stage: any | any[];
  assigned_users: any[];
}

const ReservationFlowList = () => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<ReservationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ReservationFlow | null>(null);
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
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [filteredFlows, setFilteredFlows] = useState<ReservationFlow[]>([]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch();
      } else {
        fetchFlows();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservation_flows')
        .select(`
          id,
          status,
          started_at,
          completed_at,
          current_stage:sale_flow_stages(name),
          reservation:reservations!inner(
            id,
            reservation_number,
            apartment_number,
            is_rescinded,
            client:clients(first_name, last_name),
            project:projects(name, stage),
            pre_aprobacion_estado,
            cedula_identidad_estado,
            certificado_afp_estado,
            liquidaciones_sueldo_estado,
            dicom_cmf_estado,
            pep_estado,
            dof_estado,
            formulario_onu_estado,
            reservation_date
          ),
          assigned_users:task_assignments!task_assignments_reservation_flow_id_fkey(
            user:profiles!task_assignments_user_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .order('reservation_date', { ascending: false, foreignTable: 'reservations' });

      if (error) throw error;

      // Procesar los datos para que reservation, client y project sean objetos, no arrays
      const formattedFlows: ReservationFlow[] = (data as RawReservationFlow[] || []).map(flow => {
        let reservation = Array.isArray(flow.reservation) ? flow.reservation[0] : flow.reservation;
        if (reservation) {
          reservation = {
            ...reservation,
            client: Array.isArray(reservation.client) ? reservation.client[0] : reservation.client,
            project: Array.isArray(reservation.project) ? reservation.project[0] : reservation.project,
          };
        }
        let current_stage = flow.current_stage;
        if (Array.isArray(current_stage)) {
          current_stage = current_stage[0] || null;
        }
        return {
          ...flow,
          reservation,
          current_stage,
          assigned_users: (flow.assigned_users || []).map(assignment => assignment.user)
        };
      });
      setFlows(formattedFlows.sort((a, b) => {
        const dateA = new Date(a.reservation.reservation_date).getTime();
        const dateB = new Date(b.reservation.reservation_date).getTime();
        return dateB - dateA;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);

      if (clientsError) throw clientsError;

      const clientIds = clientsData?.map(client => client.id) || [];

      if (clientIds.length === 0) {
        setFlows([]);
        return;
      }

      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id')
        .in('client_id', clientIds);

      if (reservationsError) throw reservationsError;

      const reservationIds = reservationsData?.map(reservation => reservation.id) || [];

      if (reservationIds.length === 0) {
        setFlows([]);
        return;
      }

      const { data: flowsData, error: flowsError } = await supabase
        .from('reservation_flows')
        .select(`
          id,
          status,
          started_at,
          completed_at,
          current_stage:sale_flow_stages(name),
          reservation:reservations!inner(
            id,
            reservation_number,
            apartment_number,
            is_rescinded,
            client:clients(first_name, last_name),
            project:projects(name, stage),
            pre_aprobacion_estado,
            cedula_identidad_estado,
            certificado_afp_estado,
            liquidaciones_sueldo_estado,
            dicom_cmf_estado,
            pep_estado,
            dof_estado,
            formulario_onu_estado,
            reservation_date
          ),
          assigned_users:task_assignments!task_assignments_reservation_flow_id_fkey(
            user:profiles!task_assignments_user_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .in('reservation.id', reservationIds)
        .order('reservation_date', { ascending: false, foreignTable: 'reservations' });

      if (flowsError) throw flowsError;

      const formattedFlows: ReservationFlow[] = (flowsData as RawReservationFlow[] || []).map(flow => {
        let reservation = Array.isArray(flow.reservation) ? flow.reservation[0] : flow.reservation;
        if (reservation) {
          reservation = {
            ...reservation,
            client: Array.isArray(reservation.client) ? reservation.client[0] : reservation.client,
            project: Array.isArray(reservation.project) ? reservation.project[0] : reservation.project,
          };
        }
        let current_stage = flow.current_stage;
        if (Array.isArray(current_stage)) {
          current_stage = current_stage[0] || null;
        }
        return {
          ...flow,
          reservation,
          current_stage,
          assigned_users: (flow.assigned_users || []).map(assignment => assignment.user)
        };
      });

      setFlows(formattedFlows.sort((a, b) => {
        const dateA = new Date(a.reservation.reservation_date).getTime();
        const dateB = new Date(b.reservation.reservation_date).getTime();
        return dateB - dateA;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Proceso';
      case 'cancelled':
        return 'Cancelado';
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
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRowClick = (flowId: string) => {
    navigate(`/flujo-reservas/${flowId}`);
  };

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

  // Al abrir el modal, inicializo los estados de documentos según la reserva seleccionada
  useEffect(() => {
    if (showDocumentModal && selectedFlow && selectedFlow.reservation) {
      setDocumentos({
        pre_aprobacion: !!selectedFlow.reservation.pre_aprobacion_estado,
        cedula_identidad: !!selectedFlow.reservation.cedula_identidad_estado,
        certificado_afp: !!selectedFlow.reservation.certificado_afp_estado,
        liquidaciones_sueldo: !!selectedFlow.reservation.liquidaciones_sueldo_estado,
        dicom_cmf: !!selectedFlow.reservation.dicom_cmf_estado,
        pep: !!selectedFlow.reservation.pep_estado,
        dof: !!selectedFlow.reservation.dof_estado,
        formulario_onu: !!selectedFlow.reservation.formulario_onu_estado
      });
    }
  }, [showDocumentModal, selectedFlow]);

  const guardarEstadosDocumentos = async () => {
    try {
      if (!selectedFlow || !selectedFlow.reservation || !(selectedFlow.reservation as any).id) {
        setShowDocumentModal(false);
        return;
      }
      const reservationId = (selectedFlow.reservation as any).id;
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
          formulario_onu_estado: documentos.formulario_onu
        })
        .eq('id', reservationId);
      setShowDocumentModal(false);
      await fetchFlows();
    } catch (err) {
      setShowDocumentModal(false);
    }
  };

  // Modal editable
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
                  type="button"
                  className={`p-2 rounded-full border-2 ${value ? 'bg-green-100 text-green-600 border-green-400' : 'bg-red-100 text-red-600 border-red-400'}`}
                  onClick={() => setDocumentos(prev => ({ ...prev, [key]: !value }))}
                >
                  {value ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setShowDocumentModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold"
            >
              Cancelar
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

  // Filtrar por rango de fechas al presionar el botón
  const handleFiltrarFechas = () => {
    if (!fechaDesde && !fechaHasta) {
      setFilteredFlows(flows);
      return;
    }
    setFilteredFlows(flows.filter(flow => {
      const fecha = new Date(flow.reservation.reservation_date).getTime();
      const desde = fechaDesde ? new Date(fechaDesde).getTime() : -Infinity;
      const hasta = fechaHasta ? new Date(fechaHasta).getTime() : Infinity;
      return fecha >= desde && fecha <= hasta;
    }));
  };

  // Actualizar filteredFlows cuando cambian los flows o se limpia el filtro
  useEffect(() => {
    if (!fechaDesde && !fechaHasta) {
      setFilteredFlows(flows);
    }
  }, [flows, fechaDesde, fechaHasta]);

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Flujo de Reservas</h1>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-700">Desde:</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <label className="text-sm text-gray-700">Hasta:</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={handleFiltrarFechas} className="ml-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold">Filtrar</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Reserva
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proyecto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Depto.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Reserva
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  G. DOCUMENTAL
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asignados
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFlows.map((flow) => (
                <tr 
                  key={flow.id} 
                  className={`hover:bg-gray-50 cursor-pointer ${flow.reservation.is_rescinded ? 'bg-red-50' : ''}`}
                  onClick={() => handleRowClick(flow.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {flow.reservation.reservation_number}
                    {flow.reservation.is_rescinded && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      Resciliada
                    </span>
                  )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const client = flow.reservation.client;
                      return `${client.first_name} ${client.last_name}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const project = flow.reservation.project;
                      return `${project.name} ${project.stage}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.reservation.apartment_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.reservation.reservation_date ? new Date(flow.reservation.reservation_date).toLocaleDateString('es-CL') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {(() => {
                      const doc = flow.reservation;
                      const checks = [
                        doc.pre_aprobacion_estado,
                        doc.cedula_identidad_estado,
                        doc.certificado_afp_estado,
                        doc.liquidaciones_sueldo_estado,
                        doc.dicom_cmf_estado,
                        doc.pep_estado,
                        doc.dof_estado,
                        doc.formulario_onu_estado
                      ];
                      const total = checks.length;
                      const completos = checks.filter(Boolean).length;
                      let icon = null;
                      let title = '';
                      if (completos === total) {
                        icon = <CheckCircle2 className="h-6 w-6 text-green-600" />;
                        title = 'Gestión documental completa';
                      } else if (completos === 0) {
                        icon = <XCircle className="h-6 w-6 text-red-500" />;
                        title = 'Faltan todos los documentos';
                      } else {
                        icon = <AlertCircle className="h-6 w-6 text-yellow-500" />;
                        title = 'Gestión documental parcial';
                      }
                      return (
                        <button
                          type="button"
                          className="mx-auto"
                          title={title}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedFlow(flow);
                            cargarEstadosDocumentos(flow.id);
                            setShowDocumentModal(true);
                          }}
                        >
                          {icon}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center">
                      <span className={`px-3 py-1 inline-flex items-center rounded-full text-sm font-medium ${getStatusColor(flow.status)}`}>
                        {getStatusIcon(flow.status)}
                        <span className="ml-2">{getStatusText(flow.status)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-center -space-x-2">
                      {flow.assigned_users.slice(0, 3).map((user) => (
                        <div
                          key={user.id}
                          className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden"
                          title={`${user.first_name} ${user.last_name}`}
                        >
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
                      ))}
                      {flow.assigned_users.length > 3 && (
                        <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            +{flow.assigned_users.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {renderDocumentModal()}
    </Layout>
  );
};

export default ReservationFlowList;