import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, Loader2, Upload, X } from 'lucide-react';
import { isAdmin } from '../../lib/permissions.tsx';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  is_seller: boolean;
  user_type: string;
  avatar_url?: string;
  rut?: string;
}

interface UserFormProps {
  user?: User | null;
  onClose: () => void;
}

const USER_TYPES = [
  'Administrador',
  'KAM',
  'Gestor de Pagos',
  'Supervisor',
  'Operaciones',
  'Gestor de Crédito'
];

const UserForm: React.FC<UserFormProps> = ({ user, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    position: user?.position || '',
    is_seller: user?.is_seller || false,
    user_type: user?.user_type || '',
    rut: user?.rut || '',
    password: '' // Solo para nuevos usuarios
  });
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      setIsAdminUser(await isAdmin());
    };
    checkAdmin();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Por favor seleccione un archivo de imagen válido');
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('La imagen no debe superar los 2MB');
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removeAvatar = async () => {
    try {
      setLoading(true);
      
      if (user?.avatar_url) {
        const userId = user.id;
        const oldPath = user.avatar_url.split('/').pop();
        
        if (oldPath) {
          // Remove file from storage
          await supabase.storage
            .from('avatars')
            .remove([`${userId}/${oldPath}`]);
          
          // Update profile
          await supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', userId);
        }
      }

      setAvatarFile(null);
      setAvatarPreview(null);
      setError(null);
    } catch (err: any) {
      setError('Error al eliminar la imagen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    try {
      // Remove old avatar if exists
      if (user?.avatar_url) {
        const oldPath = user.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (user) {
        // Update existing user
        const avatar_url = avatarFile ? await uploadAvatar(user.id) : user.avatar_url;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            position: formData.position,
            is_seller: formData.is_seller,
            user_type: formData.user_type,
            avatar_url: avatar_url,
            rut: formData.rut
          })
          .eq('id', user.id);

        if (updateError) throw updateError;
      } else {
        // Verify if user exists
        const { data: existingUser, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();

        if (userError) throw userError;

        if (existingUser) {
          throw new Error('Ya existe un usuario con este correo electrónico');
        }

        // Create new user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.first_name,
              last_name: formData.last_name,
              position: formData.position,
              is_seller: formData.is_seller,
              user_type: formData.user_type,
              rut: formData.rut
            }
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            throw new Error('Este correo electrónico ya está registrado. Por favor, use un correo diferente.');
          }
          throw signUpError;
        }

        if (authData.user) {
          const avatar_url = avatarFile ? await uploadAvatar(authData.user.id) : null;

          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: formData.email,
              first_name: formData.first_name,
              last_name: formData.last_name,
              position: formData.position,
              is_seller: formData.is_seller,
              user_type: formData.user_type,
              avatar_url,
              rut: formData.rut
            });

          if (profileError) throw profileError;

          // Assign admin role if needed
          if (formData.user_type === 'Administrador') {
            const { data: roleData, error: roleError } = await supabase
              .from('roles')
              .select('id')
              .eq('name', 'admin')
              .single();

            if (roleError) throw roleError;

            if (roleData) {
              const { error: userRoleError } = await supabase
                .from('user_roles')
                .insert({
                  user_id: authData.user.id,
                  role_id: roleData.id
                });

              if (userRoleError) throw userRoleError;
            }
          }
        }
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {user ? 'Editar Usuario' : 'Nuevo Usuario'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Avatar Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto de Perfil
            </label>
            <div className="flex items-center space-x-4">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar Preview"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50">
                <span>{avatarPreview ? 'Cambiar foto' : 'Subir foto'}</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              JPG, PNG o GIF. Máximo 2MB.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo Electrónico *
            </label>
            <input
              type="email"
              id="email"
              required
              disabled={!!user}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {!user && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña *
              </label>
              <input
                type="password"
                id="password"
                required={!user}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              Nombres *
            </label>
            <input
              type="text"
              id="first_name"
              required
              value={formData.first_name}
              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
              Apellidos *
            </label>
            <input
              type="text"
              id="last_name"
              required
              value={formData.last_name}
              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700">
              Cargo *
            </label>
            <input
              type="text"
              id="position"
              required
              value={formData.position}
              onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={!isAdminUser}
            />
          </div>

          <div>
            <label htmlFor="user_type" className="block text-sm font-medium text-gray-700">
              Tipo de Usuario *
            </label>
            <select
              id="user_type"
              required
              value={formData.user_type}
              onChange={(e) => setFormData(prev => ({ ...prev, user_type: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={!isAdminUser}
            >
              <option value="">Seleccione un tipo</option>
              {USER_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rut" className="block text-sm font-medium text-gray-700">
              Rut
            </label>
            <input
              type="text"
              id="rut"
              value={formData.rut}
              onChange={(e) => setFormData(prev => ({ ...prev, rut: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_seller"
                checked={formData.is_seller}
                onChange={(e) => setFormData(prev => ({ ...prev, is_seller: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_seller" className="ml-2 block text-sm text-gray-700">
                Es vendedor
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
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
              <>
                <Save className="h-5 w-5 mr-2" />
                Guardar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;