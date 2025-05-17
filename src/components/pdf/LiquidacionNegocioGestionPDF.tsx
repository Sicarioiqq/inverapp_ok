// src/components/pdf/LiquidacionNegocioGestionPDF.tsx
import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

// --------------------------------------
// Datos que espera recibir el componente
// --------------------------------------
export interface LiquidacionGestionData {
  reportTitle: string;
  generationDate: string;
  companyLogoUrl?: string;

  numeroReserva: string;

  cliente: {
    nombreCompleto: string;
    rut: string;
    email?: string;
    telefono?: string;
  };

  unidad: {
    proyectoNombre: string;
    proyectoEtapa?: string;
    deptoNumero: string;
    estacionamientoNumero?: string;
    bodegaNumero?: string;
  };

  fechas: {
    reserva?: string;
    promesa?: string;
    escritura?: string;
  };

  preciosLista: {
    depto: number;
    estacionamiento?: number;
    bodega?: number;
    totalLista: number;
  };

  descuentos: {
    columnaPct?: number;
    adicionalPct?: number;
    otrosPct?: number;
  };

  promociones?: Array<{
    nombre: string;
    descripcion?: string;
    valorEstimado?: number;
  }>;

  resumenFinanciero: {
    precioMinimoVenta: number;
    totalEscrituracion: number;
    totalRecuperacion?: number;
    subsidio?: number;
    diferencia?: number;
  };

  broker?: {
    nombre: string;
    razonSocial?: string;
    rut?: string;
  };

  comisionBroker?: {
    montoBruto: number;
    incluyeIVA: boolean;
    montoNeto?: number;
    porcentajeComisionCalculado?: number;
    numeroPagos?: 1 | 2;
    porcentajePrimerPago?: number;
  };

  vendedor?: {
    nombreCompleto: string;
  };
}

// ----------- estilos -------------
const colors = {
  primary: '#2A679F',
  border: '#E0E0E0',
  textPrimary: '#212121',
  textSecondary: '#757575',
  backgroundLight: '#F5F5F5',
  white: '#FFFFFF',
};
const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: 'Helvetica',
    backgroundColor: colors.white,
  },
  logo: { width: 120, height: 40, alignSelf: 'flex-end', marginBottom: 20 },
  headerText: { fontSize: 24, fontWeight: 'bold', color: colors.primary, textAlign: 'center' },
  subHeaderText: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  section: { marginBottom: 15 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitleIcon: { fontSize: 14, marginRight: 6, color: colors.primary },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.primary },
  footer: {
    position: 'absolute', bottom: 20, left: 35, right: 35,
    fontSize: 8, textAlign: 'center', color: colors.textSecondary,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4,
  },
  textRight: { textAlign: 'right' },
  bold: { fontWeight: 'bold' },
});

// ------------------------------
// Componente principal del PDF
// ------------------------------
const LiquidacionGestionDocument: React.FC<LiquidacionGestionData> = ({
  reportTitle,
  generationDate,
  companyLogoUrl,
  numeroReserva,
  cliente,
  unidad,
  fechas,
  preciosLista,
  descuentos,
  promociones,
  resumenFinanciero,
  broker,
  comisionBroker,
  vendedor,
}) => (
  <Document title={reportTitle}>
    <Page size="A4" style={styles.page}>
      {companyLogoUrl && <Image src={companyLogoUrl} style={styles.logo} />}
      <Text style={styles.headerText}>{reportTitle}</Text>
      <Text style={styles.subHeaderText}>
        Reserva: {numeroReserva} | Fecha: {generationDate}
      </Text>

      {/* Datos del Cliente */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>👤</Text>
          <Text style={styles.sectionTitle}>Cliente</Text>
        </View>
        <Text>Nombre: {cliente.nombreCompleto}</Text>
        <Text>RUT: {cliente.rut}</Text>
        {cliente.email && <Text>Email: {cliente.email}</Text>}
        {cliente.telefono && <Text>Teléfono: {cliente.telefono}</Text>}
      </View>

      {/* Unidad */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>🏘️</Text>
          <Text style={styles.sectionTitle}>Unidad</Text>
        </View>
        <Text>Proyecto: {unidad.proyectoNombre}</Text>
        {unidad.proyectoEtapa && <Text>Etapa: {unidad.proyectoEtapa}</Text>}
        <Text>Depto: {unidad.deptoNumero}</Text>
        {unidad.estacionamientoNumero && <Text>Estac.: {unidad.estacionamientoNumero}</Text>}
        {unidad.bodegaNumero && <Text>Bodega: {unidad.bodegaNumero}</Text>}
      </View>

      {/* Fechas */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>📆</Text>
          <Text style={styles.sectionTitle}>Fechas</Text>
        </View>
        {fechas.reserva && <Text>Reserva: {fechas.reserva}</Text>}
        {fechas.promesa && <Text>Promesa: {fechas.promesa}</Text>}
        {fechas.escritura && <Text>Escritura: {fechas.escritura}</Text>}
      </View>

      {/* Precios de Lista */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>💲</Text>
          <Text style={styles.sectionTitle}>Precios de Lista</Text>
        </View>
        <Text>Depto: {preciosLista.depto.toLocaleString()}</Text>
        {preciosLista.estacionamiento !== undefined && (
          <Text>Estac.: {preciosLista.estacionamiento.toLocaleString()}</Text>
        )}
        {preciosLista.bodega !== undefined && (
          <Text>Bodega: {preciosLista.bodega.toLocaleString()}</Text>
        )}
        <Text style={styles.bold}>Total Lista: {preciosLista.totalLista.toLocaleString()}</Text>
      </View>

      {/* Descuentos y Promociones */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>🏷️</Text>
          <Text style={styles.sectionTitle}>Descuentos y Promociones</Text>
        </View>
        {descuentos.columnaPct !== undefined && (
          <Text>Descuento Columna: {descuentos.columnaPct}%</Text>
        )}
        {descuentos.adicionalPct !== undefined && (
          <Text>Descuento Adicional: {descuentos.adicionalPct}%</Text>
        )}
        {promociones?.map((p, i) => (
          <Text key={i}>Promo: {p.nombre} {p.valorEstimado ? `(${p.valorEstimado})` : ''}</Text>
        ))}
      </View>

      {/* Resumen Financiero */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitleIcon}>📑</Text>
          <Text style={styles.sectionTitle}>Resumen Financiero</Text>
        </View>
        <Text>Precio Mínimo Venta: {resumenFinanciero.precioMinimoVenta.toLocaleString()}</Text>
        <Text>Total Escrituración: {resumenFinanciero.totalEscrituracion.toLocaleString()}</Text>
        {resumenFinanciero.subsidio !== undefined && (
          <Text>Subsidio: {resumenFinanciero.subsidio.toLocaleString()}</Text>
        )}
        {resumenFinanciero.diferencia !== undefined && (
          <Text>Diferencia: {resumenFinanciero.diferencia.toLocaleString()}</Text>
        )}
      </View>

      {/* Broker */}
      {broker && (
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitleIcon}>🤝</Text>
            <Text style={styles.sectionTitle}>Broker</Text>
          </View>
          <Text>Nombre: {broker.nombre}</Text>
          {broker.razonSocial && <Text>Razón Social: {broker.razonSocial}</Text>}
        </View>
      )}

      {/* Comisión Broker */}
      {comisionBroker && (
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitleIcon}>📋</Text>
            <Text style={styles.sectionTitle}>Comisión Broker</Text>
          </View>
          <Text>Monto Bruto: {comisionBroker.montoBruto.toLocaleString()}</Text>
          <Text>Incluye IVA: {comisionBroker.incluyeIVA ? 'Sí' : 'No'}</Text>
          {comisionBroker.montoNeto !== undefined && (
            <Text>Monto Neto: {comisionBroker.montoNeto.toLocaleString()}</Text>
          )}
        </View>
      )}

      {/* Vendedor */}
      {vendedor && (
        <View style={styles.section}>
          <Text>Vendedor Interno: {vendedor.nombreCompleto}</Text>
        </View>
      )}

      {/* Pie de página */}
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Inverapp | ${reportTitle} | Página ${pageNumber} de ${totalPages}`
        }
        fixed
      />

    </Page>
  </Document>
);

export default LiquidacionGestionDocument;
