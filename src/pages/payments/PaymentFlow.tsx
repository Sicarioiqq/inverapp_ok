import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';

interface AtRiskPopupProps {
  commissionId: string;
  isAtRisk: boolean;
  reason: string | null;
  onSave: () => void;
  onClose: () => void;
}

const AtRiskPopup: React.FC<AtRiskPopupProps> = ({
  commissionId,
  isAtRisk,
  reason,
  onSave,
  onClose
}) => {
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atRisk, setAtRisk] = useState(isAtRisk);
  const [atRiskReason, setAtRiskReason] = useState(reason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      // Actualizar el estado de riesgo
      const { error: updateError } = await supabase
        .from('broker_commissions')
        .update({
          at_risk: atRisk,
          at_risk_reason: atRisk ? atRiskReason : null
        })
        .eq('id', commissionId);

      if (updateError) throw updateError;

      hidePopup();
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="at_risk"
            checked={atRisk}
            onChange={(e) => setAtRisk(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="at_risk" className="ml-2 block text-sm text-gray-700">
            Marcar como En Riesgo
          </label>
        </div>

        {atRisk && (
          <div>
            <label htmlFor="at_risk_reason" className="block text-sm font-medium text-gray-700">
              Motivo del Riesgo *
            </label>
            <textarea
              id="at_risk_reason"
              name="at_risk_reason"
              rows={4}
              required={atRisk}
              value={atRiskReason}
              onChange={(e) => setAtRiskReason(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Describa el motivo por el que esta operación está en riesgo..."
            />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => {
            hidePopup();
            onClose();
          }}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancelar
        </button>
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
            'Guardar'
          )}
        </button>
      </div>
    </form>
  );
};

export default PaymentFlow;