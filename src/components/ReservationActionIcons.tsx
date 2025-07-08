import React from 'react';
import { Users, Edit2, DollarSign, Wallet, ListChecks, FileText, Airplay } from 'lucide-react';

interface ReservationActionIconsProps {
  reservationId?: string;
  clientId?: string;
  commissionFlowId?: string;
  reservationFlowId?: string;
  onOpenDocuments?: () => void;
  onOpenMobySuite?: () => void;
  current?: 'commission' | 'paymentFlow' | 'reservationFlow' | 'reservation';
  navigateImpl?: (url: string) => void;
}

const ReservationActionIcons: React.FC<ReservationActionIconsProps> = ({
  reservationId,
  clientId,
  commissionFlowId,
  reservationFlowId,
  onOpenDocuments,
  onOpenMobySuite,
  current,
  navigateImpl,
}) => {
  const navigate = (url: string) => {
    if (navigateImpl) {
      navigateImpl(url);
    } else {
      window.location.href = url;
    }
  };

  return (
    <div className="flex space-x-3">
      <button
        onClick={() => {
          console.log('Click Cliente', clientId);
          if (clientId) navigate(`/clientes/editar/${clientId}`);
        }}
        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
        title="Editar Cliente"
        disabled={!clientId}
      >
        <Users className="h-5 w-5" />
      </button>
      <button
        onClick={() => {
          console.log('Click Reserva', reservationId);
          if (reservationId && current !== 'reservation') navigate(`/reservas/${reservationId}`);
        }}
        className={`p-2 ${current === 'reservation' ? 'text-blue-600 bg-blue-50 border border-blue-200 cursor-default' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'} rounded-full transition-colors`}
        title="Editar Reserva"
        disabled={!reservationId || current === 'reservation'}
      >
        <Edit2 className="h-5 w-5" />
      </button>
      <button
        onClick={() => {
          console.log('Click Comisión', reservationId);
          if (commissionFlowId && current !== 'commission') navigate(`/pagos/${reservationId}`);
        }}
        className={`p-2 ${current === 'commission' ? 'text-blue-600 bg-blue-50 border border-blue-200 cursor-default' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'} rounded-full transition-colors`}
        title="Editar Comisión (actual)"
        disabled={!commissionFlowId || current === 'commission'}
      >
        <DollarSign className="h-5 w-5" />
      </button>
      <button
        onClick={() => {
          console.log('Click Flujo Pago', commissionFlowId);
          if (commissionFlowId) navigate(`/pagos/flujo/${commissionFlowId}`);
        }}
        className={`p-2 ${current === 'paymentFlow' ? 'text-blue-600 bg-blue-50 border border-blue-200 cursor-default' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'} rounded-full transition-colors`}
        title="Flujo de Pago"
        disabled={!commissionFlowId}
      >
        <Wallet className="h-5 w-5" />
      </button>
      <button
        onClick={() => {
          console.log('Click Flujo Reserva', reservationFlowId);
          if (reservationFlowId) navigate(`/flujo-reservas/${reservationFlowId}`);
        }}
        className={`p-2 ${current === 'reservationFlow' ? 'text-blue-600 bg-blue-50 border border-blue-200 cursor-default' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'} rounded-full transition-colors`}
        title="Flujo de Reserva"
        disabled={!reservationFlowId}
      >
        <ListChecks className="h-5 w-5" />
      </button>
      {/* Íconos de Documentos y Gestión MobySuite solo en Flujo de Reserva */}
      {current === 'reservationFlow' && (
        <>
          <button
            onClick={onOpenDocuments}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Documentos"
            type="button"
          >
            <FileText className="h-5 w-5" />
          </button>
          <button
            onClick={onOpenMobySuite}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Gestión MobySuite"
            type="button"
          >
            <Airplay className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
};

export default ReservationActionIcons; 