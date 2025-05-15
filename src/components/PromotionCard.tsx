import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

export type PromotionType = 'Cashback' | 'Giftcard Ejecutivo' | 'Bono Ejecutivo' | 'Arriendo Asegurado';

export interface Promotion {
  id: string;
  type: PromotionType;
  amount: number;
  appliesAgainstDiscount: boolean;
}

interface PromotionCardProps {
  promotions: Promotion[];
  onAddPromotion: (promotion: Promotion) => void;
  onRemovePromotion: (id: string) => void;
  onUpdatePromotion: (promotion: Promotion) => void;
  totalPromotionsAmount: number;
}

const PROMOTION_TYPES: PromotionType[] = [
  'Cashback',
  'Giftcard Ejecutivo',
  'Bono Ejecutivo',
  'Arriendo Asegurado'
];

const PromotionCard: React.FC<PromotionCardProps> = ({
  promotions,
  onAddPromotion,
  onRemovePromotion,
  onUpdatePromotion,
  totalPromotionsAmount
}) => {
  const [newPromotion, setNewPromotion] = useState<{
    type: PromotionType;
    amount: number;
    appliesAgainstDiscount: boolean;
  }>({
    type: 'Cashback',
    amount: 0,
    appliesAgainstDiscount: false
  });

  const handleAddPromotion = () => {
    if (newPromotion.amount <= 0) {
      alert('El monto debe ser mayor a 0 UF');
      return;
    }

    onAddPromotion({
      id: Date.now().toString(),
      ...newPromotion
    });

    // Reset form
    setNewPromotion({
      type: 'Cashback',
      amount: 0,
      appliesAgainstDiscount: false
    });
  };

  const handlePromotionChange = (promotion: Promotion, field: keyof Promotion, value: any) => {
    const updatedPromotion = { ...promotion, [field]: value };
    onUpdatePromotion(updatedPromotion);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Promociones
      </h2>

      {/* Add new promotion form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
        <div>
          <label htmlFor="promotionType" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Promoción
          </label>
          <select
            id="promotionType"
            value={newPromotion.type}
            onChange={(e) => setNewPromotion({ ...newPromotion, type: e.target.value as PromotionType })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {PROMOTION_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="promotionAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Monto (UF)
          </label>
          <input
            type="number"
            id="promotionAmount"
            min="0"
            step="0.01"
            value={newPromotion.amount}
            onChange={(e) => setNewPromotion({ ...newPromotion, amount: parseFloat(e.target.value) || 0 })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="appliesAgainstDiscount"
            checked={newPromotion.appliesAgainstDiscount}
            onChange={(e) => setNewPromotion({ ...newPromotion, appliesAgainstDiscount: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="appliesAgainstDiscount" className="ml-2 block text-sm text-gray-700">
            Aplica contra descuento
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={handleAddPromotion}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agregar Promoción
          </button>
        </div>
      </div>

      {/* List of added promotions */}
      {promotions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-medium text-gray-700 mb-2">Promociones Agregadas</h3>
          <div className="border rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto (UF)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Contra Descuento</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promotion.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={promotion.amount}
                        onChange={(e) => handlePromotionChange(
                          promotion, 
                          'amount', 
                          parseFloat(e.target.value) || 0
                        )}
                        className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-right"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <input
                        type="checkbox"
                        checked={promotion.appliesAgainstDiscount}
                        onChange={(e) => handlePromotionChange(
                          promotion, 
                          'appliesAgainstDiscount', 
                          e.target.checked
                        )}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <button
                        onClick={() => onRemovePromotion(promotion.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Total Promociones
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(totalPromotionsAmount)} UF
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionCard;