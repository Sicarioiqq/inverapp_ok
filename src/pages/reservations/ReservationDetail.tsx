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
import type { LiquidacionGestionData } from '../../components/pdf/LiquidacionNegocioGestionPDF';
import { getLiquidacionGestionData } from '../../lib/getLiquidacionGestionData';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<AppliedPromotion[]>([]);
  const [gestionData, setGestionData] = useState<LiquidacionGestionData | null>(null);

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
        .select(
          `*,
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
           )`
        )
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
    }
  };

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
          reservation.broker_commission.commission_amount > 0
        }
        commissionAmount={reservation.broker_commission?.commission_amount || null}
        brokerCommissionId={reservation.broker_commission?.id || null}
        onSave={fetchReservation}
        onClose={() => {}}
      />, { title: 'Rescindir Reserva', size: 'md' }
    );
  };

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
      sellerName: reservation.seller
        ? `${reservation.seller.first_name} ${reservation.seller.last_name}`
        : undefined,
    };
  };

  if (loading) return (
    <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin"/></div></Layout>
  );
  if (error || !reservation) return (
    <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg">{error || 'No se encontró la reserva'}</div></Layout>
  );

  const pdfData = getPDFData();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/reservas')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2"/> Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Reserva {reservation.reservation_number}
            {reservation.is_rescinded && <span className="ml-3 px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">Resciliada</span>}
          </h1>
          <div className="flex space-x-3">
            <button onClick={() => navigate(`/reservas/editar/${reservation.id}`)} className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Edit2 className="h-5 w-5 mr-2"/> Editar
            </button>
            {pdfData && (
              <PDFDownloadLink_Reservation data={pdfData} fileName={`Reserva_${reservation.reservation_number}.pdf`}>
                <FileText className="h-5 w-5 mr-2"/> Descargar PDF
              </PDFDownloadLink_Reservation>
            )}
            <button onClick={handleGenerateGestion} className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="h-5 w-5 mr-2"/> Generar Informe Gestión
            </button>
            {gestionData && (
              <PDFDownloadLink document={<LiquidacionGestionDocument {...gestionData}/>} fileName={`liquidacion_gestion_${gestionData.numeroReserva}.pdf`} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm">
                {({ loading }) => loading ? 'Generando…' : 'Descargar Informe Gestión'}
              </PDFDownloadLink>
            )}
            {!reservation.is_rescinded && (
              <button onClick={handleRescind} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                <Ban className="h-5 w-5 mr-2"/> Rescindir
              </button>
            )}
          </div>
        </div>
        {/* ... resto del contenido permanece igual ... */}
      </div>
    </Layout>
  );
};

export default ReservationDetail;
