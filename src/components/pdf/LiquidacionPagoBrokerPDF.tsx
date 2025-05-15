import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { AppliedPromotion, PromotionType } from '../../pages/payments/PaymentEdit'; // Ajusta esta ruta si defines los tipos en otro lugar
// O define los tipos aquí si no los exportas desde PaymentEdit o un archivo central:
// export const PROMOTION_TYPES_ARRAY = [...] as const;
// export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];
// export interface AppliedPromotion { ... }


// Es buena práctica registrar las fuentes que usarás, especialmente si no son estándar.
// Font.register({
//   family: 'Roboto', // Ejemplo
//   fonts: [
//     { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
//     { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
//   ]
// });

// Define los estilos usando StyleSheet
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica', // Fuente base
  },
  section: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', // Gris claro
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827', // Gris oscuro
    // fontFamily: 'Roboto', // Si registraste una fuente
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#374151', // Gris medio-oscuro
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280', // Gris medio
    marginBottom: 2,
  },
  text: {
    fontSize: 11,
    color: '#1F2937', // Gris oscuro
    marginBottom: 4,
    lineHeight: 1.4,
  },
  boldText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  logo: {
    width: 80,
    height: 80,
    position: 'absolute',
    top: 20,
    right: 30,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: 'grey',
    fontSize: 9,
  },
  table: { 
    display: "flex", // Cambiado de 'table' a 'flex' para compatibilidad
    width: "auto", 
    borderStyle: "solid", 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderRightWidth: 0, 
    borderBottomWidth: 0,
    marginBottom: 10,
  },
  tableRow: { 
    margin: "auto", 
    flexDirection: "row" 
  }, 
  tableColHeader: { 
    width: "25%", // Ajusta según el número de columnas
    borderStyle: "solid", 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderLeftWidth: 0, 
    borderTopWidth: 0,
    backgroundColor: '#F9FAFB', // Gris muy claro para cabeceras
    padding: 5,
  },
  tableCol: { 
    width: "25%", // Ajusta según el número de columnas
    borderStyle: "solid", 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderLeftWidth: 0, 
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    margin: 5, 
    fontSize: 10,
    fontWeight: 'bold'
  },
  tableCell: { 
    margin: 5, 
    fontSize: 9 
  }
});

// Define la interfaz para las props de tu documento PDF
interface ReservationPaymentPDFProps {
  flow: any; // Usa la interfaz PaymentFlow que ya tienes definida en PaymentFlow.tsx
  appliedPromotions?: AppliedPromotion[]; // Promociones aplicadas
  financialSummary?: any; // Usa la interfaz FinancialSummary que definiste en PaymentEdit.tsx
  // Podrías pasar también formatDateChile y formatCurrency como props si es más fácil
  formatDate: (dateStr: string | null | undefined) => string;
  formatCurrency: (amount: number) => string;
}

const ReservationPaymentPDF: React.FC<ReservationPaymentPDFProps> = ({ 
  flow, 
  appliedPromotions, 
  financialSummary,
  formatDate,
  formatCurrency
}) => {
  if (!flow || !flow.broker_commission || !flow.broker_commission.reservation) {
    // Manejo de caso donde los datos no están completos
    return (
      <Document>
        <Page style={styles.page}>
          <Text>Error: Datos incompletos para generar el PDF.</Text>
        </Page>
      </Document>
    );
  }

  const { reservation } = flow.broker_commission;
  const commission = flow.broker_commission;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* <Image style={styles.logo} src="/inverapp-logo.svg" />  // Necesitarías una URL completa o convertirlo a base64 */}
        <Text style={styles.header}>Resumen de Reserva y Flujo de Pago</Text>

        {/* Información de la Reserva */}
        <View style={styles.section}>
          <Text style={styles.title}>Información de la Reserva</Text>
          <Text style={styles.text}><Text style={styles.boldText}>N° Reserva:</Text> {reservation.reservation_number}</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Cliente:</Text> {reservation.client.first_name} {reservation.client.last_name} (RUT: {reservation.client.rut})</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Proyecto:</Text> {reservation.project.name} - {reservation.project.stage}</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Unidad:</Text> Depto. {reservation.apartment_number}
            {reservation.parking_number && ` | Est. ${reservation.parking_number}`}
            {reservation.storage_number && ` | Bod. ${reservation.storage_number}`}
          </Text>
          <Text style={styles.text}><Text style={styles.boldText}>Broker:</Text> {reservation.broker.name}</Text>
        </View>

        {/* Detalles de la Comisión */}
        <View style={styles.section}>
          <Text style={styles.title}>Detalles de la Comisión</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Monto Comisión Bruta:</Text> {formatCurrency(commission.commission_amount)} UF</Text>
          <Text style={styles.text}><Text style={styles.boldText}>N° de Pagos:</Text> {commission.number_of_payments}</Text>
          <Text style={styles.text}><Text style={styles.boldText}>% Primer Pago:</Text> {commission.first_payment_percentage}%</Text>
          {/* Agrega más detalles de la comisión si es necesario */}
        </View>

        {/* Promociones Aplicadas */}
        {appliedPromotions && appliedPromotions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.title}>Promociones Aplicadas</Text>
            {appliedPromotions.map(promo => (
              <View key={promo.id} style={{ marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#D1D5DB' }}>
                <Text style={styles.boldText}>{promo.promotion_type}: {formatCurrency(promo.amount)} UF</Text>
                <Text style={styles.text}>Contra Descuento: {promo.is_against_discount ? 'Sí' : 'No'}</Text>
                {promo.observations && <Text style={styles.text}><Text style={styles.boldText}>Obs:</Text> {promo.observations}</Text>}
                 {/* Puedes añadir más detalles de la promoción si es necesario */}
              </View>
            ))}
          </View>
        )}
        
        {/* Resumen Financiero (si lo pasas como prop) */}
        {financialSummary && (
            <View style={styles.section}>
                <Text style={styles.title}>Resumen Financiero</Text>
                <Text style={styles.text}><Text style={styles.boldText}>Total Escrituración:</Text> {formatCurrency(financialSummary.totalPayment)} UF</Text>
                <Text style={styles.text}><Text style={styles.boldText}>Total Recuperación:</Text> {formatCurrency(financialSummary.recoveryPayment)} UF</Text>
                <Text style={styles.text}><Text style={styles.boldText}>Precio Mínimo:</Text> {formatCurrency(financialSummary.minimumPrice)} UF</Text>
                <Text style={styles.text}><Text style={styles.boldText}>Comisión Bruta:</Text> {formatCurrency(financialSummary.totalCommissionUF)} UF</Text>
                {financialSummary.totalPromotionsAgainstDiscount > 0 && (
                    <Text style={styles.text}><Text style={styles.boldText}>Promociones (Contra Dcto.):</Text> -{formatCurrency(financialSummary.totalPromotionsAgainstDiscount)} UF</Text>
                )}
                <Text style={styles.text}><Text style={styles.boldText}>Diferencia:</Text> {formatCurrency(financialSummary.difference)} UF</Text>
            </View>
        )}

        {/* Estado del Flujo de Pago */}
        <View style={styles.section}>
          <Text style={styles.title}>Estado del Flujo de Pago</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Estado General:</Text> {flow.status}</Text>
          <Text style={styles.text}><Text style={styles.boldText}>Etapa Actual:</Text> {flow.current_stage?.name || 'N/A'}</Text>
          {flow.started_at && <Text style={styles.text}><Text style={styles.boldText}>Iniciado el:</Text> {formatDate(flow.started_at)}</Text>}
          {flow.completed_at && <Text style={styles.text}><Text style={styles.boldText}>Completado el:</Text> {formatDate(flow.completed_at)}</Text>}
        </View>
        
        {/* Detalle de Etapas y Tareas (Ejemplo básico, podrías hacerlo más detallado o con tablas) */}
        {flow.stages && flow.stages.length > 0 && (
            <View style={styles.section}>
                <Text style={styles.title}>Detalle de Etapas y Tareas</Text>
                {flow.stages.map((stage: any) => ( // Usa tu interfaz Stage aquí
                    <View key={stage.id} style={{ marginBottom: 8, paddingLeft: 10 }}>
                        <Text style={{...styles.boldText, fontSize: 12, marginBottom: 4 }}>Etapa: {stage.name} ({stage.isCompleted ? 'Completada' : 'Pendiente'})</Text>
                        {stage.tasks.map((task: any) => ( // Usa tu interfaz Task aquí
                            <View key={task.id} style={{ marginLeft: 10, marginBottom: 3 }}>
                                <Text style={styles.text}>- {task.name}: <Text style={styles.boldText}>{task.status}</Text>
                                    {task.assignee && ` (Asignado a: ${task.assignee.first_name} ${task.assignee.last_name})`}
                                </Text>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
}

export default ReservationPaymentPDF;