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
  ShoppingBasket,
  ListChecks
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

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

export const menuItems: MenuItem[] = [
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
    title: 'Operaciones',
    icon: <ClipboardList className="h-5 w-5" />,
    path: '/operaciones',
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
    title: 'Cotizador',
    icon: <ShoppingBasket className="h-5 w-5" />,
    path: '/cotizador',
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
      {
        title: 'Cotizaciones',
        icon: <ListChecks className="h-5 w-5" />,
        path: '/informes/cotizaciones',
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
    path: '/login'
  },
];

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { signOut, session } = useAuthStore();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});

  if (!isOpen) {
    return null;
  }

  // Detectar si es mobile (menos de 1024px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  if (isMobile && !isOpen) {
    return null;
  }

  React.useEffect(() => {
    checkAdminStatus();
  }, [session]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

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

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  const isMenuActive = (item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(subItem => location.pathname === subItem.path || location.pathname.startsWith(subItem.path));
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="flex-shrink-0 px-4 py-4 flex items-center">
        <Link to="/dashboard" className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
          <img src="/inverapp-logo.png" alt="InverAPP" className="h-8 w-8" />
          <span className="ml-2 text-xl font-semibold text-gray-900">InverAPP</span>
        </Link>
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
                    onClick={item.title === 'Cerrar Sesión' ? signOut : (item.onClick || onClose)}
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