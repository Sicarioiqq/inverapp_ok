import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
} from '@react-pdf/renderer';

interface PaymentFlow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  is_second_payment: boolean;
  broker_commission: {
    id: string;
    commission_amount: number;
    number_of_payments: number;
    first_payment_percentage: number;
    at_risk: boolean;
    at_risk_reason: string | null;
    reservation: {
      id: string;
      reservation_number: string;
      client: {
        id: string;
        first_name: string;
        last_name: string;
      };
      project: {
        name: string;
        stage: string;
      };
      apartment_number: string;
      broker: {
        id: string;
        name: string;
      };
    };
  };
}

interface LiquidacionPagoBrokerPDFProps {
  flowData: PaymentFlow;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2A679F',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2A679F',
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '40%',
    fontSize: 12,
    color: '#666666',
  },
  value: {
    width: '60%',
    fontSize: 12,
    color: '#333333',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomColor: '#CCCCCC',
    borderBottomWidth: 1,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#EEEEEE',
    borderBottomWidth: 1,
    paddingVertical: 5,
  },
  tableCell: {
    fontSize: 10,
    padding: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#666666',
    fontSize: 10,
    borderTopColor: '#EEEEEE',
    borderTopWidth: 1,
    paddingTop: 10,
  },
});

const LiquidacionPagoBrokerPDF: React.FC<LiquidacionPagoBrokerPDFProps> = ({
  flowData,
  formatDate,
  formatCurrency,
}) => {
  const getPaymentAmount = () => {
    const { commission_amount, first_payment_percentage } = flowData.broker_commission;
    if (flowData.is_second_payment) {
      return (commission_amount * (100 - first_payment_percentage) / 100);
    }
    return (commission_amount * first_payment_percentage / 100);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Liquidación de Pago de Comisión
          </Text>
          <Text style={styles.subtitle}>
            Reserva N° {flowData.broker_commission.reservation.reservation_number}
          </Text>
          <Text style={styles.subtitle}>
            {flowData.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Reserva</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>
              {flowData.broker_commission.reservation.client.first_name} {flowData.broker_commission.reservation.client.last_name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Proyecto:</Text>
            <Text style={styles.value}>
              {flowData.broker_commission.reservation.project.name} - {flowData.broker_commission.reservation.project.stage}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Unidad:</Text>
            <Text style={styles.value}>
              {flowData.broker_commission.reservation.apartment_number}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Broker</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Broker:</Text>
            <Text style={styles.value}>
              {flowData.broker_commission.reservation.broker.name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Comisión Total:</Text>
            <Text style={styles.value}>
              {formatCurrency(flowData.broker_commission.commission_amount)} UF
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Porcentaje de Pago:</Text>
            <Text style={styles.value}>
              {flowData.is_second_payment 
                ? `${100 - flowData.broker_commission.first_payment_percentage}%`
                : `${flowData.broker_commission.first_payment_percentage}%`}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monto a Pagar:</Text>
            <Text style={styles.value}>
              {formatCurrency(getPaymentAmount())} UF
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del Pago</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Estado:</Text>
            <Text style={styles.value}>
              {flowData.status === 'completed' ? 'Completado' : 'En Proceso'}
            </Text>
          </View>
          {flowData.started_at && (
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de Inicio:</Text>
              <Text style={styles.value}>
                {formatDate(flowData.started_at)}
              </Text>
            </View>
          )}
          {flowData.completed_at && (
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de Completado:</Text>
              <Text style={styles.value}>
                {formatDate(flowData.completed_at)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Liquidación de Pago - Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default LiquidacionPagoBrokerPDF;