import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';
import { PaymentFlow } from '../../pages/payments/PaymentFlow';

interface KPI {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}

interface MonthlyTrend {
  month: string;
  value: number;
}

interface ProjectStatus {
  id: string;
  name: string;
  stage: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalReservedValue?: string; // Ej: "UF 150,000"
}

interface BrokerPerformance {
  id: string;
  name: string;
  reservationsCount: number;
  commissionsValue: string; // Ej: "UF 10,000"
}

interface RecentActivityItem {
  id: string;
  type: 'Reserva' | 'Pago';
  description: string;
  date: string;
  amount?: string;
}

interface LiquidacionPagoBrokerPDFProps {
  flowData: PaymentFlow | null;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
}

export interface InformeDataProps {
  reportTitle: string;
  generationDate: string;
  periodCovered?: string;
  companyLogoUrl?: string; 
  kpis: KPI[];
  monthlyReservationsTrend?: MonthlyTrend[];
  monthlyCommissionsTrend?: MonthlyTrend[];
  projectStatuses: ProjectStatus[];
  brokerPerformances: BrokerPerformance[];
  recentActivities?: RecentActivityItem[];
 
}

// --- Estilos para el PDF ---
const colors = {
  primary: '#2A679F', // Un azul corporativo (ejemplo)
  secondary: '#4CAF50', // Verde para acentos positivos (ejemplo)
  accent: '#FF9800', // Naranja para otros acentos (ejemplo)
  textPrimary: '#212121', // Casi negro para texto principal
  textSecondary: '#757575', // Gris para texto secundario
  border: '#E0E0E0', // Gris claro para bordes y separadores
  backgroundLight: '#F5F5F5', // Un fondo muy claro para algunas secciones (opcional)
  white: '#FFFFFF',
  red: '#D32F2F', // Para tendencias negativas
};

const styles = StyleSheet.create({
  // --- Generales ---
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    paddingTop: 35,
    paddingBottom: 55, // Espacio para el pie de página
    paddingHorizontal: 35,
    fontFamily: 'Helvetica', // CAMBIA a 'Lato' o 'Montserrat' después de registrar la fuente
  },
  logo: {
    width: 120,
    height: 40,
    marginBottom: 20,
    alignSelf: 'flex-end', // o 'flex-start' o 'center'
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subHeaderText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
  },
  footer: {
    position: 'absolute',
    fontSize: 8,
    bottom: 30,
    left: 35,
    right: 35,
    textAlign: 'center',
    color: colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 5,
  },
});

const LiquidacionPagoBrokerPDF: React.FC<LiquidacionPagoBrokerPDFProps> = ({
  flowData,
  formatDate,
  formatCurrency,
}) => {
  if (!flowData) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Error</Text>
            <Text style={styles.subtitle}>No se encontraron datos para generar la liquidación</Text>
          </View>
        </Page>
      </Document>
    );
  }

  const {
    broker_commission: {
      commission_amount,
      first_payment_percentage,
      is_second_payment,
      reservation: {
        reservation_number,
        client,
        project,
        broker,
        apartment_number,
      }
    }
  } = flowData;

  const paymentAmount = is_second_payment
    ? ((100 - first_payment_percentage) / 100) * commission_amount
    : (first_payment_percentage / 100) * commission_amount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Liquidación de Pago de Comisión - {is_second_payment ? 'Segundo Pago' : 'Primer Pago'}
          </Text>
          <Text style={styles.subtitle}>
            Reserva N° {reservation_number}
          </Text>
          <Text style={styles.subtitle}>
            Fecha: {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Broker</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Broker:</Text>
            <Text style={styles.value}>{broker.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Reserva</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{client.first_name} {client.last_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Proyecto:</Text>
            <Text style={styles.value}>{project.name} - {project.stage}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Unidad:</Text>
            <Text style={styles.value}>{apartment_number}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle del Pago</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Comisión Total:</Text>
            <Text style={styles.value}>{formatCurrency(commission_amount)} UF</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Porcentaje de Pago:</Text>
            <Text style={styles.value}>
              {is_second_payment ? 100 - first_payment_percentage : first_payment_percentage}%
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monto a Pagar:</Text>
            <Text style={styles.value}>{formatCurrency(paymentAmount)} UF</Text>
          </View>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default LiquidacionPagoBrokerPDF;