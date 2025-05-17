import { supabase } from './supabase';
import type { LiquidacionGestionData } from '../components/pdf/LiquidacionNegocioGestionPDF';

export async function getLiquidacionGestionData(reservationId: string)
: Promise<LiquidacionGestionData> {
  // 1. Trae la reserva con relaciones
  const { data: res, error } = await supabase
    .from('reservations')
    .select(`
      reservation_number,
      reservation_date,
      client:clients(nombre:first_name||' '||last_name, rut, email, telefono),
      project:projects(name, stage),
      apartment_number,
      parking_number,
      storage_number,
      minimum_price,
      total_payment,
      subsidy_payment,
      recovery_payment,
      broker_commissions (
        commission_amount,
        includes_tax,
        net_amount,
        commission_percentage,
        first_payment_percentage
      ),
      reservation_promotions (
        name,
        description,
        estimated_value
      ),
      seller:users(first_name||' '||last_name)
    `)
    .eq('id', reservationId)
    .single();

  if (error) throw error;

  // 2. Mapea datos a tu interfaz
  const r = res as any;
  return {
    reportTitle: `Liquidación Gestión ${r.reservation_number}`,
    generationDate: new Date().toLocaleDateString('es-CL'),
    numeroReserva: r.reservation_number,
    cliente: {
      nombreCompleto: r.client.nombre,
      rut: r.client.rut,
      email: r.client.email,
      telefono: r.client.telefono,
    },
    unidad: {
      proyectoNombre: r.project.name,
      proyectoEtapa: r.project.stage,
      deptoNumero: r.apartment_number,
      estacionamientoNumero: r.parking_number,
      bodegaNumero: r.storage_number,
    },
    fechas: {
      reserva: r.reservation_date,
      // promesa y escritura las deberías extraer de tu flujo
    },
    preciosLista: {
      depto: r.apartment_price,
      estacionamiento: r.parking_price,
      bodega: r.storage_price,
      totalLista: r.apartment_price + (r.parking_price||0) + (r.storage_price||0),
    },
    descuentos: {
      columnaPct: r.column_discount_pct,
      adicionalPct: r.additional_discount_pct,
    },
    promociones: r.reservation_promotions,
    resumenFinanciero: {
      precioMinimoVenta: r.minimum_price,
      totalEscrituracion: r.total_payment,
      totalRecuperacion: r.recovery_payment,
      subsidio: r.subsidy_payment,
      diferencia: (r.apartment_price + (r.parking_price||0) + (r.storage_price||0)) - r.minimum_price,
    },
    broker: r.broker_commissions ? {
      nombre: r.broker_commissions[0].broker_name,
      razonSocial: r.broker_commissions[0].broker_business_name,
    } : undefined,
    comisionBroker: r.broker_commissions && r.broker_commissions[0] ? {
      montoBruto: r.broker_commissions[0].commission_amount,
      incluyeIVA: r.broker_commissions[0].includes_tax,
      montoNeto: r.broker_commissions[0].net_amount,
      porcentajeComisionCalculado: r.broker_commissions[0].commission_percentage,
      porcentajePrimerPago: r.broker_commissions[0].first_payment_percentage,
    } : undefined,
    vendedor: { nombreCompleto: r.seller },
  };
}
