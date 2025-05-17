// src/lib/getLiquidacionGestionData.ts
import { supabase } from './supabase';
import type { LiquidacionGestionData } from '../components/pdf/LiquidacionNegocioGestionPDF';

export async function getLiquidacionGestionData(reservationId: string)
: Promise<LiquidacionGestionData> {
  // 1) Consulta principal
  const { data: r, error } = await supabase
    .from('reservations')
    .select(`
      reservation_number,
      reservation_date,
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

  if (error) throw error;

  // 2) Promociones en consulta aparte
  const { data: promoArr, error: promoError } = await supabase
    .from('promotions')
    .select(`name, description, estimated_value`)
    .eq('reservation_id', reservationId);
  if (promoError) throw promoError;

  // 3) Mappeo
  const client = r.client as any;
  const seller = (r.seller as any) || {};
  const brokerRec = (r.broker_commissions as any[])[0] || null;

  return {
    reportTitle: `Liquidación Gestión ${r.reservation_number}`,
    generationDate: new Date().toLocaleDateString('es-CL'),
    numeroReserva: r.reservation_number,

    cliente: {
      nombreCompleto: `${client.first_name} ${client.last_name}`,
      rut: client.rut,
      email: client.email,
      telefono: client.phone,
    },

    unidad: {
      proyectoNombre: r.project.name,
      proyectoEtapa: r.project.stage,
      deptoNumero: r.apartment_number,
      estacionamientoNumero: r.parking_number ?? undefined,
      bodegaNumero: r.storage_number ?? undefined,
    },

    fechas: {
      reserva: r.reservation_date,
      // promesa/escritura si las traes aparte…
    },

    preciosLista: {
      depto: r.apartment_price,
      estacionamiento: r.parking_price,
      bodega: r.storage_price,
      totalLista: r.apartment_price + (r.parking_price||0) + (r.storage_price||0),
    },

    descuentos: {
      // rellena si tienes esos valores
    },

    promociones: promoArr.map(p => ({
      nombre: p.name,
      descripcion: p.description,
      valorEstimado: p.estimated_value,
    })),

    resumenFinanciero: {
      precioMinimoVenta: r.minimum_price,
      totalEscrituracion: r.total_payment,
      totalRecuperacion: r.recovery_payment,
      subsidio: r.subsidy_payment,
      diferencia:
        (r.apartment_price + (r.parking_price||0) + (r.storage_price||0))
        - r.minimum_price,
    },

    broker: r.broker
      ? {
          nombre: (r.broker as any).name,
          razonSocial: (r.broker as any).business_name,
          rut: (r.broker as any).rut,
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

    vendedor: seller.first_name
      ? { nombreCompleto: `${seller.first_name} ${seller.last_name}` }
      : undefined,
  };
}
