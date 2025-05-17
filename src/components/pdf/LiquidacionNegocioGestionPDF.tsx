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

export interface LiquidacionGestionData {
  reportTitle: string;
  generationDate: string;
  companyLogoUrl?: string;
  numeroReserva: string;
  cliente: { nombreCompleto: string; rut: string; email?: string; telefono?: string };
  unidad: { proyectoNombre: string; proyectoEtapa?: string; deptoNumero: string; estacionamientoNumero?: string; bodegaNumero?: string };
  fechas: { reserva?: string; promesa?: string; escritura?: string };
  preciosLista: { depto: number; estacionamiento?: number; bodega?: number; totalLista: number };
  descuentos?: { columnaPct?: number; adicionalPct?: number; otrosPct?: number };
  promociones?: Array<{ nombre: string; descripcion?: string; valorEstimado?: number }>;
  resumenFinanciero: { precioMinimoVenta: number; totalEscrituracion: number; totalRecuperacion?: number; subsidio?: number; diferencia?: number };
  broker?: { nombre: string; razonSocial?: string; rut?: string };
  comisionBroker?: { montoBruto: number; incluyeIVA: boolean; montoNeto?: number; porcentajePrimerPago?: number; numeroPagos?: number };
  vendedor?: { nombreCompleto: string };
}

const colors = {
  border: '#CCCCCC',
  text: '#333333',
  backgroundLight: '#F0F0F0',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { fontSize: 8, fontFamily: 'Helvetica', padding: 20, backgroundColor: colors.white },
  header: { fontSize: 14, textAlign: 'center', marginBottom: 10, color: colors.text, fontWeight: 'bold' },
  subHeader: { fontSize: 8, textAlign: 'center', marginBottom: 12, color: colors.text },
  logo: { width: 80, height: 30, alignSelf: 'flex-end', marginBottom: 10 },
  table: { display: 'table', width: 'auto', marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  tableRow: { flexDirection: 'row' },
  tableColLabel: { width: '50%', backgroundColor: colors.backgroundLight, borderRightWidth: 1, borderColor: colors.border, padding: 4 },
  tableColValue: { width: '50%', padding: 4 },
  footer: { position: 'absolute', fontSize: 6, bottom: 10, left: 20, right: 20, textAlign: 'center', color: colors.text, borderTopWidth: 1, borderColor: colors.border, paddingTop: 4 },
});

const LiquidacionGestionDocument: React.FC<LiquidacionGestionData> = (props) => {
  const {
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
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {companyLogoUrl && <Image src={companyLogoUrl} style={styles.logo} />}
        <Text style={styles.header}>{reportTitle}</Text>
        <Text style={styles.subHeader}>Reserva: {numeroReserva} | Fecha: {generationDate}</Text>

        {/* Cliente */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Cliente</Text>
            <Text style={styles.tableColValue}>{cliente.nombreCompleto}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>RUT</Text>
            <Text style={styles.tableColValue}>{cliente.rut}</Text>
          </View>
          {cliente.email && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Email</Text>
              <Text style={styles.tableColValue}>{cliente.email}</Text>
            </View>
          )}
          {cliente.telefono && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Teléfono</Text>
              <Text style={styles.tableColValue}>{cliente.telefono}</Text>
            </View>
          )}
        </View>

        {/* Unidad */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Proyecto</Text>
            <Text style={styles.tableColValue}>{unidad.proyectoNombre}</Text>
          </View>
          {unidad.proyectoEtapa && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Etapa</Text>
              <Text style={styles.tableColValue}>{unidad.proyectoEtapa}</Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Depto</Text>
            <Text style={styles.tableColValue}>{unidad.deptoNumero}</Text>
          </View>
          {unidad.estacionamientoNumero && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Estac.</Text>
              <Text style={styles.tableColValue}>{unidad.estacionamientoNumero}</Text>
            </View>
          )}
        </View>

        {/* Fechas */}
        <View style={styles.table}>
          {Object.entries(fechas).map(([key, val]) =>
            val ? (
              <View key={key} style={styles.tableRow}>
                <Text style={styles.tableColLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                <Text style={styles.tableColValue}>{val}</Text>
              </View>
            ) : null
          )}
        </View>

        {/* Precios Lista */}
        <View style={styles.table}>
          {['depto', 'estacionamiento', 'bodega', 'totalLista'].map((field) => (
            <View key={field} style={styles.tableRow}>
              <Text style={styles.tableColLabel}>{field === 'totalLista' ? 'Total Lista' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
              <Text style={styles.tableColValue}>{preciosLista[field].toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Resumen Financiero */}
        <View style={styles.table}>
          {['precioMinimoVenta', 'totalEscrituracion', 'subsidio', 'diferencia'].map((f) => (
            <View key={f} style={styles.tableRow}>
              <Text style={styles.tableColLabel}>{f.replace(/([A-Z])/g, ' $1')}</Text>
              <Text style={styles.tableColValue}>{resumenFinanciero[f]?.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Broker y Comisión */}
        {broker && (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Broker</Text>
              <Text style={styles.tableColValue}>{broker.nombre}</Text>
            </View>
            {(broker.razonSocial || broker.rut) && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Razón / RUT</Text>
                <Text style={styles.tableColValue}>{broker.razonSocial || broker.rut}</Text>
              </View>
            )}
          </View>
        )}

        {comisionBroker && (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Comisión Bruta</Text>
              <Text style={styles.tableColValue}>{comisionBroker.montoBruto.toLocaleString()}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Incluye IVA</Text>
              <Text style={styles.tableColValue}>{comisionBroker.incluyeIVA ? 'Sí' : 'No'}</Text>
            </View>
          </View>
        )}

        {/* Vendedor */}
        {vendedor && (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Vendedor</Text>
              <Text style={styles.tableColValue}>{vendedor.nombreCompleto}</Text>
            </View>
          </View>
        )}

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
};

export default LiquidacionGestionDocument;
