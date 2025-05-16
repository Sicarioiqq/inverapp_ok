// src/components/pdf/LiquidacionPagoBrokerPDF.tsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

// --- INICIO: Definiciones de Tipos (Asegúrate que AppliedPromotion esté bien definida) ---
// ... (tus otras interfaces: ReservationInfo, BrokerCommissionInfo, PaymentFlowInfo) ...

export interface AppliedPromotion { // Asegúrate que esta interfaz esté completa
  id: string | number;
  promotion_type: string;
  amount: number;
  is_against_discount: boolean;
  observations?: string | null;
  // ...otros campos...
}
// ...

// --- Estilos para el PDF (sin cambios aquí, se mantiene tu 'styles') ---
const styles = StyleSheet.create({
  // ... tus estilos existentes ...
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
  // Estilo 'text' que podría faltar si promo.observations lo usa (lo añado por si acaso)
  text: { // Añadido por si se usa en promo.observations
      fontSize: 10, // o el tamaño que corresponda
      color: '#000000',
  }
});

interface LiquidacionPagoBrokerPDFProps {
  flowData: any; // Reemplaza 'any' con tu interfaz PaymentFlowInfo bien definida
  appliedPromotions?: AppliedPromotion[];
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
  const firstPaymentAmount = commission.commission_amount * (commission.first_payment_percentage / 100);
  const secondPaymentAmount = commission.number_of_payments === 2 ? commission.commission_amount - firstPaymentAmount : 0;

  // MODIFICACIÓN CLAVE: Asegurar que appliedPromotions sea un array
  const safeAppliedPromotions = Array.isArray(appliedPromotions) ? appliedPromotions : [];

  return (
    <Document title={`Liquidación Pago Reserva ${reservation.reservation_number}`}>
      <Page size="A4" style={styles.page}>
        {/* ... (resto de tu JSX para Información de la Reserva, Detalles de la Comisión, Pagos, etc.) ... */}
        {/* Mantenemos toda la estructura anterior, solo cambia la sección de promociones */}

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

        {/* Promociones (si se incluyen en esta liquidación) - SECCIÓN MODIFICADA */}
        {safeAppliedPromotions.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Promociones Asociadas</Text>
            {safeAppliedPromotions.map((promo, index) => {
              // Verificación adicional para cada 'promo' y su 'id'
              if (!promo || typeof promo.id === 'undefined') {
                // Opcional: loguear un aviso si un objeto promo es inválido
                // console.warn(`Promoción inválida en índice ${index}:`, promo);
                return null; // No renderizar este item si es inválido
              }
              return (
                <View key={promo.id} style={{ marginBottom: 5, paddingLeft: 5 }}>
                  <Text style={styles.value}>
                    <Text style={styles.label}>{promo.promotion_type || 'N/A'}:</Text>
                    {/* Verificar que promo.amount sea un número */}
                    {(typeof promo.amount === 'number' ? formatCurrency(promo.amount) : 'N/A')} UF
                    ({promo.is_against_discount ? 'Contra Dcto.' : 'No Contra Dcto.'})
                  </Text>
                  {promo.observations && (
                    <Text style={{...(styles.text as object), fontSize: 9, marginLeft: 10 }}> {/* Añadí 'as object' para evitar error de tipo con '...styles.text' si 'text' no está definido o es complejo */}
                      Obs: {promo.observations}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `${reservation.project.name} | Reserva ${reservation.reservation_number} | Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default LiquidacionPagoBrokerPDF;