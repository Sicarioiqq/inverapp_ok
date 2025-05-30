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
      broker:brokers(
        name,
        business_name,
        rut
      ),
      seller:profiles(
        first_name,
        last_name
      ),
      column_discount,
      additional_discount,
      other_discount
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
      amount,
      is_against_discount
    `)
    .eq('reservation_id', reservationId);

  if (promoError) {
    console.error('Error fetching promotions data:', promoError);
    throw promoError;
  }

  // 3) Consulta separada de comisión del broker
  const { data: brokerComArr, error: brokerComError } = await supabase
    .from('broker_commissions')
    .select(`
      commission_amount,
      commission_includes_tax,
      net_commission,
      number_of_payments,
      first_payment_percentage,
      pays_secondary
    `) // Selecciona solo las columnas necesarias
    .eq('reservation_id', reservationId);

  if (brokerComError) {
    console.error('Error fetching broker commission data:', brokerComError);
    throw brokerComError;
  }

  // 4) Mappeo y retorno
  const client = r.client as any;
  const seller = (r.seller as any) || {};
  const brokerRec = (brokerComArr as any[])[0] || null;

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

  // Calcular suma de promociones contra descuento
  const promocionesContraDescuento = (promoArr || [])
    .filter((p: any) => p.is_against_discount === true)
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  // Recuperación Real
  const recuperacionReal = r.total_payment - (r.subsidy_payment || 0);
  // Comisión Bruta
  const comisionBruta = brokerRec?.commission_amount || 0;
  // Precio Mínimo de Venta
  const precioMinimoVenta = r.minimum_price;
  // Diferencia final
  const diferencia = recuperacionReal - precioMinimoVenta - comisionBruta - promocionesContraDescuento;

  // Calcular Primer y Segundo Pago de Comisión
  const primerPago = (brokerRec?.commission_amount || 0) * ((brokerRec?.first_payment_percentage || 0) / 100);
  const segundoPago = (brokerRec?.number_of_payments || 0) === 2 
    ? (brokerRec?.commission_amount || 0) - primerPago
    : undefined; // Solo hay segundo pago si number_of_payments es 2

  return {
    reportTitle: `Liquidación Gestión ${r.reservation_number}`,
    generationDate: new Date().toLocaleDateString('es-CL'),
    companyLogoUrl: "/logoinversiones.png",
    numeroReserva: r.reservation_number,

    cliente: {
      nombreCompleto: `${client?.first_name || ''} ${client?.last_name || ''}`.trim(),
      rut: client?.rut,
      email: client?.email,
      telefono: client?.phone,
    },

    unidad: {
      proyectoNombre: (r.project as any)?.name,
      proyectoEtapa: (r.project as any)?.stage,
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
      estacionamiento: r.parking_price ?? undefined,
      bodega: r.storage_price ?? undefined,
      totalLista: r.apartment_price + (r.parking_price || 0) + (r.storage_price || 0),
    },

    descuentos: {
      columnaPct: r.column_discount ?? 0,
      adicionalPct: r.additional_discount ?? 0,
      otrosPct: r.other_discount ?? 0,
    },

    promociones: (promoArr || []).map(p => ({
      nombre: p.promotion_type,
      descripcion: p.observations,
      valorEstimado: p.amount,
      is_against_discount: p.is_against_discount,
    })),

    resumenFinanciero: {
      precioMinimoVenta: r.minimum_price,
      totalEscrituracion: r.total_payment,
      totalRecuperacion: r.recovery_payment,
      subsidio: r.subsidy_payment,
      diferencia,
    },

    broker: r.broker
      ? {
          nombre: (r.broker as any)?.name,
          razonSocial: (r.broker as any)?.business_name,
          rut: (r.broker as any)?.rut,
        }
      : undefined,

    comisionBroker: brokerRec
      ? {
          montoBruto: brokerRec.commission_amount,
          incluyeIVA: brokerRec.commission_includes_tax,
          montoNeto: brokerRec.net_commission,
          numeroPagos: brokerRec.number_of_payments,
          porcentajePrimerPago: brokerRec.first_payment_percentage,
          pagaSecundario: brokerRec.pays_secondary,
          primerPago: primerPago,
          segundoPago: segundoPago,
        }
      : undefined,

    vendedor: seller && seller.first_name
      ? { nombreCompleto: `${seller.first_name} ${seller.last_name}`.trim() }
      : undefined,
  };
}