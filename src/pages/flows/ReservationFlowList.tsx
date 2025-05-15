import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Search, Loader2, Clock, CheckCircle2, AlertCircle, UserCircle } from 'lucide-react';

interface ReservationFlow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  reservation: {
    reservation_number: string;
    client: {
      first_name: string;
      last_name: string;
    };
    project: {
      name: string;
      stage: string;
    };
    apartment_number: string;
    is_rescinded: boolean; // Añadir esta línea
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

const ReservationFlowList = () => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<ReservationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

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
            reservation_number,
            apartment_number,
            is_rescinded, // Añadir esta línea
            client:clients(first_name, last_name),
            project:projects(name, stage)
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
        .order('reservation_number', { ascending: false, foreignTable: 'reservations' });

      if (error) throw error;

      // Process the data to format assigned users
      const formattedFlows = data?.map(flow => ({
        ...flow,
        assigned_users: flow.assigned_users
          ?.map(assignment => assignment.user)
          .filter((user, index, self) => 
            // Remove duplicates based on user id
            index === self.findIndex(u => u.id === user.id)
          ) || []
      }));

      setFlows(formattedFlows || []);
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
            reservation_number,
            apartment_number,
            is_rescinded, // Añadir esta línea
            client:clients(first_name, last_name),
            project:projects(name, stage)
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
        .order('started_at', { ascending: false });

      if (flowsError) throw flowsError;

      const formattedFlows = flowsData?.map(flow => ({
        ...flow,
        assigned_users: flow.assigned_users
          ?.map(assignment => assignment.user)
          .filter((user, index, self) => 
            index === self.findIndex(u => u.id === user.id)
          ) || []
      }));

      setFlows(formattedFlows || []);
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

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Flujo de Reservas</h1>
        <div className="relative max-w-lg flex-1 ml-8">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre de cliente..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                  dd
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Depto.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Etapa Actual
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
              {flows.map((flow) => (
                <tr 
                  key={flow.id} 
                  className="hover:bg-gray-50 cursor-pointer"d
                  onClick={() => handleRowClick(flow.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {flow.reservation.reservation_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {`${flow.reservation.client.first_name} ${flow.reservation.client.last_name}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {`${flow.reservation.project.name} ${flow.reservation.project.stage}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.reservation.apartment_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {flow.current_stage?.name || 'No iniciado'}
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
    </Layout>
  );
};

export default ReservationFlowList;