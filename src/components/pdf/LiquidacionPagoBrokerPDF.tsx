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

// --- FIN: Definiciones de Tipos de Datos ---

// --- Configuración de Fuentes (IMPORTANTE: Reemplaza con tus rutas de fuentes) ---
// Descarga archivos .ttf (ej. de Google Fonts) y ponlos en tu carpeta public o sírvelos desde una URL.
 Font.register({
   family: 'Lato',
   fonts: [
     { src: '/fonts/Lato-Regular.ttf' }, // Reemplaza esta URL/ruta
     { src: '/fonts/Lato-Bold.ttf', fontWeight: 'bold' }, // Reemplaza esta URL/ruta
   ],
 });
 Font.register({
   family: 'Montserrat',
   fonts: [
     { src: '/fonts/Montserrat-Regular.ttf' }, // Reemplaza esta URL/ruta
     { src: '/fonts/Montserrat-Bold.ttf', fontWeight: 'bold' }, // Reemplaza esta URL/ruta
   ]
 });

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

// --- Secciones ---
  // --- Secciones ---
  section: {
    marginBottom: 20,
    paddingBottom: 10,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 6,
    marginBottom: 12,
  },
  sectionTitleIcon: { // Placeholder para si usas imágenes de iconos
    fontSize: 18,
    marginRight: 8,
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },

  // --- Tarjetas KPI ---
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  kpiCard: {
    backgroundColor: colors.white, // Podría ser colors.backgroundLight para contraste
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 12,
    width: '48%', // Aproximadamente 2 por fila, ajusta con gap
    marginBottom: 10,
    minHeight: 70,
  },
  kpiTitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  kpiTrend: {
    fontSize: 9,
  },

  // --- Tablas ---
  table: {
    // display: "table", // @react-pdf/renderer usa flexbox, esto es conceptual
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundLight, // Un gris muy claro
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    '&:last-child': {
      borderBottomWidth: 0,
    },
  },
  tableColHeader: {
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.primary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    '&:last-child': {
      borderRightWidth: 0,
    },
  },
  tableCol: {
    padding: 6,
    fontSize: 9,
    color: colors.textPrimary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    '&:last-child': {
      borderRightWidth: 0,
    },
  },
  // Anchos de columna (ejemplos, necesitarás ajustarlos)
  colWidthSm: { width: '15%' },
  colWidthMd: { width: '25%' },
  colWidthLg: { width: '35%' },
  colWidthXl: { width: '50%' },
  textRight: { textAlign: 'right' },

  // --- Gráficos (Placeholder) ---
  chartPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartPlaceholderText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
   // --- Helpers ---
  boldText: {
    fontWeight: 'bold',
  },
  textPositive: { color: colors.secondary },
  textNegative: { color: colors.red },
  
});

// --- Componente Principal del PDF ---
const InformeGeneralNegocioPDF: React.FC<InformeDataProps> = ({
  reportTitle,
  generationDate,
  periodCovered,
  companyLogoUrl,
  kpis,
  monthlyReservationsTrend,
  projectStatuses,
  brokerPerformances,
  // ... y otros datos que pases
}) => {
  const today = new Date();
  const defaultGenerationDate = generationDate || `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return (
    <Document title={reportTitle || "Informe General del Negocio"}>
      <Page size="A4" style={styles.page}>
        {/* --- Encabezado y Portada --- */}
        {companyLogoUrl && <Image style={styles.logo} src={companyLogoUrl} />}
        <Text style={styles.headerText}>{reportTitle || "Informe General del Negocio"}</Text>
        <Text style={styles.subHeaderText}>
          Fecha de Generación: {defaultGenerationDate}
          {periodCovered && ` | Periodo: ${periodCovered}`}
        </Text>

        {/* --- Sección: KPIs Principales --- */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            {/* <Image src="URL_ICONO_KPI.png" style={styles.sectionTitleIcon} />  Alternativa con Imagen */}
            <Text style={styles.sectionTitleIcon}>📊</Text>
            <Text style={styles.sectionTitle}>Indicadores Clave de Rendimiento (KPIs)</Text>
          </View>
          <View style={styles.kpiContainer}>
            {kpis.map((kpi, index) => (
              <View key={index} style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>{kpi.title}</Text>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                {kpi.trend && (
                  <Text style={[
                      styles.kpiTrend,
                      kpi.trendPositive === true ? styles.textPositive : kpi.trendPositive === false ? styles.textNegative : {}
                    ]}
                  >
                    {kpi.trend}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* --- Sección: Desempeño General (Ej: Reservas Mensuales) --- */}
        {monthlyReservationsTrend && monthlyReservationsTrend.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitleIcon}>📈</Text>
              <Text style={styles.sectionTitle}>Tendencia de Reservas Mensuales</Text>
            </View>
            {/* Aquí iría un gráfico. Como placeholder, mostramos un texto. */}
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>[Espacio para Gráfico de Reservas Mensuales]</Text>
            </View>
            {/* Podrías listar los datos también o en lugar del gráfico si es simple */}
            {/* <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableColHeader, {width: '50%'}]}>Mes</Text>
                <Text style={[styles.tableColHeader, {width: '50%'}, styles.textRight]}>Cantidad</Text>
              </View>
              {monthlyReservationsTrend.map(item => (
                <View key={item.month} style={styles.tableRow}>
                  <Text style={[styles.tableCol, {width: '50%'}]}>{item.month}</Text>
                  <Text style={[styles.tableCol, {width: '50%'}, styles.textRight]}>{item.value}</Text>
                </View>
              ))}
            </View> */}
          </View>
        )}

        {/* --- Sección: Análisis de Proyectos --- */}
        <View style={styles.section} wrap={false}> {/* wrap={false} para intentar mantener la sección en una página */}
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitleIcon}>🏗️</Text>
            <Text style={styles.sectionTitle}>Estado de Proyectos</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableColHeader, styles.colWidthLg]}>Proyecto</Text>
              <Text style={[styles.tableColHeader, styles.colWidthSm, styles.textRight]}>Total U.</Text>
              <Text style={[styles.tableColHeader, styles.colWidthSm, styles.textRight]}>Reser. U.</Text>
              <Text style={[styles.tableColHeader, styles.colWidthSm, styles.textRight]}>Disp. U.</Text>
              <Text style={[styles.tableColHeader, styles.colWidthMd, styles.textRight]}>Valor Res.</Text>
            </View>
            {projectStatuses.map((project) => (
              <View key={project.id} style={styles.tableRow}>
                <Text style={[styles.tableCol, styles.colWidthLg]}>{project.name} ({project.stage})</Text>
                <Text style={[styles.tableCol, styles.colWidthSm, styles.textRight]}>{project.totalUnits}</Text>
                <Text style={[styles.tableCol, styles.colWidthSm, styles.textRight]}>{project.reservedUnits}</Text>
                <Text style={[styles.tableCol, styles.colWidthSm, styles.textRight]}>{project.availableUnits}</Text>
                <Text style={[styles.tableCol, styles.colWidthMd, styles.textRight]}>{project.totalReservedValue || 'N/A'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* --- Sección: Análisis de Brokers --- */}
         {brokerPerformances && brokerPerformances.length > 0 && (
          <View style={styles.section} wrap={false}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitleIcon}>🤝</Text>
              <Text style={styles.sectionTitle}>Rendimiento de Brokers</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableColHeader, styles.colWidthXl]}>Broker</Text>
                <Text style={[styles.tableColHeader, styles.colWidthMd, styles.textRight]}>N° Reservas</Text>
                <Text style={[styles.tableColHeader, styles.colWidthMd, styles.textRight]}>Comisiones</Text>
              </View>
              {brokerPerformances.map((broker) => (
                <View key={broker.id} style={styles.tableRow}>
                  <Text style={[styles.tableCol, styles.colWidthXl]}>{broker.name}</Text>
                  <Text style={[styles.tableCol, styles.colWidthMd, styles.textRight]}>{broker.reservationsCount}</Text>
                  <Text style={[styles.tableCol, styles.colWidthMd, styles.textRight]}>{broker.commissionsValue}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- Pie de Página --- */}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `Inverapp | ${reportTitle || "Informe General"} | Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

// --- Datos de Ejemplo para Pruebas ---
// (Deberás reemplazar esto con datos reales)
export const ejemploDataInforme: InformeDataProps = {
  reportTitle: "Informe de Gestión Comercial Inverapp",
  generationDate: "16/05/2025",
  periodCovered: "Q1 2025",
  companyLogoUrl: undefined, // "public/inverapp-logo.png", // <-- PON TU LOGO AQUÍ
  kpis: [
    { title: "Total Reservas (Periodo)", value: "120", trend: "+15% vs Q4 2024", trendPositive: true },
    { title: "Valor Total Comisiones", value: "UF 350,000", trend: "+10%", trendPositive: true },
    { title: "Nuevos Clientes", value: "85", trend: "-5% vs Q4 2024", trendPositive: false },
    { title: "Proyectos Activos", value: "12" },
  ],
  monthlyReservationsTrend: [
    { month: "Ene 2025", value: 35 },
    { month: "Feb 2025", value: 40 },
    { month: "Mar 2025", value: 45 },
  ],
  projectStatuses: [
    { id: "p1", name: "AIRES LA FLORIDA 2", stage: "En Venta", totalUnits: 100, reservedUnits: 60, availableUnits: 40, totalReservedValue: "UF 180,000" },
    { id: "p2", name: "EDIFICIO CENTRAL PARK", stage: "Entrega Inmediata", totalUnits: 50, reservedUnits: 45, availableUnits: 5, totalReservedValue: "UF 150,000" },
    { id: "p3", name: "NUEVO HORIZONTE", stage: "En Blanco", totalUnits: 200, reservedUnits: 30, availableUnits: 170, totalReservedValue: "UF 60,000" },
  ],
  brokerPerformances: [
    { id: "b1", name: "PROBITAL (PROPITAL SpA)", reservationsCount: 25, commissionsValue: "UF 75,000" },
    { id: "b2", name: "Broker Asociados Ltda.", reservationsCount: 20, commissionsValue: "UF 60,000" },
    { id: "b3", name: "Inversiones Seguras SpA", reservationsCount: 18, commissionsValue: "UF 50,000" },
  ],
};

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