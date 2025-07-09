import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { PopupProvider } from './contexts/PopupContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/clients/ClientList';
import ClientForm from './pages/clients/ClientForm';
import ReservationList from './pages/reservations/ReservationList';
import ReservationForm from './pages/reservations/ReservationForm';
import ReservationDetail from './pages/reservations/ReservationDetail';
import BrokerList from './pages/brokers/BrokerList';
import BrokerForm from './pages/brokers/BrokerForm';
import PaymentList from './pages/payments/PaymentList';
import PaymentEdit from './pages/payments/PaymentEdit';
import PaymentFlow from './pages/payments/PaymentFlow';
import Settings from './pages/settings/Settings';
import ReservationFlowList from './pages/flows/ReservationFlowList';
import ReservationFlowDetail from './pages/flows/ReservationFlowDetail';
import TaskTracking from './pages/TaskTracking';
import Notifications from './pages/Notifications';
import ProtectedRoute from './components/ProtectedRoute';
import CommissionReport from './pages/reports/CommissionReport';
import ProjectionReport from './pages/reports/ProjectionReport';
import BrokerReport from './pages/reports/BrokerReport';
import SalesReport from './pages/reports/SalesReport';
import BrokerPaymentsReport from './pages/reports/BrokerPaymentsReport';
import BrokerPaymentsApproval from './pages/reports/BrokerPaymentsApproval';
import BrokerPaymentApprovalDetail from './pages/reports/BrokerPaymentApprovalDetail';
import ConsolidadoBrokers from './pages/reports/ConsolidadoBrokers';
import StockReportPage from './pages/reports/StockReportPage';
import BrokerQuotePage from './pages/public/BrokerQuotePage';
import CotizadorSettings from './pages/settings/CotizadorSettings';
import CotizadorAdmin from './pages/CotizadorAdmin';
import CalculoComisionBroker from './pages/CalculoComisionBroker';
import TareasAsignadas from './pages/TareasAsignadas';
import QuotationsReport from './pages/reports/QuotationsReport';
import Operaciones from './pages/Operaciones';
import CalendarPage from './pages/Calendar';
import DashboardTV from './pages/DashboardTV';
import EmailConfig from './pages/settings/EmailConfig';

function App() {
  const { session, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <PopupProvider>
      <Router>
        <Routes>
          <Route path="/login" element={
            session ? <Navigate to="/dashboard" replace /> : <Login />
          } />
          <Route path="/register" element={
            session ? <Navigate to="/dashboard" replace /> : <Register />
          } />
          {/* Public route for broker quote page - no authentication required */}
          <Route path="/cotizador-broker/:brokerSlug/:accessToken" element={<BrokerQuotePage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/notificaciones" element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          } />
          <Route path="/tareas-asignadas" element={
            <ProtectedRoute>
              <TareasAsignadas />
            </ProtectedRoute>
          } />
          <Route path="/clientes" element={
            <ProtectedRoute>
              <ClientList />
            </ProtectedRoute>
          } />
          <Route path="/clientes/nuevo" element={
            <ProtectedRoute>
              <ClientForm />
            </ProtectedRoute>
          } />
          <Route path="/clientes/editar/:id" element={
            <ProtectedRoute>
              <ClientForm />
            </ProtectedRoute>
          } />
          <Route path="/reservas" element={
            <ProtectedRoute>
              <ReservationList />
            </ProtectedRoute>
          } />
          <Route path="/reservas/nueva" element={
            <ProtectedRoute>
              <ReservationForm />
            </ProtectedRoute>
          } />
          <Route path="/reservas/editar/:id" element={
            <ProtectedRoute>
              <ReservationForm />
            </ProtectedRoute>
          } />
          <Route path="/reservas/detalle/:id" element={
            <ProtectedRoute>
              <ReservationDetail />
            </ProtectedRoute>
          } />
          <Route path="/flujo-reservas" element={
            <ProtectedRoute>
              <ReservationFlowList />
            </ProtectedRoute>
          } />
          <Route path="/flujo-reservas/:id" element={
            <ProtectedRoute>
              <ReservationFlowDetail />
            </ProtectedRoute>
          } />
          <Route path="/seguimiento" element={
            <ProtectedRoute>
              <TaskTracking />
            </ProtectedRoute>
          } />
          <Route path="/brokers" element={
            <ProtectedRoute>
              <BrokerList />
            </ProtectedRoute>
          } />
          <Route path="/brokers/nuevo" element={
            <ProtectedRoute>
              <BrokerForm />
            </ProtectedRoute>
          } />
          <Route path="/brokers/editar/:id" element={
            <ProtectedRoute>
              <BrokerForm />
            </ProtectedRoute>
          } />
          <Route path="/pagos" element={
            <ProtectedRoute>
              <PaymentList />
            </ProtectedRoute>
          } />
          <Route path="/pagos/:id" element={
            <ProtectedRoute>
              <PaymentEdit />
            </ProtectedRoute>
          } />
          <Route path="/pagos/flujo/:id" element={
            <ProtectedRoute>
              <PaymentFlow />
            </ProtectedRoute>
          } />
          <Route path="/calendario" element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          } />
          <Route path="/informes/comisiones" element={
            <ProtectedRoute>
              <CommissionReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/proyeccion-comisiones" element={
            <ProtectedRoute>
              <ProjectionReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/brokers" element={
            <ProtectedRoute>
              <BrokerReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/ventas" element={
            <ProtectedRoute>
              <SalesReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/pagos-brokers" element={
            <ProtectedRoute>
              <BrokerPaymentsReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/stock" element={
            <ProtectedRoute>
              <StockReportPage />
            </ProtectedRoute>
          } />
          <Route path="/informes/cotizaciones" element={
            <ProtectedRoute>
              <QuotationsReport />
            </ProtectedRoute>
          } />
          <Route path="/informes/consolidado-brokers" element={
            <ProtectedRoute>
              <ConsolidadoBrokers />
            </ProtectedRoute>
          } />
          <Route path="/informes/aprobacion-liquidaciones" element={
            <ProtectedRoute>
              <BrokerPaymentsApproval />
            </ProtectedRoute>
          } />
          <Route path="/informes/aprobacion-liquidaciones/:id" element={
            <ProtectedRoute>
              <BrokerPaymentApprovalDetail />
            </ProtectedRoute>
          } />
          <Route path="/configuracion" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/configuracion/emails" element={
            <ProtectedRoute>
              <EmailConfig />
            </ProtectedRoute>
          } />
          <Route path="/cotizador" element={
            <ProtectedRoute>
              <CotizadorAdmin />
            </ProtectedRoute>
          } />
          <Route path="/calculo-comision-broker/:unidadId" element={
            <ProtectedRoute>
              <CalculoComisionBroker />
            </ProtectedRoute>
          } />
          <Route path="/operaciones" element={
            <ProtectedRoute>
              <Operaciones />
            </ProtectedRoute>
          } />
          <Route path="/dashboard-tv" element={
            <ProtectedRoute>
              <DashboardTV />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </PopupProvider>
  );
}

export default App;