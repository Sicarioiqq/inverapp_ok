import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePopup } from '../contexts/PopupContext';
import { Loader2, AlertTriangle } from 'lucide-react';

interface RescindReservationPopupProps {
  reservationId: string;
  reservationNumber: string;
  hasPaidCommission: boolean;
  commissionAmount: number | null;
  brokerCommissionId: string | null;
  onSave: () => void;
  onClose: () => void;
}

const RescindReservationPopup: React.FC<RescindReservationPopupProps> = ({
  reservationId,
  reservationNumber,
  hasPaidCommission,
  commissionAmount,
  brokerCommissionId,
  onSave,
  onClose
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [penalizeCommission, setPenalizeCommission] = useState(false);
  const [confirmRescind, setConfirmRescind] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Registrar el usuario
      if (!confirmRescind) {
        setError('Debe confirmar la resciliación escribiendo "CONFIRMAR" o "CONFIRMACIÓN"');
        setLoading(false);
        return;
      }
      if (!reason.trim()) {
        setError('Debe ingresar un motivo para la resciliación');
        setLoading(false);
        return;
      }

      // 1. Actualizar la reserva como resciliada
      const { error: authError } = await supabase
        .from('reservations')
        .update({
          is_rescinded: true,
          rescinded_at: new Date().toISOString(),
          rescinded_reason: reason,
          rescinded_by: session?.user.id
        })
        .eq('id', reservationId);

      if (authError) throw authError;

      // 2. Si hay comisión pagada y se decide penalizar
      if (hasPaidCommission && penalizeCommission && brokerCommissionId && commissionAmount) {
        // Calcular el monto del castigo (el monto ya pagado)
        const { data: commissionData, error: profileError } = await supabase
          .from('broker_commissions')
          .select('first_payment_percentage, payment_1_date, payment_2_date')
          .eq('id', brokerCommissionId)
          .single();

        if (profileError) throw profileError;

        let penaltyAmount = 0;
        
        // Calcular el monto pagado
        if (commissionData.payment_1_date) {
          penaltyAmount += commissionAmount * (commissionData.first_payment_percentage / 100);
        }
        
        if (commissionData.payment_2_date) {
          penaltyAmount += commissionAmount * ((100 - commissionData.first_payment_percentage) / 100);
        }

        // Actualizar la comisión con el monto del castigo
        const { error: adminRoleError } = await supabase
          .from('broker_commissions')
          .update({
            penalty_amount: penaltyAmount,
            at_risk: false,
            at_risk_reason: null
          })
          .eq('id', brokerCommissionId);

        if (adminRoleError) throw adminRoleError;
      } else if (brokerCommissionId) {
        // Si no se penaliza, asegurarse de quitar el estado de riesgo
        const { error: updateError } = await supabase
          .from('broker_commissions')
          .update({
            at_risk: false,
            at_risk_reason: null
          })
          .eq('id', brokerCommissionId);
          
        if (updateError) throw updateError;
      }

      hidePopup();
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (!reason.trim()) {
      setError('Debe ingresar un motivo para la resciliación');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleConfirmTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setConfirmText(text);
    setConfirmRescind(text === "CONFIRMAR" || text === "CONFIRMACIÓN");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {step === 1 && (
        <>
          <div className="bg-yellow-50 p-4 rounded-lg flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Advertencia</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Está a punto de resciliar la reserva {reservationNumber}. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              Motivo de resciliación *
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Ingrese el motivo de la resciliación"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={loading || !reason.trim()}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {hasPaidCommission && (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-medium text-yellow-800">Comisión pagada detectada</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Esta reserva tiene pagos de comisión realizados. ¿Desea castigar la comisión?
              </p>
              <div className="mt-3">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={penalizeCommission}
                    onChange={(e) => setPenalizeCommission(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-yellow-700">
                    Sí, castigar la comisión (el monto pagado se registrará como castigo)
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-red-800">Confirmación</h3>
            <p className="text-sm text-red-700 mt-1">
              Para confirmar la resciliación, escriba "CONFIRMAR" o "CONFIRMACIÓN" en el campo a continuación.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={handleConfirmTextChange}
              className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              placeholder="CONFIRMAR o CONFIRMACIÓN"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={loading || !confirmRescind}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Procesando...
                </>
              ) : (
                'Resciliar Reserva'
              )}
            </button>
          </div>
        </>
      )}
    </form>
  );
};

export default RescindReservationPopup;