import React from 'react';
import { supabase } from './supabase';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface UserTypePermission {
  user_type: string;
  permission_id: string;
  granted: boolean;
}

/**
 * Verifica si el usuario actual tiene un permiso específico
 * @param permissionId - ID del permiso a verificar
 * @returns Promise<boolean> - true si el usuario tiene el permiso
 */
export const hasPermission = async (permissionId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Obtener el tipo de usuario del perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!profile?.user_type) return false;

    // Verificar el permiso en la tabla de permisos
    const { data: permission } = await supabase
      .from('user_type_permissions')
      .select('granted')
      .eq('user_type', profile.user_type)
      .eq('permission_id', permissionId)
      .single();

    return permission?.granted || false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Verifica si el usuario actual es administrador
 * @returns Promise<boolean> - true si el usuario es administrador
 */
export const isAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    return profile?.user_type === 'Administrador';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Obtiene todos los permisos del usuario actual
 * @returns Promise<string[]> - Array con los IDs de los permisos que tiene el usuario
 */
export const getUserPermissions = async (): Promise<string[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!profile?.user_type) return [];

    const { data: permissions } = await supabase
      .from('user_type_permissions')
      .select('permission_id')
      .eq('user_type', profile.user_type)
      .eq('granted', true);

    return permissions?.map(p => p.permission_id) || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
};

/**
 * Obtiene el tipo de usuario actual
 * @returns Promise<string | null> - Tipo de usuario o null si no se puede obtener
 */
export const getCurrentUserType = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    return profile?.user_type || null;
  } catch (error) {
    console.error('Error getting user type:', error);
    return null;
  }
};

/**
 * Hook personalizado para verificar permisos en componentes React
 * @param permissionId - ID del permiso a verificar
 * @returns [boolean, boolean] - [tienePermiso, cargando]
 */
export const usePermission = (permissionId: string): [boolean, boolean] => {
  const [hasPermission, setHasPermission] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkPermission = async () => {
      const result = await hasPermission(permissionId);
      setHasPermission(result);
      setLoading(false);
    };

    checkPermission();
  }, [permissionId]);

  return [hasPermission, loading];
};

/**
 * Hook personalizado para verificar si el usuario es administrador
 * @returns [boolean, boolean] - [esAdmin, cargando]
 */
export const useIsAdmin = (): [boolean, boolean] => {
  const [isAdminUser, setIsAdminUser] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkAdmin = async () => {
      const result = await isAdmin();
      setIsAdminUser(result);
      setLoading(false);
    };

    checkAdmin();
  }, []);

  return [isAdminUser, loading];
};

/**
 * Componente de protección basado en permisos
 */
export const PermissionGuard: React.FC<{
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ permission, children, fallback = null }) => {
  const [hasPermission, loading] = usePermission(permission);

  if (loading) {
    return <div className="animate-pulse">Cargando...</div>;
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

/**
 * Componente de protección para administradores
 */
export const AdminGuard: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback = null }) => {
  const [isAdminUser, loading] = useIsAdmin();

  if (loading) {
    return <div className="animate-pulse">Cargando...</div>;
  }

  return isAdminUser ? <>{children}</> : <>{fallback}</>;
}; 