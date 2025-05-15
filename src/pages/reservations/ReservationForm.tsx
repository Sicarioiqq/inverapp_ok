import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile } from '../../lib/supabase'; // Asegúrate que formatDateChile esté aquí o impórtalo desde dateUtils si es necesario
import { useAuthStore } from '../../stores/authStore';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import PromotionPopup from '../../components/PromotionPopup';
import BrokerCommissionPopup from '../../components/BrokerCommissionPopup';
import { ArrowLeft, Save, Loader2, Search, UserPlus, Plus } from 'lucide-react'; // Añadido Plus si no estaba

// --- INICIO: Definiciones de Tipos para Promociones (ajusta la ruta si los mueves a un archivo types.ts) ---
export const PROMOTION_TYPES_ARRAY = [
  'Arriendo garantizado',
  'Cashback',
  'Giftcard',
  'Bono Ejecutivo',
  'Crédito al Pie',
  'Dividendo Garantizado'
] as const;

export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];

// Interfaz basada en tu tabla 'promotions' existente + nuevos campos
export interface AppliedPromotion {
  id: string; // UUID de la promoción
  reservation_id: string; // UUID de la reserva a la que pertenece

  // Nuevos campos que añadiste a la tabla 'promotions'
  promotion_type: PromotionType;
  amount: number; // Este es el campo que dijiste que es para UF en tu tabla 'promotions'
  is_against_discount: boolean;
  observations?: string | null;

  // Campos existentes de tu tabla 'promotions' (según la imagen que mostraste)
  beneficiary: string;
  rut: string;
  bank: string;
  account_type: string;
  account_number: string;
  email: string;
  purchase_order?: string | null;
  document_number?: string | null;
  document_date?: string | null; // Fecha como string YYYY-MM-DD
  payment_date?: string | null;  // Fecha como string YYYY-MM-DD

  created_at?: string;
  updated_at?: string;
  created_by?: string;
  // updated_by?: string; // No visible en la imagen, pero común
}
// --- FIN: Definiciones de Tipos para Promociones ---

interface Client {
  id: string;
  rut: string;
  first_name: string;
  last_name: string;
}

interface Project {
  id: string;
  name: string;
  stage: string;
}

interface Seller {
  id: string;
  first_name: string;
  last_name: string;
}

interface Broker {
  id: string;
  name: string;
  business_name: string;
}

interface ReservationFormData {
  reservation_number: string;
  client_id: string;
  project_id: string;
  seller_id: string | null;
  reservation_date: string;
  apartment_number: string;
  parking_number: string;
  storage_number: string;
  apartment_price: number;
  parking_price: number;
  storage_price: number;
  column_discount: number;
  additional_discount: number;
  other_discount: number;
  reservation_payment: number;
  promise_payment: number;
  down_payment: number;
  credit_payment: number;
  subsidy_payment: number;
  is_with_broker: boolean;
  broker_id: string | null;
  is_rescinded?: boolean; // Añadido para mantener consistencia con tu handleSubmit
}

const ReservationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // id de la reserva (si se está editando)
  const { session } = useAuthStore();
  const { showPopup, hidePopup } = usePopup(); // Añadido hidePopup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [showClientForm, setShowClientForm] = useState(false); // No parece usarse
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isSearchingClient, setIsSearchingClient] = useState(false); // Renombrado para claridad
  // const [defaultSeller, setDefaultSeller] = useState<string | null>(null); // No parece usarse directamente después de setear formData
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

  // --- NUEVO ESTADO PARA PROMOCIONES ---
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);

  useEffect(() => {
    fetchProjects();
    fetchSellers();
    fetchBrokers();
    fetchDefaultSeller(); // Esto setea el seller_id en formData si existe un default
    if (id) {
      fetchReservation(id); // Pasar id a fetchReservation
      fetchAppliedPromotions(id); // --- NUEVA LLAMADA ---
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
  const minimumPrice = (
    formData.apartment_price *
    (1 - formData.column_discount / 100) *
    (1 - formData.additional_discount / 100) *
    (1 - formData.other_discount / 100)
  ) + formData.parking_price + formData.storage_price;
  const totalPayment =
    formData.reservation_payment +
    formData.promise_payment +
    formData.down_payment +
    formData.credit_payment +
    formData.subsidy_payment;
  const recoveryPayment = totalPayment - formData.subsidy_payment;

  const fetchDefaultSeller = async () => {
    try {
      const { data, error: defaultSellerError } = await supabase
        .from('default_seller')
        .select('user_id')
        .maybeSingle();
      if (defaultSellerError) throw defaultSellerError;
      if (data && !id) { // Solo aplicar vendedor por defecto si es nueva reserva y no se ha cargado una existente
        setFormData(prev => ({ ...prev, seller_id: data.user_id }));
        // setDefaultSeller(data.user_id); // No es necesario si se setea directamente en formData
      }
    } catch (err: any) {
      console.error('Error in fetchDefaultSeller:', err);
      setError(err.message);
    }
  };

  const fetchSellers = async () => { /* ... (sin cambios) ... */ };
  const fetchBrokers = async () => { /* ... (sin cambios) ... */ };
  const fetchProjects = async () => { /* ... (sin cambios) ... */ };

  const fetchReservation = async (reservationId: string) => { // Hacer que acepte el ID
    try {
      setLoading(true);
      setError(null);
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId) // Usar el ID pasado como argumento
        .single();
      if (reservationError) throw new Error(`Error al cargar la reserva: ${reservationError.message}`);
      if (!reservationData) throw new Error('No se encontró la reserva');

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, rut, first_name, last_name')
        .eq('id', reservationData.client_id)
        .single();
      if (clientError) throw new Error(`Error al cargar el cliente: ${clientError.message}`);
      if (!clientData) throw new Error('No se encontró el cliente asociado a la reserva');

      setFormData({
        ...(reservationData as unknown as ReservationFormData), // Casting si los campos generados ya no están en ReservationFormData
        reservation_date: reservationData.reservation_date.split('T')[0],
        column_discount: (reservationData.column_discount || 0) * 100,
        additional_discount: (reservationData.additional_discount || 0) * 100,
        other_discount: (reservationData.other_discount || 0) * 100,
      });
      setSelectedClient(clientData);
      // Ya no se obtienen promociones desde aquí, se usa fetchAppliedPromotions
    } catch (err: any) {
      console.error('Error in fetchReservation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN PARA OBTENER PROMOCIONES ---
  const fetchAppliedPromotions = async (reservationId: string) => {
    if (!reservationId) return;
    try {
      const { data, error: promoError } = await supabase
        .from('promotions') // Leer de tu tabla 'promotions'
        .select('*') // Seleccionar todos los campos, incluyendo los nuevos
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: true });

      if (promoError) {
        console.error('Error fetching applied promotions:', promoError);
        throw promoError;
      }
      setAppliedPromotions(data as AppliedPromotion[] || []);
    } catch (err: any) {
      console.error('Error en fetchAppliedPromotions:', err);
      setError(prevError => prevError ? `${prevError}\nError al cargar promociones: ${err.message}` : `Error al cargar promociones: ${err.message}`);
    }
  };


  const handleClientSearch = async () => {
    if (!clientSearchTerm.trim()) { setClients([]); return; }
    try {
      setIsSearchingClient(true);
      const { data, error: searchError } = await supabase
        .from('clients')
        .select('*')
        .or(`rut.ilike.%${clientSearchTerm}%,first_name.ilike.%${clientSearchTerm}%,last_name.ilike.%${clientSearchTerm}%`)
        .is('deleted_at', null)
        .order('first_name').limit(5);
      if (searchError) throw searchError;
      setClients(data || []);
    } catch (err: any) { console.error('Error in handleClientSearch:', err); setError(err.message); }
    finally { setIsSearchingClient(false); }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setFormData(prev => ({ ...prev, client_id: client.id }));
    setClients([]);
    setClientSearchTerm('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked, broker_id: name === 'is_with_broker' && !checked ? null : prev.broker_id }));
    } else if (name === 'column_discount' || name === 'additional_discount' || name === 'other_discount') {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: Math.min(100, Math.max(0, numValue)) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      if (!formData.reservation_number.trim()) throw new Error('El número de reserva es obligatorio');
      if (!formData.client_id) throw new Error('Debe seleccionar un cliente.');
      if (!formData.project_id) throw new Error('Debe seleccionar un proyecto.');
      if (!formData.apartment_number.trim()) throw new Error('El número de departamento es obligatorio.');


      // Objeto con los datos a guardar/actualizar en la tabla 'reservations'
      // SIN los campos de promoción que ahora están en la tabla 'promotions'
      // Y SIN los campos calculados que la BD maneja.
      const reservationPayload: any = {
        reservation_number: formData.reservation_number,
        client_id: formData.client_id,
        project_id: formData.project_id,
        seller_id: formData.seller_id,
        reservation_date: formData.reservation_date,
        apartment_number: formData.apartment_number,
        parking_number: formData.parking_number || null,
        storage_number: formData.storage_number || null,
        apartment_price: formData.apartment_price,
        parking_price: formData.parking_price,
        storage_price: formData.storage_price,
        column_discount: formData.column_discount / 100,
        additional_discount: formData.additional_discount / 100,
        other_discount: formData.other_discount / 100,
        reservation_payment: formData.reservation_payment,
        promise_payment: formData.promise_payment,
        down_payment: formData.down_payment,
        credit_payment: formData.credit_payment,
        subsidy_payment: formData.subsidy_payment,
        is_with_broker: formData.is_with_broker,
        broker_id: formData.is_with_broker ? formData.broker_id : null,
        is_rescinded: formData.is_rescinded,
        updated_by: session?.user.id,
      };
      
      if (!id) { // Solo para nuevas reservas
        reservationPayload.created_by = session?.user.id;
      } else { // Para ediciones
        reservationPayload.id = id;
      }

      const { data: upsertedReservation, error: upsertError } = await supabase
        .from('reservations')
        .upsert([reservationPayload]) // upsert espera un array
        .select()
        .single();

      if (upsertError) throw upsertError;
      if (!upsertedReservation) throw new Error('No se pudo crear/actualizar la reserva');

      const currentReservationId = upsertedReservation.id;

      if (!id) { // Si es una nueva reserva, crear flujo y luego permitir gestionar promociones
        await createReservationFlow(currentReservationId, formData.seller_id);
         // Navegar a la página de edición para que el ID esté en la URL y se puedan agregar promociones.
        if (formData.is_with_broker && formData.broker_id) {
            // Mostrar popup de comisión SOLO en creación
            showPopup(
                <BrokerCommissionPopup
                  reservationId={currentReservationId}
                  brokerId={formData.broker_id!}
                  onSave={() => {
                    hidePopup();
                    navigate(`/reservas/editar/${currentReservationId}`, { replace: true }); // Navega a editar para agregar promociones
                  }}
                  onClose={async () => {
                    hidePopup();
                    // Si se cierra el popup sin guardar comisión en una NUEVA reserva,
                    // se podría eliminar la reserva y su flujo, o simplemente navegar.
                    // Actualmente se eliminan.
                    try {
                      await supabase.from('reservation_flows').delete().eq('reservation_id', currentReservationId);
                      await supabase.from('reservations').delete().eq('id', currentReservationId);
                      navigate('/reservas'); // Volver a la lista si se cancela todo
                    } catch (deleteError) {
                      console.error("Error cleaning up reservation:", deleteError);
                      navigate('/reservas');
                    }
                  }}
                />,
                { title: 'Comisión del Broker', size: 'md', isDismissable: false }
              );
        } else {
            navigate(`/reservas/editar/${currentReservationId}`, { replace: true });
        }

      } else { // Si es una edición
        if (formData.is_with_broker && formData.broker_id) {
             // Si se está editando y es con broker, solo navegar (el popup de comisión no se muestra en edición)
            navigate('/reservas');
        } else {
            navigate('/reservas');
        }
      }
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createReservationFlow = async (reservationId: string, sellerId: string | null) => { /* ... (sin cambios) ... */ };
  const formatCurrency = (amount: number) => { /* ... (sin cambios) ... */ };

  // --- MODIFICACIÓN de handleShowPromotionPopup ---
  const handleShowPromotionPopup = () => {
    if (!id) { // Si es una nueva reserva y aún no tiene ID (no se ha guardado)
      alert('Debe guardar la reserva primero para poder agregar promociones.');
      // Alternativamente, podrías deshabilitar el botón "Agregar Promoción" si !id
      return;
    }
    showPopup(
      <PromotionPopup
        reservationId={id} // 'id' es el id de la reserva actual que se está editando
        onSave={(newPromotion) => { // newPromotion es del tipo AppliedPromotion
          setAppliedPromotions(prev => [...prev, newPromotion]);
          hidePopup(); // Cierra el popup de promoción después de guardar
        }}
        onClose={hidePopup} // Usa hidePopup del contexto
      />,
      { title: 'Agregar Promoción', size: 'lg' } // Puedes ajustar el tamaño a 'lg' o 'xl' si el form es grande
    );
  };


  if (!selectedClient && !id) { // Ajuste para mostrar búsqueda de cliente solo si es nueva reserva y no hay cliente seleccionado
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/reservas')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="h-5 w-5 mr-2" />Volver</button>
            <h1 className="text-2xl font-semibold text-gray-900">Nueva Reserva</h1>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Buscar Cliente</h2>
            <div className="relative">
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input type="text" placeholder="Buscar por RUT o nombre..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} ref={searchInputRef}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <button onClick={() => navigate('/clientes/nuevo')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                  <UserPlus className="h-5 w-5" />
                </button>
              </div>
              {isSearchingClient && (<div className="absolute inset-x-0 top-full mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 flex justify-center"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /></div>)}
              {clients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
                  <ul className="py-1 max-h-60 overflow-y-auto"> {/* Añadido max-h y overflow */}
                    {clients.map((client) => (
                      <li key={client.id}>
                        <button onClick={() => handleSelectClient(client)} className="w-full px-4 py-2 text-left hover:bg-gray-100">
                          <div className="font-medium">{client.first_name} {client.last_name}</div>
                          <div className="text-sm text-gray-500">{client.rut}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  
  // Si estamos editando (id existe) o ya se seleccionó un cliente para una nueva reserva
  if (loading && !selectedClient && id) { // Muestra loader principal si está cargando la reserva y aún no hay cliente (para edición)
    return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>;
  }
  if (!selectedClient && id) { // Si es modo edición y el cliente aún no carga (o hay error)
    return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg">{error || 'Cargando datos de reserva...'}</div></Layout>;
  }


  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/reservas')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Editar Reserva' : 'Nueva Reserva'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (<div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>)}

          {selectedClient && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Cliente</h2>
                {!id && ( // Solo permitir cambiar cliente si es NUEVA reserva y aún no se ha guardado
                     <button type="button" onClick={() => { setSelectedClient(null); setFormData(prev => ({...prev, client_id: ''})); }} className="text-sm text-blue-600 hover:text-blue-800">Cambiar Cliente</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Nombre Completo</label><div className="mt-1 text-gray-900">{selectedClient.first_name} {selectedClient.last_name}</div></div>
                <div><label className="block text-sm font-medium text-gray-700">RUT</label><div className="mt-1 text-gray-900">{selectedClient.rut}</div></div>
              </div>
            </div>
          )}

          {/* Información Básica (sin cambios en la estructura interna, solo los campos de promoción ya no están) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="reservation_number" className="block text-sm font-medium text-gray-700">N° Reserva *</label>
                <input type="text" id="reservation_number" name="reservation_number" required value={formData.reservation_number} onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>
              </div>
              <div>
                <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">Proyecto *</label>
                <select id="project_id" name="project_id" required value={formData.project_id} onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value="">Seleccione un proyecto</option>
                  {projects.map(project => (<option key={project.id} value={project.id}>{project.name} {project.stage}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="seller_id" className="block text-sm font-medium text-gray-700">Vendedor</label>
                <select id="seller_id" name="seller_id" value={formData.seller_id || ''} onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value="">Seleccione un vendedor</option>
                  {sellers.map(seller => (<option key={seller.id} value={seller.id}>{`${seller.first_name} ${seller.last_name}`}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="reservation_date" className="block text-sm font-medium text-gray-700">Fecha de Reserva *</label>
                <input type="date" id="reservation_date" name="reservation_date" required value={formData.reservation_date} onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center mb-4">
                  <input type="checkbox" id="is_with_broker" name="is_with_broker" checked={formData.is_with_broker} onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                  <label htmlFor="is_with_broker" className="ml-2 block text-sm text-gray-700">Venta con Broker</label>
                </div>
                {formData.is_with_broker && (
                  <div>
                    <label htmlFor="broker_id" className="block text-sm font-medium text-gray-700">Broker *</label>
                    <select id="broker_id" name="broker_id" required={formData.is_with_broker} value={formData.broker_id || ''} onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                      <option value="">Seleccione un broker</option>
                      {brokers.map(broker => (<option key={broker.id} value={broker.id}>{broker.name} - {broker.business_name}</option>))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unidades y Precios Lista (sin cambios) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> {/* Unidades */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Unidades</h2>
                    <div className="space-y-4">
                        <div><label htmlFor="apartment_number" className="block text-sm font-medium text-gray-700">N° Departamento *</label><input type="text" id="apartment_number" name="apartment_number" required value={formData.apartment_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="parking_number" className="block text-sm font-medium text-gray-700">N° Estacionamiento</label><input type="text" id="parking_number" name="parking_number" value={formData.parking_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="storage_number" className="block text-sm font-medium text-gray-700">N° Bodega</label><input type="text" id="storage_number" name="storage_number" value={formData.storage_number} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                    </div>
                </div>
                <div> {/* Precios Lista */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Precios Lista</h2>
                    <div className="space-y-4">
                        <div><label htmlFor="apartment_price" className="block text-sm font-medium text-gray-700">Precio Departamento *</label><input type="number" id="apartment_price" name="apartment_price" required min="0" step="0.01" value={formData.apartment_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="parking_price" className="block text-sm font-medium text-gray-700">Precio Estacionamiento</label><input type="number" id="parking_price" name="parking_price" min="0" step="0.01" value={formData.parking_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="storage_price" className="block text-sm font-medium text-gray-700">Precio Bodega</label><input type="number" id="storage_price" name="storage_price" min="0" step="0.01" value={formData.storage_price} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Total Lista</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(totalListPrice)} UF</div></div>
                    </div>
                </div>
            </div>
          </div>

          {/* Descuentos y Forma de Pago (sin cambios) */}
          <div className="bg-white rounded-lg shadow-md p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div> {/* Descuentos */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Descuentos</h2>
                    <div className="space-y-4">
                        <div><label htmlFor="column_discount" className="block text-sm font-medium text-gray-700">Descuento Columna (%)</label><input type="number" id="column_discount" name="column_discount" min="0" max="100" step="0.001" value={formData.column_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="additional_discount" className="block text-sm font-medium text-gray-700">Descuento Adicional (%)</label><input type="number" id="additional_discount" name="additional_discount" min="0" max="100" step="0.001" value={formData.additional_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="other_discount" className="block text-sm font-medium text-gray-700">Otros Descuentos (%)</label><input type="number" id="other_discount" name="other_discount" min="0" max="100" step="0.001" value={formData.other_discount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Precio Mínimo</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(minimumPrice)} UF</div></div>
                    </div>
                </div>
                <div> {/* Forma de Pago */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pago</h2>
                    <div className="space-y-4">
                        <div><label htmlFor="reservation_payment" className="block text-sm font-medium text-gray-700">Reserva</label><input type="number" id="reservation_payment" name="reservation_payment" min="0" step="0.01" value={formData.reservation_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="promise_payment" className="block text-sm font-medium text-gray-700">Promesa</label><input type="number" id="promise_payment" name="promise_payment" min="0" step="0.01" value={formData.promise_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="down_payment" className="block text-sm font-medium text-gray-700">Pie</label><input type="number" id="down_payment" name="down_payment" min="0" step="0.01" value={formData.down_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="credit_payment" className="block text-sm font-medium text-gray-700">Crédito</label><input type="number" id="credit_payment" name="credit_payment" min="0" step="0.01" value={formData.credit_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label htmlFor="subsidy_payment" className="block text-sm font-medium text-gray-700">Bono Pie</label><input type="number" id="subsidy_payment" name="subsidy_payment" min="0" step="0.01" value={formData.subsidy_payment} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Total Escrituración</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(totalPayment)} UF</div></div>
                        <div><label className="block text-sm font-medium text-gray-700">Total Recuperación</label><div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">{formatCurrency(recoveryPayment)} UF</div></div>
                    </div>
                </div>
            </div>
          </div>

          {/* --- NUEVA SECCIÓN: Promociones Aplicadas --- */}
          {id && ( // Solo mostrar si la reserva ya existe (tiene ID)
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Promociones Aplicadas</h2>
                <button
                  type="button"
                  onClick={handleShowPromotionPopup}
                  disabled={!id || loading} // Deshabilitar si no hay ID o está cargando
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Agregar Promoción
                </button>
              </div>
              {appliedPromotions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto"> {/* Contenedor con scroll si hay muchas promociones */}
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
                         {/* Aquí podrías añadir botones para editar/eliminar promociones en el futuro */}
                         {/* <div className="flex space-x-2">
                            <button type="button" onClick={() => handleEditPromotion(promo)} className="p-1 text-blue-500 hover:text-blue-700"><Edit className="h-4 w-4"/></button>
                            <button type="button" onClick={() => handleDeletePromotion(promo.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4"/></button>
                          </div>
                         */}
                      </div>
                      <p className={`text-sm ${promo.is_against_discount ? 'text-orange-600' : 'text-green-600'}`}>
                        {promo.is_against_discount ? 'Es Contra Descuento' : 'No es Contra Descuento'}
                      </p>
                      {promo.observations && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Obs:</span> {promo.observations}
                        </p>
                      )}
                      <div className="mt-3 text-xs text-gray-500 border-t pt-2 space-y-1">
                        <p><strong>Beneficiario:</strong> {promo.beneficiary || 'N/A'} (RUT: {promo.rut || 'N/A'})</p>
                        <p><strong>Contacto:</strong> {promo.email || 'N/A'}</p>
                        <p><strong>Banco:</strong> {promo.bank || 'N/A'}, Tipo Cta: {promo.account_type || 'N/A'}, N° Cta: {promo.account_number || 'N/A'}</p>
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
          {/* --- FIN NUEVA SECCIÓN --- */}


          <div className="flex justify-end space-x-4 mt-8"> {/* Añadido mt-8 para separar del último bloque */}
            {/* El botón de Agregar Promoción ahora está en la sección de promociones si id existe */}
            <button
              type="submit"
              disabled={loading || !selectedClient} // Deshabilitar si no hay cliente seleccionado
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>
              ) : (
                <><Save className="h-5 w-5 mr-2" />Guardar Reserva</>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ReservationForm;