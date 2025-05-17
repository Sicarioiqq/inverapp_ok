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
  unidad: {
    proyectoNombre: string;
    proyectoEtapa?: string;
    deptoNumero: string;
    estacionamientoNumero?: string;
    bodegaNumero?: string;
  };
  fechas: { reserva?: string; promesa?: string; escritura?: string };
  preciosLista: {
    depto: number;
    estacionamiento?: number;
    bodega?: number;
    totalLista: number;
  };
  descuentos?: { columnaPct?: number; adicionalPct?: number; otrosPct?: number };
  promociones?: Array<{ nombre: string; descripcion?: string; valorEstimado?: number }>;
  resumenFinanciero: {
    precioMinimoVenta: number;
    totalEscrituracion: number;
    totalRecuperacion?: number;
    subsidio?: number;
    diferencia?: number;
  };
  broker?: { nombre: string; razonSocial?: string; rut?: string };
  comisionBroker?: {
    montoBruto: number;
    incluyeIVA: boolean;
    montoNeto?: number;
    porcentajePrimerPago?: number;
    numeroPagos?: number;
  };
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
  sectionHeader: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: colors.text },
  table: { display: 'table', width: 'auto', marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  tableRow: { flexDirection: 'row' },
  tableColLabel: { width: '30%', backgroundColor: colors.backgroundLight, borderRightWidth: 1, borderColor: colors.border, padding: 4 },
  tableColValue: { width: '70%', padding: 4 },
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
        <Text style={styles.sectionHeader}>Cliente</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nombre</Text>
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

        {/* Detalle de Unidad */}
        <Text style={styles.sectionHeader}>Detalle de Unidad</Text>
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
          {unidad.bodegaNumero && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Bodega</Text>
              <Text style={styles.tableColValue}>{unidad.bodegaNumero}</Text>
            </View>
          )}
        </View>

        {/* Fechas */}
        <Text style={styles.sectionHeader}>Fechas</Text>
        <View style={styles.table}>
          {fechas.reserva && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Reserva</Text>
              <Text style={styles.tableColValue}>{fechas.reserva}</Text>
            </View>
          )}
          {fechas.promesa && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Promesa</Text>
              <Text style={styles.tableColValue}>{fechas.promesa}</Text>
            </View>
          )}
          {fechas.escritura && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Escritura</Text>
              <Text style={styles.tableColValue}>{fechas.escritura}</Text>
            </View>
          )}
        </View>

        {/* Precios de Lista */}
        <Text style={styles.sectionHeader}>Precios de Lista</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Depto</Text>
            <Text style={styles.tableColValue}>{preciosLista.depto.toLocaleString()}</Text>
          </View>
          {preciosLista.estacionamiento !== undefined && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Estac.</Text>
              <Text style={styles.tableColValue}>{preciosLista.estacionamiento.toLocaleString()}</Text>
            </View>
          )}
          {preciosLista.bodega !== undefined && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Bodega</Text>
              <Text style={styles.tableColValue}>{preciosLista.bodega.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Total Lista</Text>
            <Text style={styles.tableColValue}>{preciosLista.totalLista.toLocaleString()}</Text>
          </View>
        </View>

        {/* Descuentos y Promociones */}
        <Text style={styles.sectionHeader}>Descuentos y Promociones</Text>
        {descuentos && (
          <View style={styles.table}>
            {descuentos.columnaPct !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Descto. Columna</Text>
                <Text style={styles.tableColValue}>{descuentos.columnaPct}%</Text>
              </View>
            )}
            {descuentos.adicionalPct !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Descto. Adic.</Text>
                <Text style={styles.tableColValue}>{descuentos.adicionalPct}%</Text>
              </View>
            )}
            {descuentos.otrosPct !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Otros Desctos.</Text>
                <Text style={styles.tableColValue}>{descuentos.otrosPct}%</Text>
              </View>
            )}
          </View>
        )}
        {promociones && promociones.length > 0 && (
          <View style={styles.table}>
            {promociones.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableColLabel}>{p.nombre}</Text>
                <Text style={styles.tableColValue}>{p.descripcion} {p.valorEstimado ?? ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Resumen Financiero */}
        <Text style={styles.sectionHeader}>Resumen Financiero</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Precio Min. Vta.</Text>
            <Text style={styles.tableColValue}>{resumenFinanciero.precioMinimoVenta.toLocaleString()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Total Escritur.</Text>
            <Text style={styles.tableColValue}>{resumenFinanciero.totalEscrituracion.toLocaleString()}</Text>
          </View>
          {resumenFinanciero.subsidio !== undefined && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Subsidio</Text>
              <Text style={styles.tableColValue}>{resumenFinanciero.subsidio.toLocaleString()}</Text>
            </View>
          )}
          {resumenFinanciero.diferencia !== undefined && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Diferencia</Text>
              <Text style={styles.tableColValue}>{resumenFinanciero.diferencia.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Broker */}
        {broker && (
          <>n            <Text style={styles.sectionHeader}>Broker</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Nombre</Text>
                <Text style={styles.tableColValue}>{broker.nombre}</Text>
              </View>
              {(broker.razonSocial || broker.rut) && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Razón / RUT</Text>
                  <Text style={styles.tableColValue}>{broker.razonSocial || broker.rut}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Comisión Broker */}
        {comisionBroker && (
          <>n            <Text style={styles.sectionHeader}>Comisión Broker</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Monto Bruto</Text>
                <Text style={styles.tableColValue}>{comisionBroker.montoBruto.toLocaleString()}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Incluye IVA</Text>
                <Text style={styles.tableColValue}>{comisionBroker.incluyeIVA ? 'Sí' : 'No'}</Text>
              </View>
            </View>
          </>
        )}

        {/* Vendedor Interno */}
        {vendedor && (
          <>n            <Text style={styles.sectionHeader}>Vendedor Interno</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Nombre</Text>
                <Text style={styles.tableColValue}>{vendedor.nombreCompleto}</Text>
              </View>
            </View>
          </>
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
