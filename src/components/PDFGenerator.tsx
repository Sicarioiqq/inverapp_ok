import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFViewer, PDFDownloadLink, Font } from '@react-pdf/renderer';
import { formatCurrency } from '../lib/supabase';

// Define types for our PDF data
interface PDFReservationData {
  reservationNumber: string;
  reservationDate: string;
  clientName: string;
  clientRut: string;
  projectName: string;
  projectStage: string;
  apartmentNumber: string;
  parkingNumber?: string;
  storageNumber?: string;
  apartmentPrice: number;
  parkingPrice: number;
  storagePrice: number;
  totalPrice: number;
  minimumPrice: number;
  columnDiscount: number;
  additionalDiscount: number;
  otherDiscount: number;
  reservationPayment: number;
  promisePayment: number;
  downPayment: number;
  creditPayment: number;
  subsidyPayment: number;
  totalPayment: number;
  brokerName?: string;
  sellerName?: string;
}

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #CCCCCC',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2563EB', // blue-600
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563', // gray-600
    marginBottom: 5,
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937', // gray-800
    borderBottom: '1px solid #E5E7EB', // gray-200
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: '40%',
    fontSize: 12,
    color: '#4B5563', // gray-600
  },
  value: {
    width: '60%',
    fontSize: 12,
    color: '#1F2937', // gray-800
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#6B7280', // gray-500
    borderTop: '1px solid #E5E7EB', // gray-200
    paddingTop: 10,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#2563EB', // blue-600
  },
});

// Create PDF Document component
const ReservationPDF: React.FC<{ data: PDFReservationData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Reserva #{data.reservationNumber}</Text>
        <Text style={styles.subtitle}>Fecha: {data.reservationDate}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Cliente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nombre:</Text>
          <Text style={styles.value}>{data.clientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>RUT:</Text>
          <Text style={styles.value}>{data.clientRut}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Proyecto</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Proyecto:</Text>
          <Text style={styles.value}>{data.projectName} {data.projectStage}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Departamento:</Text>
          <Text style={styles.value}>{data.apartmentNumber}</Text>
        </View>
        {data.parkingNumber && (
          <View style={styles.row}>
            <Text style={styles.label}>Estacionamiento:</Text>
            <Text style={styles.value}>{data.parkingNumber}</Text>
          </View>
        )}
        {data.storageNumber && (
          <View style={styles.row}>
            <Text style={styles.label}>Bodega:</Text>
            <Text style={styles.value}>{data.storageNumber}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Precios y Descuentos</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Precio Departamento:</Text>
          <Text style={styles.value}>{formatCurrency(data.apartmentPrice)} UF</Text>
        </View>
        {data.parkingPrice > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Precio Estacionamiento:</Text>
            <Text style={styles.value}>{formatCurrency(data.parkingPrice)} UF</Text>
          </View>
        )}
        {data.storagePrice > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Precio Bodega:</Text>
            <Text style={styles.value}>{formatCurrency(data.storagePrice)} UF</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Precio Total Lista:</Text>
          <Text style={styles.value}>{formatCurrency(data.totalPrice)} UF</Text>
        </View>
        
        {data.columnDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Descuento Columna:</Text>
            <Text style={styles.value}>{data.columnDiscount.toFixed(2)}%</Text>
          </View>
        )}
        {data.additionalDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Descuento Adicional:</Text>
            <Text style={styles.value}>{data.additionalDiscount.toFixed(2)}%</Text>
          </View>
        )}
        {data.otherDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Otros Descuentos:</Text>
            <Text style={styles.value}>{data.otherDiscount.toFixed(2)}%</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Precio Mínimo:</Text>
          <Text style={[styles.value, styles.highlight]}>{formatCurrency(data.minimumPrice)} UF</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Forma de Pago</Text>
        {data.reservationPayment > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Reserva:</Text>
            <Text style={styles.value}>{formatCurrency(data.reservationPayment)} UF</Text>
          </View>
        )}
        {data.promisePayment > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Promesa:</Text>
            <Text style={styles.value}>{formatCurrency(data.promisePayment)} UF</Text>
          </View>
        )}
        {data.downPayment > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Pie:</Text>
            <Text style={styles.value}>{formatCurrency(data.downPayment)} UF</Text>
          </View>
        )}
        {data.creditPayment > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Crédito:</Text>
            <Text style={styles.value}>{formatCurrency(data.creditPayment)} UF</Text>
          </View>
        )}
        {data.subsidyPayment > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Bono Pie:</Text>
            <Text style={styles.value}>{formatCurrency(data.subsidyPayment)} UF</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Total Escrituración:</Text>
          <Text style={[styles.value, styles.highlight]}>{formatCurrency(data.totalPayment)} UF</Text>
        </View>
      </View>

      {(data.brokerName || data.sellerName) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Adicional</Text>
          {data.brokerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Broker:</Text>
              <Text style={styles.value}>{data.brokerName}</Text>
            </View>
          )}
          {data.sellerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Vendedor:</Text>
              <Text style={styles.value}>{data.sellerName}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.footer}>
        Documento generado por InverAPP - {new Date().toLocaleDateString()}
      </Text>
    </Page>
  </Document>
);

// PDF Viewer component
export const PDFViewer_Reservation: React.FC<{ data: PDFReservationData }> = ({ data }) => (
  <PDFViewer style={{ width: '100%', height: '600px' }}>
    <ReservationPDF data={data} />
  </PDFViewer>
);

// PDF Download Link component
export const PDFDownloadLink_Reservation: React.FC<{ data: PDFReservationData, fileName?: string }> = ({ 
  data, 
  fileName = `Reserva_${data.reservationNumber}.pdf`,
  children 
}) => (
  <PDFDownloadLink 
    document={<ReservationPDF data={data} />} 
    fileName={fileName}
    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
  >
    {({ blob, url, loading, error }) => 
      loading ? 'Generando PDF...' : children || 'Descargar PDF'
    }
  </PDFDownloadLink>
);

export default {
  PDFViewer_Reservation,
  PDFDownloadLink_Reservation
};