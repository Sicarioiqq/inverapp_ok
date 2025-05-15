import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../stores/authStore';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { Bell, Search, Menu, UserCircle } from 'lucide-react';
import SearchResults from './SearchResults';

interface LayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  position: string;
  avatar_url?: string;
}

interface SearchResult {
  id: string;
  type: 'client' | 'reservation' | 'apartment';
  title: string;
  subtitle: string;
  reservationFlowId?: string;
  is_rescinded?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pendingTasksCount, setPendingTasksCount] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { signOut, session, error: authError } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserProfile();
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPendingTasksCount();
      
      // Set up a timer to refresh the count every minute
      const intervalId = setInterval(fetchPendingTasksCount, 60000);
      
      // Clean up the interval when the component unmounts
      return () => clearInterval(intervalId);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Check Supabase connection
    const checkConnection = async () => {
      const result = await checkSupabaseConnection();
      if (!result.success) {
        setConnectionError(result.message);
      } else {
        setConnectionError(null);
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    // Handle click outside to close search results
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 3) {
        handleSearch();
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchUserProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, position, avatar_url')
        .eq('email', session?.user.email)
        .maybeSingle();

      if (error) throw error;
      if (profile) {
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchPendingTasksCount = async () => {
    try {
      // Count pending sale flow tasks assigned to the user
      const { data: saleTasksData, error: saleError } = await supabase
        .from('task_assignments')
        .select(`
          id,
          reservation_flow:reservation_flows!inner(status)
        `)
        .eq('user_id', session!.user.id)
        .neq('reservation_flow.status', 'pending');

      if (saleError) throw saleError;

      // Count pending payment flow tasks assigned to the user
      const { data: paymentTasksData, error: paymentError } = await supabase
        .from('commission_flow_tasks')
        .select(`
          id,
          commission_flow:commission_flows!inner(status)
        `)
        .eq('assignee_id', session!.user.id)
        .neq('commission_flow.status', 'pending')
        .neq('status', 'completed')
        .neq('status', 'blocked');

      if (paymentError) throw paymentError;

      // Set the total count
      setPendingTasksCount(
        (saleTasksData?.length || 0) + 
        (paymentTasksData?.length || 0)
      );
    } catch (err) {
      console.error('Error fetching pending tasks count:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setShowResults(true);
    
    try {
      const results: SearchResult[] = [];
      
      // Search clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, first_name, last_name, rut')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,rut.ilike.%${searchTerm}%`)
        .is('deleted_at', null)
        .limit(5);
        
      if (clientsError) throw clientsError;
      
      // For each client, find their reservations and reservation flows
      for (const client of clients || []) {
        // Get reservations for this client
        const { data: reservations } = await supabase
          .from('reservations')
          .select(`
            id,
            project:projects(name, stage)
          `)
          .eq('client_id', client.id)
          .limit(1);
          
        if (reservations && reservations.length > 0) {
          // Get reservation flow for this reservation
          const { data: flowData } = await supabase
            .from('reservation_flows')
            .select('id')
            .eq('reservation_id', reservations[0].id)
            .maybeSingle();
            
          results.push({
            id: client.id,
            type: 'client',
            title: `${client.first_name} ${client.last_name}`,
            subtitle: `RUT: ${client.rut}${reservations[0].project ? ` - ${reservations[0].project.name} ${reservations[0].project.stage}` : ''}`,
            reservationFlowId: flowData?.id
          });
        } else {
          // Client without reservations
          results.push({
            id: client.id,
            type: 'client',
            title: `${client.first_name} ${client.last_name}`,
            subtitle: `RUT: ${client.rut}`
          });
        }
      }
      
      // Search reservations by number
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          id, 
          reservation_number,
          is_rescinded,
          client:clients(first_name, last_name),
          project:projects(name, stage),
          apartment_number
        `)
        .ilike('reservation_number', `%${searchTerm}%`)
        .limit(5);
        
      if (reservationsError) throw reservationsError;
      
      // For each reservation, get the reservation flow ID
      for (const reservation of reservations || []) {
        const { data: flowData } = await supabase
          .from('reservation_flows')
          .select('id')
          .eq('reservation_id', reservation.id)
          .maybeSingle();
          
        results.push({
          id: reservation.id,
          type: 'reservation',
          title: `Reserva ${reservation.reservation_number}`,
          subtitle: `${reservation.client.first_name} ${reservation.client.last_name} - ${reservation.project.name} ${reservation.project.stage}`,
          reservationFlowId: flowData?.id,
          is_rescinded: reservation.is_rescinded
        });
      }
      
      // Search by apartment number
      const { data: apartments, error: apartmentsError } = await supabase
        .from('reservations')
        .select(`
          id, 
          reservation_number,
          is_rescinded,
          client:clients(first_name, last_name),
          project:projects(name, stage),
          apartment_number
        `)
        .ilike('apartment_number', `%${searchTerm}%`)
        .limit(5);
        
      if (apartmentsError) throw apartmentsError;
      
      // For each apartment, get the reservation flow ID
      for (const apartment of apartments || []) {
        const { data: flowData } = await supabase
          .from('reservation_flows')
          .select('id')
          .eq('reservation_id', apartment.id)
          .maybeSingle();
          
        // Only add if not already in results
        if (!results.some(r => r.id === apartment.id && r.type === 'reservation')) {
          results.push({
            id: apartment.id,
            type: 'apartment',
            title: `Depto. ${apartment.apartment_number}`,
            subtitle: `${apartment.project.name} ${apartment.project.stage} - ${apartment.client.first_name} ${apartment.client.last_name}`,
            reservationFlowId: flowData?.id,
            is_rescinded: apartment.is_rescinded
          });
        }
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSearchInputFocus = () => {
    if (searchTerm.trim().length >= 3) {
      setShowResults(true);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - Fixed position */}
      <div className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen lg:overflow-y-auto">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100 z-30' : 'opacity-0 -z-10'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Navbar */}
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-md text-gray-400 lg:hidden hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <Menu className="h-6 w-6" />
                </button>

                {/* Logo that links to dashboard */}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center space-x-2 cursor-pointer ml-2 lg:ml-0"
                >
                  <img src="/inverapp-logo.svg" alt="InverAPP" className="h-8 w-8 text-blue-600" />
                  <span className="text-xl font-semibold text-gray-900">
                    InverAPP
                  </span>
                </button>
              </div>

              <div className="flex items-center">
                <div className="hidden md:block">
                  <div className="relative" ref={searchRef}>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar cliente, reserva o depto..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={handleSearchInputFocus}
                    />
                    {searchTerm && (
                      <button
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={clearSearch}
                      >
                        <span className="text-gray-400 hover:text-gray-500">
                          &times;
                        </span>
                      </button>
                    )}
                    {showResults && (
                      <SearchResults 
                        results={searchResults} 
                        onSelect={clearSearch} 
                        isLoading={isSearching}
                      />
                    )}
                  </div>
                </div>
                
                {/* Notifications */}
                <button
                  onClick={() => navigate('/notificaciones')}
                  className="ml-4 p-2 text-gray-400 hover:text-gray-500 focus:outline-none relative"
                >
                  <Bell className="h-6 w-6" />
                  {pendingTasksCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                      {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                    </span>
                  )}
                </button>

                {/* User Menu */}
                <div className="ml-4 flex items-center">
                  {userProfile && (
                    <div className="mr-4 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {userProfile.first_name} {userProfile.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {userProfile.position}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center text-gray-700 hover:text-gray-900"
                  >
                    {userProfile?.avatar_url ? (
                      <img
                        src={userProfile.avatar_url}
                        alt="Avatar"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle className="h-8 w-8" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Connection Error Banner */}
        {(connectionError || authError) && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 sticky top-16 z-10">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {connectionError || authError}. Intentando reconectar...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4">
          <div className="px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              InverAPP - Desarrollado por Claudio Soto A.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;