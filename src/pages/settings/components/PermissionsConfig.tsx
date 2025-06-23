import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Save, Shield, Users, Building2, FileText, BarChart3, CreditCard, Settings, CheckCircle, XCircle } from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface UserTypePermission {
  user_type: string;
  permission_id: string;
  granted: boolean;
}

interface UserType {
  name: string;
  description: string;
  icon: React.ReactNode;
}

const USER_TYPES: UserType[] = [
  {
    name: 'Administrador',
    description: 'Acceso completo a todas las funcionalidades del sistema',
    icon: <Shield className="h-5 w-5" />
  },
  {
    name: 'KAM',
    description: 'Key Account Manager - Gestión de cuentas clave y tareas',
    icon: <Users className="h-5 w-5" />
  },
  {
    name: 'Gestor de Pagos',
    description: 'Gestión de flujos de pago y comisiones',
    icon: <CreditCard className="h-5 w-5" />
  },
  {
    name: 'Supervisor',
    description: 'Supervisión de operaciones y reportes',
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    name: 'Operaciones',
    description: 'Gestión de operaciones y tareas',
    icon: <Settings className="h-5 w-5" />
  },
  {
    name: 'Gestor de Crédito',
    description: 'Gestión de créditos y aprobaciones financieras',
    icon: <BarChart3 className="h-5 w-5" />
  }
];

const PERMISSIONS: Permission[] = [
  // Gestión de Usuarios
  { id: 'users_view', name: 'Ver Usuarios', description: 'Ver lista de usuarios del sistema', category: 'Usuarios' },
  { id: 'users_create', name: 'Crear Usuarios', description: 'Crear nuevos usuarios', category: 'Usuarios' },
  { id: 'users_edit', name: 'Editar Usuarios', description: 'Modificar información de usuarios', category: 'Usuarios' },
  { id: 'users_delete', name: 'Eliminar Usuarios', description: 'Eliminar usuarios del sistema', category: 'Usuarios' },
  
  // Gestión de Proyectos
  { id: 'projects_view', name: 'Ver Proyectos', description: 'Ver lista de proyectos', category: 'Proyectos' },
  { id: 'projects_create', name: 'Crear Proyectos', description: 'Crear nuevos proyectos', category: 'Proyectos' },
  { id: 'projects_edit', name: 'Editar Proyectos', description: 'Modificar información de proyectos', category: 'Proyectos' },
  { id: 'projects_delete', name: 'Eliminar Proyectos', description: 'Eliminar proyectos', category: 'Proyectos' },
  
  // Gestión de Clientes
  { id: 'clients_view', name: 'Ver Clientes', description: 'Ver lista de clientes', category: 'Clientes' },
  { id: 'clients_create', name: 'Crear Clientes', description: 'Crear nuevos clientes', category: 'Clientes' },
  { id: 'clients_edit', name: 'Editar Clientes', description: 'Modificar información de clientes', category: 'Clientes' },
  { id: 'clients_delete', name: 'Eliminar Clientes', description: 'Eliminar clientes', category: 'Clientes' },
  
  // Gestión de Reservas
  { id: 'reservations_view', name: 'Ver Reservas', description: 'Ver lista de reservas', category: 'Reservas' },
  { id: 'reservations_create', name: 'Crear Reservas', description: 'Crear nuevas reservas', category: 'Reservas' },
  { id: 'reservations_edit', name: 'Editar Reservas', description: 'Modificar reservas', category: 'Reservas' },
  { id: 'reservations_delete', name: 'Eliminar Reservas', description: 'Eliminar reservas', category: 'Reservas' },
  { id: 'reservations_approve', name: 'Aprobar Reservas', description: 'Aprobar o rechazar reservas', category: 'Reservas' },
  
  // Gestión de Pagos
  { id: 'payments_view', name: 'Ver Pagos', description: 'Ver flujos de pago', category: 'Pagos' },
  { id: 'payments_create', name: 'Crear Pagos', description: 'Crear flujos de pago', category: 'Pagos' },
  { id: 'payments_edit', name: 'Editar Pagos', description: 'Modificar flujos de pago', category: 'Pagos' },
  { id: 'payments_approve', name: 'Aprobar Pagos', description: 'Aprobar pagos de brokers', category: 'Pagos' },
  
  // Gestión de Comisiones
  { id: 'commissions_view', name: 'Ver Comisiones', description: 'Ver comisiones de brokers', category: 'Comisiones' },
  { id: 'commissions_calculate', name: 'Calcular Comisiones', description: 'Calcular comisiones', category: 'Comisiones' },
  { id: 'commissions_approve', name: 'Aprobar Comisiones', description: 'Aprobar comisiones', category: 'Comisiones' },
  
  // Reportes
  { id: 'reports_view', name: 'Ver Reportes', description: 'Acceder a reportes', category: 'Reportes' },
  { id: 'reports_export', name: 'Exportar Reportes', description: 'Exportar reportes', category: 'Reportes' },
  
  // Configuración
  { id: 'settings_view', name: 'Ver Configuración', description: 'Ver configuración del sistema', category: 'Configuración' },
  { id: 'settings_edit', name: 'Editar Configuración', description: 'Modificar configuración', category: 'Configuración' },
  
  // Gestión de Crédito
  { id: 'credit_view', name: 'Ver Créditos', description: 'Ver solicitudes de crédito', category: 'Crédito' },
  { id: 'credit_approve', name: 'Aprobar Créditos', description: 'Aprobar o rechazar créditos', category: 'Crédito' },
  { id: 'credit_edit', name: 'Editar Créditos', description: 'Modificar información de créditos', category: 'Crédito' },
  
  // Gestión de Brokers
  { id: 'brokers_view', name: 'Ver Brokers', description: 'Ver lista de brokers', category: 'Brokers' },
  { id: 'brokers_create', name: 'Crear Brokers', description: 'Crear nuevos brokers', category: 'Brokers' },
  { id: 'brokers_edit', name: 'Editar Brokers', description: 'Modificar información de brokers', category: 'Brokers' },
  { id: 'brokers_delete', name: 'Eliminar Brokers', description: 'Eliminar brokers', category: 'Brokers' },
  
  // Gestión de Inmobiliarias
  { id: 'agencies_view', name: 'Ver Inmobiliarias', description: 'Ver lista de inmobiliarias', category: 'Inmobiliarias' },
  { id: 'agencies_create', name: 'Crear Inmobiliarias', description: 'Crear nuevas inmobiliarias', category: 'Inmobiliarias' },
  { id: 'agencies_edit', name: 'Editar Inmobiliarias', description: 'Modificar información de inmobiliarias', category: 'Inmobiliarias' },
  { id: 'agencies_delete', name: 'Eliminar Inmobiliarias', description: 'Eliminar inmobiliarias', category: 'Inmobiliarias' }
];

const PermissionsConfig: React.FC = () => {
  const [permissions, setPermissions] = useState<{ [key: string]: { [key: string]: boolean } }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar permisos desde la base de datos
      const { data: userTypePermissions, error: fetchError } = await supabase
        .from('user_type_permissions')
        .select('*');

      if (fetchError) throw fetchError;

      // Organizar permisos por tipo de usuario
      const permissionsMap: { [key: string]: { [key: string]: boolean } } = {};
      
      USER_TYPES.forEach(userType => {
        permissionsMap[userType.name] = {};
        PERMISSIONS.forEach(permission => {
          const userTypePermission = userTypePermissions?.find(
            utp => utp.user_type === userType.name && utp.permission_id === permission.id
          );
          permissionsMap[userType.name][permission.id] = userTypePermission?.granted || false;
        });
      });

      setPermissions(permissionsMap);
    } catch (err: any) {
      console.error('Error loading permissions:', err);
      setError('Error al cargar los permisos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (userType: string, permissionId: string, granted: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [userType]: {
        ...prev[userType],
        [permissionId]: granted
      }
    }));
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      setError(null);

      // Preparar datos para guardar
      const permissionsToSave: UserTypePermission[] = [];
      
      Object.entries(permissions).forEach(([userType, userPermissions]) => {
        Object.entries(userPermissions).forEach(([permissionId, granted]) => {
          permissionsToSave.push({
            user_type: userType,
            permission_id: permissionId,
            granted
          });
        });
      });

      // Eliminar permisos existentes
      const { error: deleteError } = await supabase
        .from('user_type_permissions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos excepto un registro dummy

      if (deleteError) throw deleteError;

      // Insertar nuevos permisos
      if (permissionsToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('user_type_permissions')
          .insert(permissionsToSave);

        if (insertError) throw insertError;
      }

      toast.success('Permisos guardados correctamente');
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      setError('Error al guardar los permisos: ' + err.message);
      toast.error('Error al guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionsByCategory = () => {
    const categories: { [key: string]: Permission[] } = {};
    PERMISSIONS.forEach(permission => {
      if (!categories[permission.category]) {
        categories[permission.category] = [];
      }
      categories[permission.category].push(permission);
    });
    return categories;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando permisos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Configuración de Permisos</h2>
          <p className="text-gray-600 mt-1">
            Configura los permisos para cada tipo de usuario en el sistema
          </p>
        </div>
        <button
          onClick={handleSavePermissions}
          disabled={saving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar Permisos
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permisos
                </th>
                {USER_TYPES.map(userType => (
                  <th key={userType.name} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center mb-1">
                        {userType.icon}
                        <span className="ml-1">{userType.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 font-normal">
                        {userType.description}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(getPermissionsByCategory()).map(([category, categoryPermissions]) => (
                <React.Fragment key={category}>
                  <tr className="bg-gray-50">
                    <td colSpan={USER_TYPES.length + 1} className="px-6 py-2">
                      <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
                    </td>
                  </tr>
                  {categoryPermissions.map(permission => (
                    <tr key={permission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                          <div className="text-sm text-gray-500">{permission.description}</div>
                        </div>
                      </td>
                      {USER_TYPES.map(userType => (
                        <td key={`${userType.name}-${permission.id}`} className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handlePermissionChange(
                              userType.name, 
                              permission.id, 
                              !permissions[userType.name]?.[permission.id]
                            )}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                              permissions[userType.name]?.[permission.id]
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={permissions[userType.name]?.[permission.id] ? 'Quitar permiso' : 'Otorgar permiso'}
                          >
                            {permissions[userType.name]?.[permission.id] ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PermissionsConfig; 