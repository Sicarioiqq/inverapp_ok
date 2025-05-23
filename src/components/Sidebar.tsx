import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  CalendarCheck,
  Building2,
  UserSquare2,
  Wallet,
  Settings,
  LogOut,
  ClipboardList,
  BarChart3,
  PackageSearch,
  CreditCard,
  CheckSquare,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase, checkSupabaseConnection } from '../lib/supabase';

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  path: string;
  onClick?: () => void;
  divider?: boolean;
  adminOnly?: boolean;
  submenu?: MenuItem[];
  isExpanded?: boolean;
}

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { signOut, session } = useAuthStore();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const initializeConnection = async () => {
      const { success, message } = await checkSupabaseConnection();
      if (!success) {
        setConnectionError(message);
        return;
      }
      setConnectionError(null);
      if (session) {
        await checkAdminStatus();
      }
    };

    initializeConnection();
  }, [session]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setIsAdmin(profile?.user_type === 'Administrador');
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const toggleSubmenu = (title: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const menuItems: MenuItem[] = [
    {
      title: 'Clientes',
      icon: <Users className="h-5 w-5" />,
      path: '/clientes',
    },
    {
      title: 'Reservas',
      icon: <CalendarCheck className="h-5 w-5" />,
      path: '/reservas',
    },
    {
      title: 'Flujo Reservas',
      icon: <ClipboardList className="h-5 w-5" />,
      path: '/flujo-reservas',
    },
    {
      title: 'Seguimiento',
      icon: <ClipboardList className="h-5 w-5" />,
      path: '/seguimiento',
      adminOnly: true,
    },
    {
      title: 'Aprobaciones',
      icon: <ShieldCheck className="h-5 w-5" />,
      path: '/aprobaciones',
      adminOnly: true,
      submenu: [
        {
          title: 'Liquidaciones',
          icon: <CheckSquare className="h-5 w-5" />,
          path: '/informes/aprobacion-liquidaciones',
        },
      ],
    },
    {
      title: 'Brokers',
      icon: <Building2 className="h-5 w-5" />,
      path: '/brokers',
    },
    {
      title: 'Pagos',
      icon: <Wallet className="h-5 w-5" />,
      path: '/pagos',
    },
    {
      title: 'Informes',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/informes',
      submenu: [
        {
          title: 'Comisiones',
          icon: <Wallet className="h-5 w-5" />,
          path: '/informes/comisiones',
        },
        {
          title: 'Proyección Comisiones',
          icon: <Wallet className="h-5 w-5" />,
          path: '/informes/proyeccion-comisiones',
        },
        {
          title: 'Ventas',
          icon: <CalendarCheck className="h-5 w-5" />,
          path: '/informes/ventas',
        },
        {
          title: 'Brokers',
          icon: <Building2 className="h-5 w-5" />,
          path: '/informes/brokers',
        },
        {
          title: 'Pagos Brokers',
          icon: <CreditCard className="h-5 w-5" />,
          path: '/informes/pagos-brokers',
        },
        {
          title: 'Consolidado Brokers',
          icon: <Building2 className="h-5 w-5" />,
          path: '/informes/consolidado-brokers',
        },
        {
          title: 'Stock',
          icon: <PackageSearch className="h-5 w-5" />,
          path: '/informes/stock',
        },
      ],
    },
    {
      title: 'Configuración',
      icon: <Settings className="h-5 w-5" />,
      path: '/configuracion',
      divider: true,
    },
    {
      title: 'Cerrar Sesión',
      icon: <LogOut className="h-5 w-5" />,
      path: '/login',
      onClick: signOut,
    },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  const isMenuActive = (item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(subItem => location.pathname === subItem.path || location.pathname.startsWith(subItem.path));
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path);
  };

  if (connectionError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-red-50">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-700 mb-2">Error de Conexión</h3>
        <p className="text-sm text-red-600 text-center mb-4">{connectionError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="flex-shrink-0 px-4 py-4 flex items-center">
        <img src="/inverapp-logo.png" alt="InverAPP" className="h-8 w-8" />
        <span className="ml-2 text-xl font-semibold text-gray-900">InverAPP</span>
      </div>
      
      <nav className="flex-1 px-2 pb-4">
        <ul className="space-y-1">
          {filteredMenuItems.map((item, index) => (
            <React.Fragment key={item.title}>
              {item.divider && <hr className="my-2 border-gray-200" />}
              <li>
                {item.submenu ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubmenu(item.title)}
                      className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${
                        isMenuActive(item)
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center">
                        {item.icon}
                        <span className="ml-3">{item.title}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedMenus[item.title] ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedMenus[item.title] && (
                      <ul className="pl-8 space-y-1">
                        {item.submenu.map(subItem => (
                          <li key={subItem.title}>
                            <Link
                              to={subItem.path}
                              onClick={subItem.onClick || onClose}
                              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                                location.pathname === subItem.path || location.pathname.startsWith(subItem.path)
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {subItem.icon}
                              <span className="ml-3">{subItem.title}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    onClick={item.onClick || onClose}
                    className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                      location.pathname === item.path || location.pathname.startsWith(item.path)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span className="ml-3">{item.title}</span>
                  </Link>
                )}
              </li>
            </React.Fragment>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;