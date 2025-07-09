import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Mail, 
  Settings, 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string;
  data: any;
  sent_at: string;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
}

interface EmailTemplate {
  type: string;
  name: string;
  description: string;
  enabled: boolean;
}

const EmailConfig = () => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<string>('all');

  const emailTemplates: EmailTemplate[] = [
    {
      type: 'task_assigned',
      name: 'Tarea Asignada',
      description: 'Se envía cuando se asigna una nueva tarea a un usuario',
      enabled: true
    },
    {
      type: 'task_completed',
      name: 'Tarea Completada',
      description: 'Se envía cuando se completa una tarea',
      enabled: true
    },
    {
      type: 'reservation_created',
      name: 'Nueva Reserva',
      description: 'Se envía cuando se crea una nueva reserva',
      enabled: true
    }
  ];

  useEffect(() => {
    fetchEmailLogs();
  }, [showFailedOnly, selectedEmailType]);

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (showFailedOnly) {
        query = query.eq('status', 'failed');
      }

      if (selectedEmailType !== 'all') {
        query = query.eq('email_type', selectedEmailType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Enviado';
      case 'failed':
        return 'Falló';
      case 'pending':
        return 'Pendiente';
      default:
        return 'Desconocido';
    }
  };

  const getEmailTypeName = (type: string) => {
    const template = emailTemplates.find(t => t.type === type);
    return template ? template.name : type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const retryFailedEmail = async (emailLog: EmailLog) => {
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          email_type: emailLog.email_type,
          recipient_email: emailLog.recipient_email,
          recipient_name: emailLog.recipient_name,
          data: emailLog.data
        }
      });

      if (error) throw error;

      // Actualizar el estado local
      setEmailLogs(prev => prev.map(log => 
        log.id === emailLog.id 
          ? { ...log, status: 'sent' as const, error_message: undefined }
          : log
      ));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const exportEmailLogs = () => {
    const csvContent = [
      ['Fecha', 'Tipo', 'Destinatario', 'Estado', 'Error'].join(','),
      ...emailLogs.map(log => [
        formatDate(log.sent_at),
        getEmailTypeName(log.email_type),
        log.recipient_email,
        getStatusText(log.status),
        log.error_message || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `email_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Mail className="w-6 h-6 mr-2" />
          Configuración de Emails Automáticos
        </h1>
        <p className="text-gray-600 mt-2">
          Gestiona el sistema de notificaciones por email automáticas
        </p>
      </div>

      {/* Configuración de Templates */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Templates de Email
        </h2>
        <div className="grid gap-4">
          {emailTemplates.map((template) => (
            <div key={template.type} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-600">{template.description}</p>
              </div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  template.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {template.enabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logs de Emails */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Historial de Emails
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchEmailLogs}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </button>
            <button
              onClick={exportEmailLogs}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showFailedOnly"
              checked={showFailedOnly}
              onChange={(e) => setShowFailedOnly(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showFailedOnly" className="ml-2 text-sm text-gray-700">
              Solo fallidos
            </label>
          </div>

          <select
            value={selectedEmailType}
            onChange={(e) => setSelectedEmailType(e.target.value)}
            className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="all">Todos los tipos</option>
            {emailTemplates.map((template) => (
              <option key={template.type} value={template.type}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando logs...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : emailLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No hay logs de email para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destinatario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.sent_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getEmailTypeName(log.email_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{log.recipient_name}</div>
                        <div className="text-gray-500">{log.recipient_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(log.status)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getStatusText(log.status)}
                        </span>
                      </div>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1">
                          {log.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {log.status === 'failed' && (
                        <button
                          onClick={() => retryFailedEmail(log)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Reintentar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailConfig; 