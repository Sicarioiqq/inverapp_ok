import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePopup } from '../../contexts/PopupContext'; // Asegúrate que está importado si lo usas
import { Loader2, Save } from 'lucide-react';
import { PROMOTION_TYPES_ARRAY, PromotionType, AppliedPromotion } from '../../types'; // Ajusta la ruta

interface PromotionPopupProps {
  reservationId: string;
  onSave: (newPromotion: AppliedPromotion) => void;
  onClose: () => void;
  // existingPromotion?: AppliedPromotion; // Para futura edición
}

// Tipos de cuenta que ya usabas en el PromotionCard (si aplica) o define aquí
const ACCOUNT_TYPES_OPTIONS = [
  'Cuenta Corriente',
  'Cuenta Vista',
  'Cuenta de Ahorro'
];

const PromotionPopup: React.FC<PromotionPopupProps> = ({
  reservationId,
  onSave,
  onClose,
  // existingPromotion, // Para futura edición
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup(); // Si usas el contexto para cerrar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado inicial adaptado a la tabla 'promotions' y nuevos campos
  const [formData, setFormData] = useState<Omit<AppliedPromotion, 'id' | 'created_at' | 'updated_at' | 'created_by'>>({
    reservation_id: reservationId,
    promotion_type: PROMOTION_TYPES_ARRAY[0], // Valor por defecto
    amount: 0, // Este será tu amount_uf
    is_against_discount: true, // Por defecto true
    observations: '',
    beneficiary: '',
    rut: '',
    bank: '',
    account_type: ACCOUNT_TYPES_OPTIONS[0], // Valor por defecto
    account_number: '',
    email: '',
    purchase_order: '',
    document_number: '',
    document_date: null,
    payment_date: null,
  });

  // useEffect(() => { // Para futura edición de una promoción existente
  //   if (existingPromotion) {
  //     setFormData({
  //       reservation_id: existingPromotion.reservation_id,
  //       promotion_type: existingPromotion.promotion_type,
  //       amount: existingPromotion.amount,
  //       is_against_discount: existingPromotion.is_against_discount,
  //       observations: existingPromotion.observations || '',
  //       beneficiary: existingPromotion.beneficiary,
  //       rut: existingPromotion.rut,
  //       bank: existingPromotion.bank,
  //       account_type: existingPromotion.account_type,
  //       account_number: existingPromotion.account_number,
  //       email: existingPromotion.email,
  //       purchase_order: existingPromotion.purchase_order || '',
  //       document_number: existingPromotion.document_number || '',
  //       document_date: existingPromotion.document_date || null,
  //       payment_date: existingPromotion.payment_date || null,
  //     });
  //   }
  // }, [existingPromotion]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? null : value // Guardar como null si está vacío
    }));
  };


  const handleSave = async () => {
    if (formData.amount <= 0) {
      setError('El monto en UF debe ser un número positivo.');
      return;
    }
    if (!formData.promotion_type) {
      setError('Debe seleccionar un tipo de promoción.');
      return;
    }
    // Añade más validaciones si son necesarias para los campos de la tabla 'promotions'

    setLoading(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        created_by: session?.user?.id,
        updated_by: session?.user?.id,
        // Asegurar que las fechas vacías se envíen como null
        document_date: formData.document_date || null,
        payment_date: formData.payment_date || null,
        observations: formData.observations?.trim() === '' ? null : formData.observations?.trim(),
        purchase_order: formData.purchase_order?.trim() === '' ? null : formData.purchase_order?.trim(),
        document_number: formData.document_number?.trim() === '' ? null : formData.document_number?.trim(),
      };

      // Lógica para UPSERT o INSERT
      // const { data, error: saveError } = await supabase // Para edición futura
      //   .from('promotions')
      //   .upsert(existingPromotion ? { ...dataToSave, id: existingPromotion.id } : dataToSave)
      //   .select()
      //   .single();

      const { data, error: saveError } = await supabase
        .from('promotions') // Guardar en tu tabla 'promotions'
        .insert(dataToSave)
        .select()
        .single();

      if (saveError) {
        console.error('Error saving promotion:', saveError);
        throw saveError;
      }

      if (data) {
        onSave(data as AppliedPromotion);
      }
      hidePopup(); // Usa hidePopup si viene del contexto, sino onClose()
    } catch (err: any) {
      console.error('Error en handleSave:', err);
      setError(err.message || 'Ocurrió un error al guardar la promoción.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-xl w-full max-w-lg"> {/* Aumentado a max-w-lg */}
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Agregar Promoción
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> {/* Ajustado a grid de 2 columnas */}
        {/* Columna 1 */}
        <div>
          <label htmlFor="promotion_type" className="block text-sm font-medium text-gray-700">Tipo de Promoción *</label>
          <select id="promotion_type" name="promotion_type" value={formData.promotion_type} onChange={handleChange} required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            {PROMOTION_TYPES_ARRAY.map((type) => ( <option key={type} value={type}>{type}</option> ))}
          </select>
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Monto (UF) *</label>
          <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleChange} required min="0" step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2 flex items-center"> {/* Checkbox ocupa ambas columnas o se alinea */}
          <input id="is_against_discount" name="is_against_discount" type="checkbox" checked={formData.is_against_discount} onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
          <label htmlFor="is_against_discount" className="ml-2 block text-sm text-gray-900">Promoción Contra Descuento</label>
        </div>
        <div>
          <label htmlFor="beneficiary" className="block text-sm font-medium text-gray-700">Beneficiario</label>
          <input type="text" id="beneficiary" name="beneficiary" value={formData.beneficiary} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="rut" className="block text-sm font-medium text-gray-700">RUT Beneficiario</label>
          <input type="text" id="rut" name="rut" value={formData.rut} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Contacto</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>

        {/* Columna 2 */}
        <div>
          <label htmlFor="bank" className="block text-sm font-medium text-gray-700">Banco</label>
          <input type="text" id="bank" name="bank" value={formData.bank} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="account_type" className="block text-sm font-medium text-gray-700">Tipo de Cuenta</label>
          <select id="account_type" name="account_type" value={formData.account_type} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">Seleccione...</option>
            {ACCOUNT_TYPES_OPTIONS.map(type => (<option key={type} value={type}>{type}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">N° Cuenta</label>
          <input type="text" id="account_number" name="account_number" value={formData.account_number} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="purchase_order" className="block text-sm font-medium text-gray-700">N° OC</label>
          <input type="text" id="purchase_order" name="purchase_order" value={formData.purchase_order || ''} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="document_number" className="block text-sm font-medium text-gray-700">N° Documento (Fact/Bol)</label>
          <input type="text" id="document_number" name="document_number" value={formData.document_number || ''} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700">Fecha Emisión Doc.</label>
          <input type="date" id="document_date" name="document_date" value={formData.document_date || ''} onChange={handleDateChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div>
          <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">Fecha Pago Promoción</label>
          <input type="date" id="payment_date" name="payment_date" value={formData.payment_date || ''} onChange={handleDateChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
         <div className="md:col-span-2"> {/* Observaciones ocupa ambas columnas */}
          <label htmlFor="observations" className="block text-sm font-medium text-gray-700">Observaciones</label>
          <textarea id="observations" name="observations" rows={3} value={formData.observations || ''} onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Detalles adicionales..." />
        </div>
      </div>

      <div className="mt-8 flex justify-end space-x-3">
        <button type="button" onClick={onClose} disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Guardar Promoción
        </button>
      </div>
    </div>
  );
};

export default PromotionPopup;