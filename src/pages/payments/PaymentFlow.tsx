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