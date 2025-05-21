import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { Building2, Users as UsersIcon, Shield, Home, ListChecks, BarChart3 } from 'lucide-react';
import RealEstateAgencies from './RealEstateAgencies';
import Projects from './Projects';
import UsersComponent from './Users';
import FlowConfig from './FlowConfig';
import PaymentFlowConfig from './PaymentFlowConfig';
import CotizadorSettings from './CotizadorSettings';

type Tab = 'projects' | 'agencies' | 'users' | 'permissions' | 'flow' | 'payment-flow' | 'cotizador';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<Tab>('projects');

  const tabs = [
    {
      id: 'projects',
      name: 'Proyectos',
      icon: <Home className="h-5 w-5" />,
    },
    {
      id: 'agencies',
      name: 'Inmobiliarias',
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      id: 'users',
      name: 'Usuarios',
      icon: <UsersIcon className="h-5 w-5" />,
    },
    {
      id: 'flow',
      name: 'Configuración Flujo Venta',
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      id: 'payment-flow',
      name: 'Configuración Flujo Pago',
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      id: 'permissions',
      name: 'Permisos',
      icon: <Shield className="h-5 w-5" />,
    },
    // <--- ADICIÓN: Nueva pestaña para Cotizador
    {
      id: 'cotizador' as Tab,
      name: 'Cotizador',
      icon: <BarChart3 className="h-5 w-5" />, // Puedes cambiar este ícono por uno que prefieras
    },
  ];

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-4" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium border-b-2 
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span className="ml-2">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'projects' && <Projects />}
          {activeTab === 'agencies' && <RealEstateAgencies />}
          {activeTab === 'users' && <UsersComponent />}
          {activeTab === 'flow' && <FlowConfig />}
          {activeTab === 'payment-flow' && <PaymentFlowConfig />}
          {activeTab === 'permissions' && <div>Contenido de Permisos</div>}
          {activeTab === 'payment-flow' && <CotizadorSettings />}
        </div>
      </div>
    </Layout>
  );
};

export default Settings;