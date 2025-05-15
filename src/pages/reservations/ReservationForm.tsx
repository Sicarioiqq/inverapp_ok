import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import PromotionPopup from '../../components/PromotionPopup';
import BrokerCommissionPopup from '../../components/BrokerCommissionPopup';
import { ArrowLeft, Save, Loader2, Search, UserPlus, Plus, Trash2 } from 'lucide-react'; // --- MODIFICACIÓN: Añadido Trash2 ---

// --- INICIO: Definiciones de Tipos para Promociones ---
export const PROMOTION_TYPES_ARRAY = [
  'Arriendo garantizado',
  'Cashback',
  'Giftcard',
  'Bono Ejecutivo',
  'Crédito al Pie',
  'Dividendo Garantizado'
] as const;

export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];

export interface AppliedPromotion {
  id: string; 
  reservation_id: string; 
  promotion_type: PromotionType;
  is_against_discount: boolean;
  observations?: string | null;
  amount: number; 
  beneficiary: string;
  rut: string;
  bank: string;
  account_type: string;
  account_number: string;
  email: string;
  purchase_order?: string | null;
  document_number?: string | null;
  document_date?: string | null; 
  payment_date?: string | null;  
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}
// --- FIN: Definiciones de Tipos para Promociones ---

interface Client { /* ... (sin cambios) ... */ }
interface Project { /* ... (sin cambios) ... */ }
interface Seller { /* ... (sin cambios) ... */ }
interface Broker { /* ... (sin cambios) ... */ }
interface ReservationFormData { /* ... (sin cambios) ... */ }

const ReservationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { session } = useAuthStore();
  const { showPopup, hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ReservationFormData>({
    reservation_number: '',
    client_id: '',
    project_id: '',
    seller_id: null,
    reservation_date: new Date().toISOString().split('T')[0],
    apartment_number: '',
    parking_number: '',
    storage_number: '',
    apartment_price: 0,
    parking_price: 0,
    storage_price: 0,
    column_discount: 0,
    additional_discount: 0,
    other_discount: 0,
    reservation_payment: 0,
    promise_payment: 0,
    down_payment: 0,
    credit_payment: 0,
    subsidy_payment: 0,
    is_with_broker: false,
    broker_id: null,
    is_rescinded: false,
  });

  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);

  useEffect(() => {
    fetchProjects();
    fetchSellers();
    fetchBrokers();
    if (!id) { 
      fetchDefaultSeller();
    }
    if (id) {
      fetchReservation(id);
      fetchAppliedPromotions(id);
    }
  }, [id]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (clientSearchTerm.trim()) {
        handleClientSearch();
      } else {
        setClients([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchTerm]);

  const totalListPrice = formData.apartment_price + formData.parking_price + formData.storage_price;
  const minimumPrice = (formData.apartment_price * (1 - formData.column_discount / 100) * (1 - formData.additional_discount / 100) * (1 - formData.other_discount / 100)) + formData.parking_price + formData.storage_price;
  const totalPayment = formData.reservation_payment + formData.promise_payment + formData.down_payment + formData.credit_payment + formData.subsidy_payment;
  const recoveryPayment = totalPayment - formData.subsidy_payment;

  const fetchDefaultSeller = async () => { /* ... (sin cambios) ... */ };
  const fetchSellers = async () => { /* ... (sin cambios) ... */ };
  const fetchBrokers = async () => { /* ... (sin cambios) ... */ };
  const fetchProjects = async () => { /* ... (sin cambios) ... */ };
  const fetchReservation = async (reservationId: string) => { /* ... (sin cambios) ... */ };
  const fetchAppliedPromotions = async (reservationId: string) => { /* ... (sin cambios) ... */ };
  const handleClientSearch = async () => { /* ... (sin cambios) ... */ };
  const handleSelectClient = (client: Client) => { /* ... (sin cambios) ... */ };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { /* ... (sin cambios) ... */ };
  const handleSubmit = async (e: React.FormEvent) => { /* ... (sin cambios, asegúrate que `is_rescinded` se incluya en el payload si existe en formData) ... */ };
  const createReservationFlow = async (reservationId: string, sellerId: string | null) => { /* ... (sin cambios) ... */ };
  const formatCurrency = (amount: number) => { /* ... (sin cambios) ... */ };
  const handleShowPromotionPopup = () => { /* ... (sin cambios en su lógica interna, solo cómo se llama onSave) ... */ };

  // --- NUEVA FUNCIÓN PARA ELIMINAR PROMOCIÓN ---
  const handleDeletePromotion = async (promotionId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta promoción? Esta acción no se puede deshacer.')) {
      return;
    }
    setLoading(true); // Podrías tener un estado de carga específico para promociones si prefieres
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionId);

      if (deleteError) {
        console.error('Error deleting promotion:', deleteError);
        throw deleteError;
      }

      // Actualizar el estado local para reflejar la eliminación
      setAppliedPromotions(prevPromotions => prevPromotions.filter(promo => promo.id !== promotionId));
      // Opcionalmente, mostrar una notificación de éxito
      alert('Promoción eliminada exitosamente.'); 

    } catch (err: any) {
      console.error('Error en handleDeletePromotion:', err);
      setError(err.message || 'Ocurrió un error al eliminar la promoción.');
      alert(`Error al eliminar la promoción: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  if (!selectedClient && !id) { /* ... (sin cambios) ... */ }
  if (loading && !selectedClient && id) { /* ... (sin cambios) ... */ }
  if (!selectedClient && id && !loading) { /* ... (sin cambios) ... */ }
  if (!selectedClient && !id && loading) { /* ... (sin cambios) ... */ }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header (sin cambios) */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/reservas')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Editar Reserva' : 'Nueva Reserva'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (<div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>)}

          {/* Cliente Seleccionado (sin cambios) */}
          {selectedClient && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Cliente</h2>
                {!id && (
                     <button type="button" onClick={() => { setSelectedClient(null); setFormData(prev => ({...prev, client_id: ''})); }} className="text-sm text-blue-600 hover:text-blue-800">Cambiar Cliente</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Nombre Completo</label><div className="mt-1 text-gray-900">{selectedClient.first_name} {selectedClient.last_name}</div></div>
                <div><label className="block text-sm font-medium text-gray-700">RUT</label><div className="mt-1 text-gray-900">{selectedClient.rut}</div></div>
              </div>
            </div>
          )}

          {/* Información Básica (sin cambios) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
            {/* ... (resto de los campos de información básica) ... */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label htmlFor="reservation_number" className="block text-sm font-medium text-gray-700">N° Reserva *</label><input type="text" id="reservation_number" name="reservation_number" required value={formData.reservation_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
              <div><label htmlFor="project_id" className="block text-sm font-medium text-gray-700">Proyecto *</label><select id="project_id" name="project_id" required value={formData.project_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"><option value="">Seleccione un proyecto</option>{projects.map(project => (<option key={project.id} value={project.id}>{project.name} {project.stage}</option>))}</select></div>
              <div><label htmlFor="seller_id" className="block text-sm font-medium text-gray-700">Vendedor</label><select id="seller_id" name="seller_id" value={formData.seller_id || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"><option value="">Seleccione un vendedor</option>{sellers.map(seller => (<option key={seller.id} value={seller.id}>{`${seller.first_name} ${seller.last_name}`}</option>))}</select></div>
              <div><label htmlFor="reservation_date" className="block text-sm font-medium text-gray-700">Fecha de Reserva *</label><input type="date" id="reservation_date" name="reservation_date" required value={formData.reservation_date} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
              <div className="md:col-span-2">
                <div className="flex items-center mb-4">
                  <input type="checkbox" id="is_with_broker" name="is_with_broker" checked={formData.is_with_broker} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                  <label htmlFor="is_with_broker" className="ml-2 block text-sm text-gray-700">Venta con Broker</label>
                </div>
                {formData.is_with_broker && (
                  <div><label htmlFor="broker_id" className="block text-sm font-medium text-gray-700">Broker *</label><select id="broker_id" name="broker_id" required={formData.is_with_broker} value={formData.broker_id || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"><option value="">Seleccione un broker</option>{brokers.map(broker => (<option key={broker.id} value={broker.id}>{broker.name} - {broker.business_name}</option>))}</select></div>
                )}
              </div>
            </div>
          </div>

          {/* Unidades y Precios Lista (sin cambios) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* ... (contenido de unidades y precios) ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> <h2 className="text-lg font-semibold text-gray-900 mb-4">Unidades</h2> <div className="space-y-4"> <div><label htmlFor="apartment_number" className="block text-sm font-medium text-gray-700">N° Departamento *</label><input type="text" id="apartment_number" name="apartment_number" required value={formData.apartment_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="parking_number" className="block text-sm font-medium text-gray-700">N° Estacionamiento</label><input type="text" id="parking_number" name="parking_number" value={formData.parking_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="storage_number" className="block text-sm font-medium text-gray-700">N° Bodega</label><input type="text" id="storage_number" name="storage_number" value={formData.storage_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div></div></div>
                <div> <h2 className="text-lg font-semibold text-gray-900 mb-4">Precios Lista</h2> <div className="space-y-4"> <div><label htmlFor="apartment_price" className="block text-sm font-medium text-gray-700">Precio Departamento *</label><input type="number" id="apartment_price" name="apartment_price" required min="0" step="0.01" value={formData.apartment_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="parking_price" className="block text-sm font-medium text-gray-700">Precio Estacionamiento</label><input type="number" id="parking_price" name="parking_price" min="0" step="0.01" value={formData.parking_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="storage_price" className="block text-sm font-medium text-gray-700">Precio Bodega</label><input type="number" id="storage_price" name="storage_price" min="0" step="0.01" value={formData.storage_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label className="block text-sm font-medium text-gray-700">Total Lista</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(totalListPrice)} UF</div></div></div></div>
            </div>
          </div>

          {/* Descuentos y Forma de Pago (sin cambios) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* ... (contenido de descuentos y forma de pago) ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> <h2 className="text-lg font-semibold text-gray-900 mb-4">Descuentos</h2> <div className="space-y-4"> <div><label htmlFor="column_discount" className="block text-sm font-medium text-gray-700">Descuento Columna (%)</label><input type="number" id="column_discount" name="column_discount" min="0" max="100" step="0.001" value={formData.column_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="additional_discount" className="block text-sm font-medium text-gray-700">Descuento Adicional (%)</label><input type="number" id="additional_discount" name="additional_discount" min="0" max="100" step="0.001" value={formData.additional_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="other_discount" className="block text-sm font-medium text-gray-700">Otros Descuentos (%)</label><input type="number" id="other_discount" name="other_discount" min="0" max="100" step="0.001" value={formData.other_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label className="block text-sm font-medium text-gray-700">Precio Mínimo</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(minimumPrice)} UF</div></div></div></div>
                <div> <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pago</h2> <div className="space-y-4"> <div><label htmlFor="reservation_payment" className="block text-sm font-medium text-gray-700">Reserva</label><input type="number" id="reservation_payment" name="reservation_payment" min="0" step="0.01" value={formData.reservation_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="promise_payment" className="block text-sm font-medium text-gray-700">Promesa</label><input type="number" id="promise_payment" name="promise_payment" min="0" step="0.01" value={formData.promise_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="down_payment" className="block text-sm font-medium text-gray-700">Pie</label><input type="number" id="down_payment" name="down_payment" min="0" step="0.01" value={formData.down_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="credit_payment" className="block text-sm font-medium text-gray-700">Crédito</label><input type="number" id="credit_payment" name="credit_payment" min="0" step="0.01" value={formData.credit_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label htmlFor="subsidy_payment" className="block text-sm font-medium text-gray-700">Bono Pie</label><input type="number" id="subsidy_payment" name="subsidy_payment" min="0" step="0.01" value={formData.subsidy_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div><div><label className="block text-sm font-medium text-gray-700">Total Escrituración</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(totalPayment)} UF</div></div><div><label className="block text-sm font-medium text-gray-700">Total Recuperación</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(recoveryPayment)} UF</div></div></div></div>
            </div>
          </div>

          {/* --- SECCIÓN MODIFICADA Y AMPLIADA: Promociones Aplicadas --- */}
          {id && ( 
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Promociones Aplicadas</h2>
                <button
                  type="button"
                  onClick={handleShowPromotionPopup}
                  disabled={!id || loading} 
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Agregar Promoción
                </button>
              </div>
              {appliedPromotions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {appliedPromotions.map((promo) => (
                    <div key={promo.id} className="p-4 border rounded-md bg-slate-50 shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-blue-700">
                            {promo.promotion_type}
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(promo.amount)} UF
                          </p>
                        </div>
                        {/* --- NUEVO: Botón para Eliminar Promoción --- */}
                        <button 
                          type="button" // Importante para no hacer submit del form principal
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                          title="Eliminar Promoción"
                          disabled={loading} // Deshabilitar mientras se guarda la reserva
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                      <p className={`text-sm font-medium ${promo.is_against_discount ? 'text-orange-600' : 'text-green-600'}`}>
                        {promo.is_against_discount ? 'Es Contra Descuento' : 'No es Contra Descuento'}
                      </p>
                      {promo.observations && (
                        <p className="text-sm text-gray-600 mt-1 italic">
                          Obs: {promo.observations}
                        </p>
                      )}
                      <div className="mt-3 text-xs text-gray-500 border-t pt-3 space-y-1">
                        <p><strong>Beneficiario:</strong> {promo.beneficiary || 'N/D'}{promo.rut && ` (RUT: ${promo.rut})`}</p>
                        {promo.email && <p><strong>Email:</strong> {promo.email}</p>}
                        {(promo.bank || promo.account_type || promo.account_number) && 
                          <p><strong>Banco:</strong> {promo.bank || 'N/D'}, Tipo Cta: {promo.account_type || 'N/D'}, N° Cta: {promo.account_number || 'N/D'}</p>
                        }
                        {promo.purchase_order && <p><strong>N° OC:</strong> {promo.purchase_order}</p>}
                        {promo.document_number && <p><strong>Doc. N°:</strong> {promo.document_number} {promo.document_date ? `(Fecha: ${formatDate(promo.document_date)})` : ''}</p>}
                        {promo.payment_date && <p><strong>Fecha Pago Promoción:</strong> {formatDate(promo.payment_date)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay promociones aplicadas a esta reserva.</p>
              )}
            </div>
          )}
          {/* --- FIN SECCIÓN MODIFICADA --- */}

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="submit"
              disabled={loading || (!id && !selectedClient)} // También deshabilitar si es nueva y no hay cliente
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? ( <><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</> ) : ( <><Save className="h-5 w-5 mr-2" />Guardar Reserva</> )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ReservationForm;