import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Edit2, 
  Loader2, 
  User, 
  Building, 
  Home, 
  DollarSign, 
  Calendar, 
  Gift, 
  Ban,
  AlertTriangle
} from 'lucide-react';
import { PDFDownloadLink_Reservation } from '../../components/PDFGenerator';
import RescindReservationPopup from '../../components/RescindReservationPopup';

import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionGestionDocument from '../../components/pdf/LiquidacionNegocioGestionPDF';
import { getLiquidacionGestionData } from '../../lib/getLiquidacionGestionData';


// Importar tipos de promociones
import { AppliedPromotion } from '../reservations/ReservationForm';

interface Reservation {
  id: string;
  reservation_number: string;
  reservation_date: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    rut: string;
    email: string;
    phone: string;
  };
  project: {
    id: string;
    name: string;
    stage: string;
  };
  seller: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  broker: {
    id: string;
    name: string;
    business_name: string;
  } | null;
  apartment_number: string;
  parking_number: string | null;
  storage_number: string | null;
  apartment_price: number;
  parking_price: number;
  storage_price: number;
  total_price: number;
  column_discount: number;
  additional_discount: number;
  other_discount: number;
  minimum_price: number;
  reservation_payment: number;
  promise_payment: number;
  down_payment: number;
  credit_payment: number;
  subsidy_payment: number;
  total_payment: number;
  is_with_broker: boolean;
  is_rescinded: boolean;
  rescinded_at: string | null;
  rescinded_reason: string | null;
  rescinded_by: string | null;
  rescinded_by_user?: {
    first_name: string;
    last_name: string;
  };
  broker_commission?: {
    id: string;
    commission_amount: number;
    at_risk: boolean;
    at_risk_reason: string | null;
    penalty_amount: number | null;
  };
}

const ReservationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<AppliedPromotion[]>([]);
  
    // ——— Estado para datos del Informe de Gestión ———
  const [gestionData, setGestionData] = useState<any>(null);


  useEffect(() => {
    if (id) {
      fetchReservation();
      fetchPromotions();
    }
  }, [id]);

  const fetchReservation = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('reservations')
        .select(`
          *,
          client:clients(*),
          project:projects(*),
          seller:profiles(*),
          broker:brokers(*),
          rescinded_by_user:profiles(first_name, last_name),
          broker_commission:broker_commissions(
            id, 
            commission_amount,
            at_risk,
            at_risk_reason,
            penalty_amount
          )
        `)
        .eq('id', id!)
        .single();

      if (fetchError) throw fetchError;
      setReservation(data);
    } catch (err: any) {
      console.error('Error fetching reservation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotions = async () => {
    try {
      const { data, error: promoError } = await supabase
        .from('promotions')
        .select('*')
        .eq('reservation_id', id!)
        .order('created_at', { ascending: true });

      if (promoError) throw promoError;
      setPromotions(data as AppliedPromotion[]);
    } catch (err: any) {
      console.error('Error fetching promotions:', err);
      // No establecer error general para no bloquear la vista principal
    }
  };


    // ——— Función para obtener datos de Gestión desde Supabase ———
  const handleGenerateGestion = async () => {
    if (!id) return;
    try {
      const data = await getLiquidacionGestionData(id);
      setGestionData(data);
    } catch (err) {
      console.error('Error al generar datos de Gestión:', err);
    }
  };


  const handleRescind = () => {
    if (!reservation) return;
    
    showPopup(
      <RescindReservationPopup
        reservationId={reservation.id}
        reservationNumber={reservation.reservation_number}
        hasPaidCommission={
          !!reservation.broker_commission && 
          (reservation.broker_commission.commission_amount > 0)
        }
        commissionAmount={reservation.broker_commission?.commission_amount || null}
        brokerCommissionId={reservation.broker_commission?.id || null}
        onSave={fetchReservation}
        onClose={() => {}}
      />,
      {
        title: 'Rescindir Reserva',
        size: 'md'
      }
    );
  };

  // Preparar datos para el PDF
  const getPDFData = () => {
    if (!reservation) return null;
    
    return {
      reservationNumber: reservation.reservation_number,
      reservationDate: formatDateChile(reservation.reservation_date),
      clientName: `${reservation.client.first_name} ${reservation.client.last_name}`,
      clientRut: reservation.client.rut,
      projectName: reservation.project.name,
      projectStage: reservation.project.stage,
      apartmentNumber: reservation.apartment_number,
      parkingNumber: reservation.parking_number || undefined,
      storageNumber: reservation.storage_number || undefined,
      apartmentPrice: reservation.apartment_price,
      parkingPrice: reservation.parking_price,
      storagePrice: reservation.storage_price,
      totalPrice: reservation.total_price,
      minimumPrice: reservation.minimum_price,
      columnDiscount: reservation.column_discount * 100,
      additionalDiscount: reservation.additional_discount * 100,
      otherDiscount: reservation.other_discount * 100,
      reservationPayment: reservation.reservation_payment,
      promisePayment: reservation.promise_payment,
      downPayment: reservation.down_payment,
      creditPayment: reservation.credit_payment,
      subsidyPayment: reservation.subsidy_payment,
      totalPayment: reservation.total_payment,
      brokerName: reservation.broker?.name,
      sellerName: reservation.seller ? `${reservation.seller.first_name} ${reservation.seller.last_name}` : undefined
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !reservation) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'No se encontró la reserva'}
        </div>
      </Layout>
    );
  }

  const pdfData = getPDFData();

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
            Reserva {reservation.reservation_number}
            {reservation.is_rescinded && (
              <span className="ml-3 px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">
                Resciliada
              </span>
            )}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate(`/reservas/editar/${reservation.id}`)}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Edit2 className="h-5 w-5 mr-2" />
              Editar
            </button>
            {pdfData && (
              <PDFDownloadLink_Reservation 
                data={pdfData}
                fileName={`Reserva_${reservation.reservation_number}.pdf`}
              >
                <FileText className="h-5 w-5 mr-2" />
                Descargar PDF
              </PDFDownloadLink_Reservation>
            )}

  {/* ——— Botón para generar Informe Gestión ——— */}
  <button
    onClick={handleGenerateGestion}
    className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
  >
    <Download className="h-5 w-5 mr-2" />
    Generar Informe Gestión
  </button>

  {gestionData && (
    <PDFDownloadLink
      document={<LiquidacionGestionDocument {...gestionData} />}
      fileName={`liquidacion_gestion_${gestionData.numeroReserva}.pdf`}
      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
    >
      {({ loading }) =>
        loading ? 'Generando…' : 'Descargar Informe Gestión'
      }
    </PDFDownloadLink>
  )}

            
            {!reservation.is_rescinded && (
              <button
                onClick={handleRescind}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <Ban className="h-5 w-5 mr-2" />
                Rescindir
              </button>
            )}
          </div>
        </div>

        {/* Información de Resciliación si aplica */}
        {reservation.is_rescinded && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Reserva Resciliada</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p><strong>Fecha de Resciliación:</strong> {formatDateChile(reservation.rescinded_at || '')}</p>
                  <p><strong>Motivo:</strong> {reservation.rescinded_reason}</p>
                  {reservation.rescinded_by_user && (
                    <p><strong>Resciliada por:</strong> {reservation.rescinded_by_user.first_name} {reservation.rescinded_by_user.last_name}</p>
                  )}
                  {reservation.broker_commission?.penalty_amount && reservation.broker_commission.penalty_amount > 0 && (
                    <p><strong>Castigo aplicado:</strong> {formatCurrency(reservation.broker_commission.penalty_amount)} UF</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Información de Riesgo si aplica */}
        {reservation.broker_commission?.at_risk && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-medium text-amber-800">Comisión En Riesgo</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p><strong>Motivo:</strong> {reservation.broker_commission.at_risk_reason}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Información del Cliente */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <User className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información del Cliente
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Nombre Completo</p>
                <p className="text-base text-gray-900">{reservation.client.first_name} {reservation.client.last_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">RUT</p>
                <p className="text-base text-gray-900">{reservation.client.rut}</p>
              </div>
              {reservation.client.email && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base text-gray-900">{reservation.client.email}</p>
                </div>
              )}
              {reservation.client.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Teléfono</p>
                  <p className="text-base text-gray-900">{reservation.client.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Información del Proyecto */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Building className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información del Proyecto
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Proyecto</p>
                <p className="text-base text-gray-900">{reservation.project.name} {reservation.project.stage}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Unidades</p>
                <p className="text-base text-gray-900">
                  Depto. {reservation.apartment_number}
                  {reservation.parking_number && ` | Est. ${reservation.parking_number}`}
                  {reservation.storage_number && ` | Bod. ${reservation.storage_number}`}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Fecha de Reserva</p>
                <p className="text-base text-gray-900">{formatDateChile(reservation.reservation_date)}</p>
              </div>
              {reservation.seller && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Vendedor</p>
                  <p className="text-base text-gray-900">{reservation.seller.first_name} {reservation.seller.last_name}</p>
                </div>
              )}
              {reservation.is_with_broker && reservation.broker && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Broker</p>
                  <p className="text-base text-gray-900">{reservation.broker.name}</p>
                  <p className="text-sm text-gray-500">{reservation.broker.business_name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Precios y Descuentos */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Precios y Descuentos
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Precio Departamento</p>
                <p className="text-base text-gray-900">{formatCurrency(reservation.apartment_price)} UF</p>
              </div>
              {reservation.parking_price > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Precio Estacionamiento</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.parking_price)} UF</p>
                </div>
              )}
              {reservation.storage_price > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Precio Bodega</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.storage_price)} UF</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Precio Total Lista</p>
                <p className="text-base text-gray-900">{formatCurrency(reservation.total_price)} UF</p>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-500">Descuentos</p>
                {reservation.column_discount > 0 && (
                  <div className="flex justify-between mt-2">
                    <p className="text-sm text-gray-600">Descuento Columna:</p>
                    <p className="text-sm text-gray-900">{(reservation.column_discount * 100).toFixed(2)}%</p>
                  </div>
                )}
                {reservation.additional_discount > 0 && (
                  <div className="flex justify-between mt-1">
                    <p className="text-sm text-gray-600">Descuento Adicional:</p>
                    <p className="text-sm text-gray-900">{(reservation.additional_discount * 100).toFixed(2)}%</p>
                  </div>
                )}
                {reservation.other_discount > 0 && (
                  <div className="flex justify-between mt-1">
                    <p className="text-sm text-gray-600">Otros Descuentos:</p>
                    <p className="text-sm text-gray-900">{(reservation.other_discount * 100).toFixed(2)}%</p>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-500">Precio Mínimo</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(reservation.minimum_price)} UF</p>
              </div>
            </div>
          </div>

          {/* Forma de Pago */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Calendar className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Forma de Pago
              </h2>
            </div>
            <div className="space-y-4">
              {reservation.reservation_payment > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Reserva</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.reservation_payment)} UF</p>
                </div>
              )}
              {reservation.promise_payment > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Promesa</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.promise_payment)} UF</p>
                </div>
              )}
              {reservation.down_payment > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Pie</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.down_payment)} UF</p>
                </div>
              )}
              {reservation.credit_payment > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Crédito</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.credit_payment)} UF</p>
                </div>
              )}
              {reservation.subsidy_payment > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Bono Pie</p>
                  <p className="text-base text-gray-900">{formatCurrency(reservation.subsidy_payment)} UF</p>
                </div>
              )}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-500">Total Escrituración</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(reservation.total_payment)} UF</p>
              </div>
            </div>
          </div>
        </div>

        {/* Promociones */}
        {promotions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center mb-4">
              <Gift className="h-5 w-5 text-purple-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Promociones Aplicadas
              </h2>
            </div>
            <div className="space-y-4">
              {promotions.map((promotion) => (
                <div key={promotion.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-purple-700">{promotion.promotion_type}</p>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(promotion.amount)} UF</p>
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                      promotion.is_against_discount 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {promotion.is_against_discount ? 'Contra Descuento' : 'No Contra Dcto.'}
                    </span>
                  </div>
                  
                  {promotion.observations && (
                    <p className="text-sm text-gray-600 mt-2 italic">
                      {promotion.observations}
                    </p>
                  )}
                  
                  <div className="mt-3 text-xs text-gray-500 border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <p><strong>Beneficiario:</strong> {promotion.beneficiary || 'N/D'}</p>
                      {promotion.rut && <p><strong>RUT:</strong> {promotion.rut}</p>}
                      {promotion.email && <p><strong>Email:</strong> {promotion.email}</p>}
                    </div>
                    <div>
                      {promotion.bank && <p><strong>Banco:</strong> {promotion.bank}</p>}
                      {promotion.account_type && <p><strong>Tipo Cuenta:</strong> {promotion.account_type}</p>}
                      {promotion.account_number && <p><strong>N° Cuenta:</strong> {promotion.account_number}</p>}
                    </div>
                    {(promotion.purchase_order || promotion.document_number || promotion.document_date || promotion.payment_date) && (
                      <div className="md:col-span-2 border-t pt-2 mt-1">
                        {promotion.purchase_order && <p><strong>N° OC:</strong> {promotion.purchase_order}</p>}
                        {promotion.document_number && <p><strong>Doc. N°:</strong> {promotion.document_number}</p>}
                        {promotion.document_date && <p><strong>Fecha Emisión:</strong> {formatDateChile(promotion.document_date)}</p>}
                        {promotion.payment_date && <p><strong>Fecha Pago:</strong> {formatDateChile(promotion.payment_date)}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comisión del Broker */}
        {reservation.is_with_broker && reservation.broker_commission && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Home className="h-5 w-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Comisión del Broker
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Monto Comisión</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(reservation.broker_commission.commission_amount)} UF
                </p>
              </div>
              <div>
                <button
                  onClick={() => navigate(`/pagos/${reservation.id}`)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit2 className="h-5 w-5 mr-2" />
                  Editar Comisión
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReservationDetail;