import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Loader2, UserCircle } from 'lucide-react';
import UserForm from './UserForm';

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

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Efecto para búsqueda en tiempo real
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch();
      } else {
        fetchUsers();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name');

      if (error) throw error;

      const formattedUsers = profiles.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        position: profile.position || '',
        is_seller: profile.is_seller || false,
        user_type: profile.user_type || '',
        avatar_url: profile.avatar_url,
        rut: profile.Rut || ''
      }));

      setUsers(formattedUsers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,position.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('first_name');

      if (error) throw error;

      const formattedUsers = profiles.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        position: profile.position || '',
        is_seller: profile.is_seller || false,
        user_type: profile.user_type || '',
        avatar_url: profile.avatar_url,
        rut: profile.Rut || ''
      }));

      setUsers(formattedUsers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  };

  if (showForm) {
    return <UserForm user={editingUser} onClose={handleFormClose} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido, cargo o email..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Usuario
        </button>
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
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Correo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rut
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={`${user.first_name} ${user.last_name}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="h-10 w-10 text-gray-400" />
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {`${user.first_name} ${user.last_name}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.rut}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`h-4 w-4 rounded-full ${user.is_seller ? 'bg-green-400' : 'bg-gray-300'} inline-block`}></span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-5 w-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Users;