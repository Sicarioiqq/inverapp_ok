// src/lib/getLiquidacionGestionData.ts
import { supabase } from './supabase';
import type { LiquidacionGestionData } from '../components/pdf/LiquidacionNegocioGestionPDF';

export async function getLiquidacionGestionData(reservationId: string)
: Promise<LiquidacionGestionData> {
  // Traemos la reserva con sus relaciones básicas
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
      minimum_price,
      total_payment,
      subsidy_payment,
      recovery_payment,
      broker_commissions:broker_commissions(
        broker_name,
        business_name,
        commission_amount,
        includes_tax,
        net_amount,
        commission_percentage,
        first_payment_percentage
      ),
      reservation_promotions(
        name,
        description,
        estimated_value
      ),
      seller:users(
        first_name,
        last_name
      )
    `)
    .eq('id', reservationId)
    .single();

  if (error) throw error;

  // Ahora concatenamos en JS
  const client = r.client as any;
  const seller = (r.seller as any) || {};
  const brokerCommArr = (r.broker_commissions as any[]) || [];
  const promoArr = (r.reservation_promotions as any[]) || [];

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
      // promesa y escritura si las obtienes de otro lado
    },

    preciosLista: {
      depto: r.apartment_price,
      estacionamiento: r.parking_price,
      bodega: r.storage_price,
      totalLista: r.apartment_price + (r.parking_price || 0) + (r.storage_price || 0),
    },

    descuentos: {
      // Asume que tú calculas o sacas estos campos aparte
    },

    promociones: promoArr.map(p => ({
      nombre: p.name,
      descripcion: p.description,
      valorEstimado: p.estimated_value,
    })),

    resumenFinanciero: {
      precioMinimoVenta: r.minimum_price,
      totalEscrituracion: r.total_payment,
      subsidio: r.subsidy_payment,
      totalRecuperacion: r.recovery_payment,
      diferencia:
        (r.apartment_price + (r.parking_price || 0) + (r.storage_price || 0))
        - r.minimum_price,
    },

    broker: brokerCommArr[0]
      ? {
          nombre: brokerCommArr[0].broker_name,
          razonSocial: brokerCommArr[0].business_name,
        }
      : undefined,

    comisionBroker: brokerCommArr[0]
      ? {
          montoBruto: brokerCommArr[0].commission_amount,
          incluyeIVA: brokerCommArr[0].includes_tax,
          montoNeto: brokerCommArr[0].net_amount,
          porcentajeComisionCalculado: brokerCommArr[0].commission_percentage,
          porcentajePrimerPago: brokerCommArr[0].first_payment_percentage,
        }
      : undefined,

    vendedor: seller.first_name
      ? { nombreCompleto: `${seller.first_name} ${seller.last_name}` }
      : undefined,
  };
}
