// src/lib/getLiquidacionGestionData.ts
import { supabase } from './supabase';
import type { LiquidacionGestionData } from '../components/pdf/LiquidacionNegocioGestionPDF';

export async function getLiquidacionGestionData(reservationId: string)
: Promise<LiquidacionGestionData> {
  // 1) Consulta principal de la reserva
  const { data: r, error } = await supabase
    .from('reservations')
    .select(`
      reservation_number,
      reservation_date,
      promise_date,
      deed_date,
      client:clients(
        first_name,
        last_name,
        rut,
        email,
        phone
      ),
      project:projects(
        name,
        stage
      ),
      apartment_number,
      parking_number,
      storage_number,
      apartment_price,
      parking_price,
      storage_price,
      minimum_price,
      total_payment,
      subsidy_payment,
      recovery_payment,
      broker_commissions(
        commission_amount,
        commission_includes_tax,
        net_commission,
        number_of_payments,
        first_payment_percentage,
        difference,
        penalty_amount,
        at_risk,
        at_risk_reason
      ),
      broker:brokers(
        name,
        business_name,
        rut
      ),
      seller:profiles(
        first_name,
        last_name
      )
    `)
    .eq('id', reservationId)
    .single();

  if (error) {
    console.error('Error fetching reservation data:', error);
    throw error;
  }

  if (!r) {
    throw new Error('Reservation not found');
  }

  // 2) Consulta separada de promociones (estructura real)
  const { data: promoArr, error: promoError } = await supabase
    .from('promotions')
    .select(`
      promotion_type,
      observations,
      amount
    `)
    .eq('reservation_id', reservationId);

  if (promoError) {
    console.error('Error fetching promotions data:', promoError);
    throw promoError;
  }

  // 3) Mappeo y retorno
  const client = r.client as any;
  const seller = (r.seller as any) || {};
  const brokerComArr = (r.broker_commissions as any[]) || [];
  const brokerRec = brokerComArr[0] || null;

  // Función para formatear la fecha si es necesario (opcional, pero recomendado)
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return undefined;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('es-CL').format(date);
    } catch (e) {
      return dateString;
    }
  };

  return {
    reportTitle: `Liquidación Gestión ${r.reservation_number}`,
    generationDate: new Date().toLocaleDateString('es-CL'),
    numeroReserva: r.reservation_number,

    cliente: {
      nombreCompleto: `${client?.first_name || ''} ${client?.last_name || ''}`.trim(),
      rut: client?.rut,
      email: client?.email,
      telefono: client?.phone,
    },

    unidad: {
      proyectoNombre: r.project?.name,
      proyectoEtapa: r.project?.stage,
      deptoNumero: r.apartment_number,
      estacionamientoNumero: r.parking_number ?? undefined,
      bodegaNumero: r.storage_number ?? undefined,
    },

    fechas: {
      reserva: formatDate(r.reservation_date),
      promesa: formatDate(r.promise_date),     
      escritura: formatDate(r.deed_date),
    },

    preciosLista: {
      depto: r.apartment_price,
      estacionamiento: r.parking_price || 0,
      bodega: r.storage_price || 0,
      totalLista: r.apartment_price + (r.parking_price || 0) + (r.storage_price || 0),
    },

    descuentos: {
      // Rellena si dispones de los porcentajes
    },

    promociones: (promoArr || []).map(p => ({
      nombre: p.promotion_type,
      descripcion: p.observations,
      valorEstimado: p.amount,
    })),

    resumenFinanciero: {
      precioMinimoVenta: r.minimum_price,
      totalEscrituracion: r.total_payment,
      totalRecuperacion: r.recovery_payment,
      subsidio: r.subsidy_payment,
      diferencia:
        (r.apartment_price + (r.parking_price || 0) + (r.storage_price || 0))
        - r.minimum_price,
    },

    broker: r.broker
      ? {
          nombre: r.broker.name,
          razonSocial: r.broker.business_name,
          rut: r.broker.rut,
        }
      : undefined,

    comisionBroker: brokerRec
      ? {
          montoBruto: brokerRec.commission_amount,
          incluyeIVA: brokerRec.commission_includes_tax,
          montoNeto: brokerRec.net_commission,
          numeroPagos: brokerRec.number_of_payments,
          porcentajePrimerPago: brokerRec.first_payment_percentage,
          diferencia: brokerRec.difference,
          penaltyAmount: brokerRec.penalty_amount,
          atRisk: brokerRec.at_risk,
          atRiskReason: brokerRec.at_risk_reason,
        }
      : undefined,

    vendedor: seller && seller.first_name
      ? { nombreCompleto: `${seller.first_name} ${seller.last_name}`.trim() }
      : undefined,
  };
}