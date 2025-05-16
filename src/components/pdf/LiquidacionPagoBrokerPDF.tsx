import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
// Asegúrate de que estas interfaces sean las correctas y estén accesibles
// Podrías importarlas desde donde las tengas definidas (ej. PaymentFlow.tsx, PaymentEdit.tsx o un archivo de tipos)
// o definirlas aquí si es más simple para este componente PDF.

// --- INICIO: Definiciones de Tipos (Ejemplo, ajusta/importa las tuyas) ---
export const PROMOTION_TYPES_ARRAY = [ /* ...tus tipos... */ ] as const;
export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];
export interface AppliedPromotion { /* ...tus campos... */ }
interface ReservationInfo {
  reservation_number: string;
  client: { first_name: string; last_name: string; rut: string };
  project: { name: string; stage: string };
  apartment_number: string;
  broker: { name: string; business_name: string };
  // ... más campos de la reserva ...
}
interface BrokerCommissionInfo {
  commission_amount: number;
  number_of_payments: number;
  first_payment_percentage: number;
  purchase_order?: string | null;
  invoice_1?: string | null;
  invoice_1_date?: string | null;
  payment_1_date?: string | null;
  invoice_2?: string | null;
  invoice_2_date?: string | null;
  payment_2_date?: string | null;
  // ... más campos de la comisión ...
}
interface PaymentFlowInfo { // La prop 'flow' que pasas desde PaymentFlow.tsx
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  is_second_payment: boolean;
  broker_commission: BrokerCommissionInfo & { reservation: ReservationInfo }; // Anidado como en tu estado
  current_stage: { name: string } | null;
  // ... más campos del flujo de comisión ...
}
// --- FIN: Definiciones de Tipos ---


// --- Estilos para el PDF ---
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    paddingTop: 35,
    paddingBottom: 65, // Espacio para el pie de página
    paddingHorizontal: 35,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
    color: 'black',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  textRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: '#555555',
    width: '35%', // Ajusta según necesidad
  },
  value: {
    fontSize: 10,
    color: '#000000',
    width: '65%', // Ajusta según necesidad
    fontWeight: 'normal',
  },
  boldValue: {
    fontSize: 10,
    color: '#000000',
    width: '65%',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    fontSize: 8,
    bottom: 30,
    left: 35,
    right: 35,
    textAlign: 'center',
    color: 'grey',
  },
  // Agrega más estilos según necesites (para tablas, etc.)
});

interface LiquidacionPagoBrokerPDFProps {
  flowData: PaymentFlowInfo; // Usa la interfaz completa del flujo de pago
  appliedPromotions?: AppliedPromotion[]; // Opcional, si se incluyen promociones
  // funciones de formateo
  formatDate: (dateStr: string | null | undefined) => string;
  formatCurrency: (amount: number) => string;
}

const LiquidacionPagoBrokerPDF: React.FC<LiquidacionPagoBrokerPDFProps> = ({
  flowData,
  appliedPromotions,
  formatDate,
  formatCurrency,
}) => {
  if (!flowData || !flowData.broker_commission || !flowData.broker_commission.reservation) {
    return (
      <Document>
        <Page style={styles.page}><Text>Datos insuficientes para generar la liquidación.</Text></Page>
      </Document>
    );
  }

  const { reservation } = flowData.broker_commission;
  const commission = flowData.broker_commission;
  // Calcula los montos de pago aquí también si los necesitas en el PDF
  const firstPaymentAmount = commission.commission_amount * (commission.first_payment_percentage / 100);
  const secondPaymentAmount = commission.number_of_payments === 2 ? commission.commission_amount - firstPaymentAmount : 0;

  return (
    <Document title={`Liquidación Pago Reserva ${reservation.reservation_number}`}>
      <Page size="A4" style={styles.page}>
        {/* Aquí puedes añadir un logo si lo tienes como URL o data URI */}
        {/* <Image style={styles.logo} src="URL_DEL_LOGO_O_DATA_URI" /> */}

        <Text style={styles.header}>Liquidación de Pago a Broker</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Reserva</Text>
          <View style={styles.textRow}><Text style={styles.label}>N° Reserva:</Text><Text style={styles.value}>{reservation.reservation_number}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>Cliente:</Text><Text style={styles.value}>{reservation.client.first_name} {reservation.client.last_name}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>RUT Cliente:</Text><Text style={styles.value}>{reservation.client.rut}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>Proyecto:</Text><Text style={styles.value}>{reservation.project.name} - {reservation.project.stage}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>Unidad:</Text><Text style={styles.value}>Depto. {reservation.apartment_number}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>Broker:</Text><Text style={styles.value}>{reservation.broker.name}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles de la Comisión</Text>
          <View style={styles.textRow}><Text style={styles.label}>Monto Comisión Bruta:</Text><Text style={styles.boldValue}>{formatCurrency(commission.commission_amount)} UF</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>N° de Pagos:</Text><Text style={styles.value}>{commission.number_of_payments}</Text></View>
          <View style={styles.textRow}><Text style={styles.label}>% Primer Pago:</Text><Text style={styles.value}>{commission.first_payment_percentage}% ({formatCurrency(firstPaymentAmount)} UF)</Text></View>
          {commission.number_of_payments === 2 && (
            <View style={styles.textRow}><Text style={styles.label}>% Segundo Pago:</Text><Text style={styles.value}>{100 - commission.first_payment_percentage}% ({formatCurrency(secondPaymentAmount)} UF)</Text></View>
          )}
          {commission.purchase_order && <View style={styles.textRow}><Text style={styles.label}>N° OC:</Text><Text style={styles.value}>{commission.purchase_order}</Text></View>}
        </View>

        {/* Información del Primer Pago */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primer Pago</Text>
          {commission.invoice_1 && <View style={styles.textRow}><Text style={styles.label}>N° Factura 1:</Text><Text style={styles.value}>{commission.invoice_1}</Text></View>}
          {commission.invoice_1_date && <View style={styles.textRow}><Text style={styles.label}>Fecha Emisión Fact. 1:</Text><Text style={styles.value}>{formatDate(commission.invoice_1_date)}</Text></View>}
          {commission.payment_1_date && <View style={styles.textRow}><Text style={styles.label}>Fecha Pago 1:</Text><Text style={styles.boldValue}>{formatDate(commission.payment_1_date)}</Text></View>}
        </View>

        {/* Información del Segundo Pago (si aplica) */}
        {commission.number_of_payments === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Segundo Pago</Text>
            {commission.invoice_2 && <View style={styles.textRow}><Text style={styles.label}>N° Factura 2:</Text><Text style={styles.value}>{commission.invoice_2}</Text></View>}
            {commission.invoice_2_date && <View style={styles.textRow}><Text style={styles.label}>Fecha Emisión Fact. 2:</Text><Text style={styles.value}>{formatDate(commission.invoice_2_date)}</Text></View>}
            {commission.payment_2_date && <View style={styles.textRow}><Text style={styles.label}>Fecha Pago 2:</Text><Text style={styles.boldValue}>{formatDate(commission.payment_2_date)}</Text></View>}
          </View>
        )}

        {/* Promociones (si se incluyen en esta liquidación) */}
        {appliedPromotions && appliedPromotions.length > 0 && (
          <View style={styles.section} wrap={false}> {/* wrap={false} para intentar mantener la sección en una página si es posible */}
            <Text style={styles.sectionTitle}>Promociones Asociadas</Text>
            {appliedPromotions.map(promo => (
              <View key={promo.id} style={{ marginBottom: 5, paddingLeft: 5 }}>
                <Text style={styles.value}><Text style={styles.label}>{promo.promotion_type}:</Text> {formatCurrency(promo.amount)} UF ({promo.is_against_discount ? 'Contra Dcto.' : 'No Contra Dcto.'})</Text>
                {promo.observations && <Text style={{...styles.text, fontSize: 9, marginLeft: 10}}>Obs: {promo.observations}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Puedes agregar más secciones según necesites */}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `${reservation.project.name} | Reserva ${reservation.reservation_number} | Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default LiquidacionPagoBrokerPDF;