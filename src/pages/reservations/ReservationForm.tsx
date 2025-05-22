import React, { useState, useEffect, useRef } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { supabase } from '../../lib/supabase';

import { useAuthStore } from '../../stores/authStore';

import { usePopup } from '../../contexts/PopupContext';

import Layout from '../../components/Layout';

import PromotionPopup from '../../components/PromotionPopup';

import BrokerCommissionPopup from '../../components/BrokerCommissionPopup';

import { ArrowLeft, Save, Loader2, Search, UserPlus } from 'lucide-react';



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

}



const ReservationForm = () => {

  const navigate = useNavigate();

  const { id } = useParams();

  const { session } = useAuthStore();

  const { showPopup } = usePopup();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showClientForm, setShowClientForm] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);

  const [sellers, setSellers] = useState<Seller[]>([]);

  const [brokers, setBrokers] = useState<Broker[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const [isSearching, setIsSearching] = useState(false);

  const [defaultSeller, setDefaultSeller] = useState<string | null>(null);

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

    broker_id: null

  });



  useEffect(() => {

    fetchProjects();

    fetchSellers();

    fetchBrokers();

    fetchDefaultSeller();

    if (id) {

      fetchReservation();

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



  // Calcular totales

  const totalListPrice = formData.apartment_price + formData.parking_price + formData.storage_price;

  

  const minimumPrice = (

    formData.apartment_price * 

    (1 - formData.column_discount/100) * 

    (1 - formData.additional_discount/100) * 

    (1 - formData.other_discount/100)

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

      const { data, error } = await supabase

        .from('default_seller')

        .select('user_id')

        .maybeSingle();



      if (error) throw error;

      if (data) {

        setFormData(prev => ({

          ...prev,

          seller_id: data.user_id

        }));

        setDefaultSeller(data.user_id);

      }

    } catch (err: any) {

      setError(err.message);

    }

  };



  const fetchSellers = async () => {

    try {

      const { data, error } = await supabase

        .from('profiles')

        .select('id, first_name, last_name')

        .eq('is_seller', true)

        .order('first_name');



      if (error) throw error;

      setSellers(data || []);

    } catch (err: any) {

      setError(err.message);

    }

  };



  const fetchBrokers = async () => {

    try {

      const { data, error } = await supabase

        .from('brokers')

        .select('id, name, business_name')

        .order('name');



      if (error) throw error;

      setBrokers(data || []);

    } catch (err: any) {

      setError(err.message);

    }

  };



  const fetchProjects = async () => {

    try {

      const { data, error } = await supabase

        .from('projects')

        .select('id, name, stage')

        .order('name');



      if (error) throw error;

      setProjects(data || []);

    } catch (err: any) {

      setError(err.message);

    }

  };



  const fetchReservation = async () => {

    try {

      setLoading(true);

      setError(null);

      

      // First verify the ID is valid

      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {

        throw new Error('ID de reserva inválido');

      }



      // Fetch reservation data with specific columns

      const { data: reservationData, error: reservationError } = await supabase

        .from('reservations')

        .select(`

          reservation_number,

          client_id,

          project_id,

          seller_id,

          reservation_date,

          apartment_number,

          parking_number,

          storage_number,

          apartment_price,

          parking_price,

          storage_price,

          column_discount,

          additional_discount,

          other_discount,

          reservation_payment,

          promise_payment,

          down_payment,

          credit_payment,

          subsidy_payment,

          is_with_broker,

          broker_id

        `)

        .eq('id', id)

        .single();



      if (reservationError) {

        console.error('Error fetching reservation:', reservationError);

        throw new Error('Error al cargar la reserva: ' + reservationError.message);

      }



      if (!reservationData) {

        throw new Error('No se encontró la reserva');

      }



      // Fetch client data separately

      const { data: clientData, error: clientError } = await supabase

        .from('clients')

        .select('id, rut, first_name, last_name')

        .eq('id', reservationData.client_id)

        .single();



      if (clientError) {

        console.error('Error fetching client:', clientError);

        throw new Error('Error al cargar el cliente: ' + clientError.message);

      }



      setFormData({

        ...reservationData,

        reservation_date: reservationData.reservation_date.split('T')[0],

        column_discount: (reservationData.column_discount || 0) * 100,

        additional_discount: (reservationData.additional_discount || 0) * 100,

        other_discount: (reservationData.other_discount || 0) * 100

      });

      

      setSelectedClient(clientData);

    } catch (err: any) {

      console.error('Error in fetchReservation:', err);

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };



  const handleClientSearch = async () => {

    if (!clientSearchTerm.trim()) {

      setClients([]);

      return;

    }



    try {

      setIsSearching(true);

      const { data, error } = await supabase

        .from('clients')

        .select('id, rut, first_name, last_name')

        .or(`rut.ilike.%${clientSearchTerm}%,first_name.ilike.%${clientSearchTerm}%,last_name.ilike.%${clientSearchTerm}%`)

        .is('deleted_at', null)

        .order('first_name')

        .limit(5);



      if (error) throw error;

      setClients(data || []);

    } catch (err: any) {

      setError(err.message);

    } finally {

      setIsSearching(false);

    }

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

      setFormData(prev => ({

        ...prev,

        [name]: checked,

        broker_id: checked ? prev.broker_id : null

      }));

    } else if (name === 'column_discount' || name === 'additional_discount' || name === 'other_discount') {

      // Handle percentage inputs (0-100)

      const numValue = parseInt(value) || 0;

      setFormData(prev => ({

        ...prev,

        [name]: Math.min(100, Math.max(0, numValue))

      }));

    } else {

      setFormData(prev => ({

        ...prev,

        [name]: type === 'number' ? parseFloat(value) || 0 : value

      }));

    }

  };



  const checkReservationNumberExists = async (reservationNumber: string): Promise<boolean> => {

    try {

      const query = supabase

        .from('reservations')

        .select('id')

        .eq('reservation_number', reservationNumber);

      

      // Only add the not equals condition when editing an existing reservation

      if (id) {

        query.neq('id', id);

      }



      const { data, error } = await query.maybeSingle();



      if (error) throw error;

      return !!data;

    } catch (err) {

      console.error('Error checking reservation number:', err);

      throw err;

    }

  };



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    

    try {

      setLoading(true);

      setError(null);



      if (!formData.reservation_number.trim()) {

        throw new Error('El número de reserva es obligatorio');

      }



      // Check if reservation number already exists

      const exists = await checkReservationNumberExists(formData.reservation_number);

      if (exists) {

        throw new Error('El número de reserva ya existe. Por favor, ingrese un número único.');

      }



      // Convert percentage values to decimals for storage

      const reservationData = {

        ...formData,

        column_discount: formData.column_discount / 100,

        additional_discount: formData.additional_discount / 100,

        other_discount: formData.other_discount / 100,

        updated_by: session?.user.id,

      };



      let newReservationId: string | null = null;



      // Si es una venta con broker, primero mostrar el popup

      if (formData.is_with_broker && formData.broker_id) {

        if (id) {

          // Update existing reservation

          const { error: updateError } = await supabase

            .from('reservations')

            .update(reservationData)

            .eq('id', id);



          if (updateError) throw updateError;

          newReservationId = id;

        } else {

          // Create new reservation

          const { data, error } = await supabase

            .from('reservations')

            .insert([{ ...reservationData, created_by: session?.user.id }])

            .select('id')

            .single();



          if (error) throw error;

          if (!data) throw new Error('No se pudo crear la reserva');

          

          newReservationId = data.id;



          // Crear el flujo de reserva

          await createReservationFlow(newReservationId, formData.seller_id);

        }



        setLoading(false);



        showPopup(

          <BrokerCommissionPopup

            reservationId={newReservationId}

            brokerId={formData.broker_id}

            onSave={() => navigate('/reservas')}

            onClose={async () => {

              // Si se cancela y es una nueva reserva, eliminar la reserva recién creada

              if (!id) {

                await supabase

                  .from('reservations')

                  .delete()

                  .eq('id', newReservationId);

              }

              navigate('/reservas');

            }}

          />,

          {

            title: 'Comisión del Broker',

            size: 'md'

          }

        );

      } else {

        // Si no es venta con broker, guardar directamente

        if (id) {

          const { error } = await supabase

            .from('reservations')

            .update(reservationData)

            .eq('id', id);



          if (error) throw error;

        } else {

          const { data, error } = await supabase

            .from('reservations')

            .insert([{ ...reservationData, created_by: session?.user.id }])

            .select('id')

            .single();



          if (error) throw error;

          if (!data) throw new Error('No se pudo crear la reserva');



          // Crear el flujo de reserva

          await createReservationFlow(data.id, formData.seller_id);

        }



        navigate('/reservas');

      }

    } catch (err: any) {

      setError(err.message);

      setLoading(false);

    }

  };



  const createReservationFlow = async (reservationId: string, sellerId: string | null) => {

    try {

      // Get the default flow

      const { data: flowData, error: flowError } = await supabase

        .from('sale_flows')

        .select('id')

        .eq('name', 'Flujo de Venta Regular')

        .single();



      if (flowError) throw flowError;



      // Get first stage

      const { data: stageData, error: stageError } = await supabase

        .from('sale_flow_stages')

        .select('id')

        .eq('flow_id', flowData.id)

        .order('order', { ascending: true })

        .limit(1)

        .single();



      if (stageError) throw stageError;



      // Create reservation flow

      const { data: flowRecord, error: flowRecordError } = await supabase

        .from('reservation_flows')

        .insert({

          reservation_id: reservationId,

          flow_id: flowData.id,

          current_stage_id: stageData.id,

          status: 'in_progress',

          created_by: session?.user.id,

          updated_by: session?.user.id

        })

        .select('id')

        .single();



      if (flowRecordError) throw flowRecordError;



      // If there's a seller, assign seller-specific tasks

      if (sellerId) {

        // Get seller tasks

        const { data: sellerTasks, error: tasksError } = await supabase

          .from('sale_flow_tasks')

          .select('id')

          .ilike('name', '%COF%');



        if (tasksError) throw tasksError;



        // Create task assignments for seller

        if (sellerTasks && sellerTasks.length > 0) {

          const assignments = sellerTasks.map(task => ({

            reservation_flow_id: flowRecord.id,

            task_id: task.id,

            user_id: sellerId,

            assigned_by: session?.user.id

          }));



          const { error: assignError } = await supabase

            .from('task_assignments')

            .insert(assignments);



          if (assignError) throw assignError;

        }

      }



      // Get default task assignments

      const { data: defaultAssignments, error: defaultAssignError } = await supabase

        .from('default_task_assignments')

        .select('task_id, user_id');



      if (defaultAssignError) throw defaultAssignError;



      // Create task assignments from defaults

      if (defaultAssignments && defaultAssignments.length > 0) {

        const assignments = defaultAssignments.map(assignment => ({

          reservation_flow_id: flowRecord.id,

          task_id: assignment.task_id,

          user_id: assignment.user_id,

          assigned_by: session?.user.id

        }));



        const { error: assignError } = await supabase

          .from('task_assignments')

          .insert(assignments);



        if (assignError) throw assignError;

      }



    } catch (error) {

      console.error('Error creating reservation flow:', error);

      throw error;

    }

  };



  const formatCurrency = (amount: number) => {

    return new Intl.NumberFormat('es-CL', {

      style: 'decimal',

      minimumFractionDigits: 2,

      maximumFractionDigits: 2

    }).format(amount);

  };



  const handleShowPromotionPopup = () => {

    showPopup(

      <PromotionPopup

        reservationId={id || ''}

        onSave={() => {

          // Optionally refresh data or show success message

        }}

        onClose={() => showPopup(null)}

      />,

      {

        title: 'Agregar Promoción',

        size: 'md'

      }

    );

  };



  if (!selectedClient) {

    return (

      <Layout>

        <div className="max-w-3xl mx-auto">

          <div className="flex items-center justify-between mb-6">

            <button

              onClick={() => navigate('/reservas')}

              className="flex items-center text-gray-600 hover:text-gray-900"

            >

              <ArrowLeft className="h-5 w-5 mr-2" />

              Volver

            </button>

            <h1 className="text-2xl font-semibold text-gray-900">

              Nueva Reserva

            </h1>

          </div>



          <div className="bg-white rounded-lg shadow-md p-6">

            <h2 className="text-lg font-semibold text-gray-900 mb-4">

              Buscar Cliente

            </h2>



            <div className="relative">

              <div className="flex gap-4 mb-4">

                <div className="flex-1">

                  <input

                    type="text"

                    placeholder="Buscar por RUT o nombre..."

                    value={clientSearchTerm}

                    onChange={(e) => setClientSearchTerm(e.target.value)}

                    ref={searchInputRef}

                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"

                  />

                </div>

                <button

                  onClick={() => navigate('/clientes/nuevo')}

                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"

                >

                  <UserPlus className="h-5 w-5" />

                </button>

              </div>



              {isSearching && (

                <div className="absolute inset-x-0 top-full mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 flex justify-center">

                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />

                </div>

              )}



              {clients.length > 0 && (

                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200">

                  <ul className="py-1">

                    {clients.map((client) => (

                      <li key={client.id}>

                        <button

                          onClick={() => handleSelectClient(client)}

                          className="w-full px-4 py-2 text-left hover:bg-gray-100"

                        >

                          <div className="font-medium">

                            {client.first_name} {client.last_name}

                          </div>

                          <div className="text-sm text-gray-500">

                            {client.rut}

                          </div>

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



  return (

    <Layout>

      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">

          <button

            onClick={() => navigate('/reservas')}

            className="flex items-center text-gray-600 hover:text-gray-900"

          >

            <ArrowLeft className="h-5 w-5 mr-2" />

            Volver

          </button>

          <h1 className="text-2xl font-semibold text-gray-900">

            {id ? 'Editar Reserva' : 'Nueva Reserva'}

          </h1>

        </div>



        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (

            <div className="bg-red-50 text-red-600 p-4 rounded-lg">

              {error}

            </div>

          )}



          {/* Cliente Seleccionado */}

          <div className="bg-white rounded-lg shadow-md p-6">

            <div className="flex items-center justify-between mb-4">

              <h2 className="text-lg font-semibold text-gray-900">Cliente</h2>

              <button

                type="button"

                onClick={() => setSelectedClient(null)}

                className="text-sm text-blue-600 hover:text-blue-800"

              >

                Cambiar Cliente

              </button>

            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>

                <label className="block text-sm font-medium text-gray-700">

                  Nombre Completo

                </label>

                <div className="mt-1 text-gray-900">

                  {selectedClient.first_name} {selectedClient.last_name}

                </div>

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700">

                  RUT

                </label>

                <div className="mt-1 text-gray-900">

                  {selectedClient.rut}

                </div>

              </div>

            </div>

          </div>



          {/* Información Básica */}

          <div className="bg-white rounded-lg shadow-md p-6">

            <h2 className="text-lg font-semibold text-gray-900 mb-4">

              Información Básica

            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>

                <label htmlFor="reservation_number" className="block text-sm font-medium text-gray-700">

                  N° Reserva *

                </label>

                <input

                  type="text"

                  id="reservation_number"

                  name="reservation_number"

                  required

                  value={formData.reservation_number}

                  onChange={handleChange}

                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                />

              </div>



              <div>

                <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">

                  Proyecto *

                </label>

                <select

                  id="project_id"

                  name="project_id"

                  required

                  value={formData.project_id}

                  onChange={handleChange}

                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                >

                  <option value="">Seleccione un proyecto</option>

                  {projects.map(project => (

                    <option key={project.id} value={project.id}>

                      {project.name} {project.stage}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label htmlFor="seller_id" className="block text-sm font-medium text-gray-700">

                  Vendedor

                </label>

                <select

                  id="seller_id"

                  name="seller_id"

                  value={formData.seller_id || ''}

                  onChange={handleChange}

                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                >

                  <option value="">Seleccione un vendedor</option>

                  {sellers.map(seller => (

                    <option key={seller.id} value={seller.id}>

                      {`${seller.first_name} ${seller.last_name}`}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label htmlFor="reservation_date" className="block text-sm font-medium text-gray-700">

                  Fecha de Reserva *

                </label>

                <input

                  type="date"

                  id="reservation_date"

                  name="reservation_date"

                  required

                  value={formData.reservation_date}

                  onChange={handleChange}

                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                />

              </div>



              <div className="md:col-span-2">

                <div className="flex items-center mb-4">

                  <input

                    type="checkbox"

                    id="is_with_broker"

                    name="is_with_broker"

                    checked={formData.is_with_broker}

                    onChange={handleChange}

                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"

                  />

                  <label htmlFor="is_with_broker" className="ml-2 block text-sm text-gray-700">

                    Venta con Broker

                  </label>

                </div>



                {formData.is_with_broker && (

                  <div>

                    <label htmlFor="broker_id" className="block text-sm font-medium text-gray-700">

                      Broker *

                    </label>

                    <select

                      id="broker_id"

                      name="broker_id"

                      required={formData.is_with_broker}

                      value={formData.broker_id || ''}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    >

                      <option value="">Seleccione un broker</option>

                      {brokers.map(broker => (

                        <option key={broker.id} value={broker.id}>

                          {broker.name} - {broker.business_name}

                        </option>

                      ))}

                    </select>

                  </div>

                )}

              </div>

            </div>

          </div>



          {/* Unidades y Precios Lista */}

          <div className="bg-white rounded-lg shadow-md p-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Unidades */}

              <div>

                <h2 className="text-lg font-semibold text-gray-900 mb-4">

                  Unidades

                </h2>

                <div className="space-y-4">

                  <div>

                    <label htmlFor="apartment_number" className="block text-sm font-medium text-gray-700">

                      N° Departamento *

                    </label>

                    <input

                      type="text"

                      id="apartment_number"

                      name="apartment_number"

                      required

                      value={formData.apartment_number}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="parking_number" className="block text-sm font-medium text-gray-700">

                      N° Estacionamiento

                    </label>

                    <input

                      type="text"

                      id="parking_number"

                      name="parking_number"

                      value={formData.parking_number}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="storage_number" className="block text-sm font-medium text-gray-700">

                      N° Bodega

                    </label>

                    <input

                      type="text"

                      id="storage_number"

                      name="storage_number"

                      value={formData.storage_number}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>

                </div>

              </div>



              {/* Precios Lista */}

              <div>

                <h2 className="text-lg font-semibold text-gray-900 mb-4">

                  Precios Lista

                </h2>

                <div className="space-y-4">

                  <div>

                    <label htmlFor="apartment_price" className="block text-sm font-medium text-gray-700">

                      Precio Departamento *

                    </label>

                    <input

                      type="number"

                      id="apartment_price"

                      name="apartment_price"

                      required

                      min="0"

                      step="0.01"

                      value={formData.apartment_price}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="parking_price" className="block text-sm font-medium text-gray-700">

                      Precio Estacionamiento

                    </label>

                    <input

                      type="number"

                      id="parking_price"

                      name="parking_price"

                      min="0"

                      step="0.01"

                      value={formData.parking_price}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="storage_price" className="block text-sm font-medium text-gray-700">

                      Precio Bodega

                    </label>

                    <input

                      type="number"

                      id="storage_price"

                      name="storage_price"

                      min="0"

                      step="0.01"

                      value={formData.storage_price}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label className="block text-sm font-medium text-gray-700">

                      Total Lista

                    </label>

                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">

                      {formatCurrency(totalListPrice)} UF

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>



          {/* Descuentos y Forma de Pago */}

          <div className="bg-white rounded-lg shadow-md p-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Descuentos */}

              <div>

                <h2 className="text-lg font-semibold text-gray-900 mb-4">

                  Descuentos

                </h2>

                <div className="space-y-4">

                  <div>

                    <label htmlFor="column_discount" className="block text-sm font-medium text-gray-700">

                      Descuento Columna (%)

                    </label>

                    <input

                      type="number"

                      id="column_discount"

                      name="column_discount"

                      min="0"

                      max="100"

                      step="1"

                      value={formData.column_discount}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="additional_discount" className="block text-sm font-medium text-gray-700">

                      Descuento Adicional (%)

                    </label>

                    <input

                      type="number"

                      id="additional_discount"

                      name="additional_discount"

                      min="0"

                      max="100"

                      step="1"

                      value={formData.additional_discount}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="other_discount" className="block text-sm font-medium text-gray-700">

                      Otros Descuentos (%)

                    </label>

                    <input

                      type="number"

                      id="other_discount"

                      name="other_discount"

                      min="0"

                      max="100"

                      step="1"

                      value={formData.other_discount}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label className="block text-sm font-medium text-gray-700">

                      Precio Mínimo

                    </label>

                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">

                      {formatCurrency(minimumPrice)} UF

                    </div>

                  </div>

                </div>

              </div>



              {/* Forma de Pago */}

              <div>

                <h2 className="text-lg font-semibold text-gray-900 mb-4">

                  Forma de Pago

                </h2>

                <div className="space-y-4">

                  <div>

                    <label htmlFor="reservation_payment" className="block text-sm font-medium text-gray-700">

                      Reserva

                    </label>

                    <input

                      type="number"

                      id="reservation_payment"

                      name="reservation_payment"

                      min="0"

                      step="0.01"

                      value={formData.reservation_payment}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="promise_payment" className="block text-sm font-medium text-gray-700">

                      Promesa

                    </label>

                    <input

                      type="number"

                      id="promise_payment"

                      name="promise_payment"

                      min="0"

                      step="0.01"

                      value={formData.promise_payment}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="down_payment" className="block text-sm font-medium text-gray-700">

                      Pie

                    </label>

                    <input

                      type="number"

                      id="down_payment"

                      name="down_payment"

                      min="0"

                      step="0.01"

                      value={formData.down_payment}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="credit_payment" className="block text-sm font-medium text-gray-700">

                      Crédito

                    </label>

                    <input

                      type="number"

                      id="credit_payment"

                      name="credit_payment"

                      min="0"

                      step="0.01"

                      value={formData.credit_payment}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label htmlFor="subsidy_payment" className="block text-sm font-medium text-gray-700">

                      Bono Pie

                    </label>

                    <input

                      type="number"

                      id="subsidy_payment"

                      name="subsidy_payment"

                      min="0"

                      step="0.01"

                      value={formData.subsidy_payment}

                      onChange={handleChange}

                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"

                    />

                  </div>



                  <div>

                    <label className="block text-sm font-medium text-gray-700">

                      Total Escrituración

                    </label>

                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">

                      {formatCurrency(totalPayment)} UF

                    </div>

                  </div>



                  <div>

                    <label className="block text-sm font-medium text-gray-700">

                      Total Recuperación

                    </label>

                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-md text-gray-700">

                      {formatCurrency(recoveryPayment)} UF

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>



          <div className="flex justify-end space-x-4">

            {formData.reservation_number && (

              <button

                type="button"

                onClick={handleShowPromotionPopup}

                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"

              >

                Agregar Promoción

              </button>

            )}

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

                <>

                  <Save className="h-5 w-5 mr-2" />

                  Guardar

                </>

              )}

            </button>

          </div>

        </form>

      </div>

    </Layout>

  );

};



export default ReservationForm;