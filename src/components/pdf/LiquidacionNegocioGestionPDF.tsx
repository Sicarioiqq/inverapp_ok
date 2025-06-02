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
  promociones?: Array<{ nombre: string; descripcion?: string; valorEstimado?: number; is_against_discount?: boolean }>;
  resumenFinanciero: {
    precioMinimoVenta: number;
    totalEscrituracion: number;
    totalRecuperacion?: number;
    subsidio?: number;
    diferencia?: number;
    recuperacionReal?: number;
  };
  broker?: { nombre: string; razonSocial?: string; rut?: string };
  comisionBroker?: {
    montoBruto: number;
    incluyeIVA: boolean;
    montoNeto?: number;
    porcentajePrimerPago?: number;
    numeroPagos?: number;
    pagaSecundario?: boolean;
    primerPago?: number;
    segundoPago?: number;
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
  logo: { width: 120, height: 40, objectFit: 'contain', alignSelf: 'center', marginBottom: 16 },
  sectionHeader: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: colors.text },
  table: { width: 'auto', marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'column' },
  tableRow: {
  flexDirection: 'row',
 borderBottomWidth: 1,
 borderBottomColor: colors.border,
},
  tableColLabel: { width: '30%', backgroundColor: colors.backgroundLight, borderRightWidth: 1, borderColor: colors.border, padding: 4 },
  tableColValue: { width: '70%', padding: 4 },
  footer: { position: 'absolute', fontSize: 6, bottom: 10, left: 20, right: 20, textAlign: 'center', color: colors.text, borderTopWidth: 1, borderColor: colors.border, paddingTop: 4 },
});

export const LiquidacionGestionDocument: React.FC<LiquidacionGestionData> = (props) => {
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
                <Text style={styles.tableColLabel}>Descuento Columna</Text>
                <Text style={styles.tableColValue}>{(descuentos.columnaPct * 100).toFixed(2)}%</Text>
              </View>
            )}
            {descuentos.adicionalPct !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Descuento Adicional</Text>
                <Text style={styles.tableColValue}>{(descuentos.adicionalPct * 100).toFixed(2)}%</Text>
              </View>
            )}
            {descuentos.otrosPct !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Otros Descuentos</Text>
                <Text style={styles.tableColValue}>{(descuentos.otrosPct * 100).toFixed(2)}%</Text>
              </View>
            )}
          </View>
        )}
        {promociones && promociones.length > 0 && (
          <View style={styles.table}>
            {promociones.map((p, i) => {
              const esContraDescuento = p.is_against_discount === true;
              const rowStyle = esContraDescuento ? [styles.tableRow, { backgroundColor: '#FFE5E5' }] : styles.tableRow;
              return (
                <View key={i} style={rowStyle}>
                  <Text style={styles.tableColLabel}>
                    {p.nombre} {esContraDescuento ? '(Contra Descuento)' : ''}
                  </Text>
                  <Text style={styles.tableColValue}>{p.descripcion} {p.valorEstimado ?? ''}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Resumen Financiero */}
        <Text style={styles.sectionHeader}>Resumen Financiero</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Precio Mínimo de Venta</Text>
            <Text style={styles.tableColValue}>{resumenFinanciero.precioMinimoVenta.toLocaleString()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Recuperación Real</Text>
            <Text style={styles.tableColValue}>{(resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0)).toLocaleString()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Total Escriturituración</Text>
            <Text style={styles.tableColValue}>{resumenFinanciero.totalEscrituracion.toLocaleString()}</Text>
          </View>
          {resumenFinanciero.subsidio !== undefined && (
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Bono Pie</Text>
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

        {/* Vendedor Interno */}
        {vendedor && (
          <>
            <Text style={styles.sectionHeader}>Vendedor Interno</Text>
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

      {/* Segunda Página: Detalle de Comisión */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Detalle de Comisión</Text>

        {/* Broker */}
        {broker && (
          <>
            <Text style={styles.sectionHeader}>Broker</Text>
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
          <>
            <Text style={styles.sectionHeader}>Comisión Broker</Text>
            <View style={styles.table}>
              {/* Agregar Paga Secundario */}
              {comisionBroker.pagaSecundario !== undefined && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Paga Secundario</Text>
                  <Text style={styles.tableColValue}>{comisionBroker.pagaSecundario ? 'SI' : 'NO'}</Text>
                </View>
              )}
              {/* Monto Bruto ya está aquí */}
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Monto Bruto</Text>
                <Text style={styles.tableColValue}>{comisionBroker.montoBruto.toLocaleString()} UF</Text>
              </View>
              {/* Agregar Comisión Neta */}
              {comisionBroker.montoNeto !== undefined && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Comisión Neta</Text>
                  <Text style={styles.tableColValue}>{(comisionBroker.montoNeto).toFixed(2)} UF</Text>
                </View>
              )}
              {/* Incluye IVA ya está aquí */}
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Incluye IVA</Text>
                <Text style={styles.tableColValue}>{comisionBroker.incluyeIVA ? 'Sí' : 'No'}</Text>
              </View>
               {/* Agregar Número de Pagos */}
               {comisionBroker.numeroPagos !== undefined && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Número de Pagos</Text>
                  <Text style={styles.tableColValue}>{comisionBroker.numeroPagos}</Text>
                </View>
              )}
              {/* Agregar Primer Pago */}
              {comisionBroker.primerPago !== undefined && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Primer Pago</Text>
                  <Text style={styles.tableColValue}>{(comisionBroker.primerPago).toFixed(2)} UF</Text>
                </View>
              )}
               {/* Agregar Segundo Pago si aplica */}
               {comisionBroker.segundoPago !== undefined && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableColLabel}>Segundo Pago</Text>
                  <Text style={styles.tableColValue}>{(comisionBroker.segundoPago).toFixed(2)} UF</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Resumen Liquidación */}
        <Text style={styles.sectionHeader}>Resumen Liquidación ({numeroReserva})</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, { fontWeight: 'bold', backgroundColor: colors.backgroundLight }]}>
            <View style={[styles.tableColLabel, { width: '15%', borderRightWidth: 0 }]}><Text>Proyecto</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Depto</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Precio Lista</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Desc. Col.</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Desc. Adic.</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Otros Desc.</Text></View>
            <View style={[styles.tableColLabel, { width: '15%', borderRightWidth: 0 }]}><Text>Precio Mín. Rec.</Text></View>
            <View style={[styles.tableColLabel, { width: '10%', borderRightWidth: 0 }]}><Text>Desc. Disp.</Text></View>
            <View style={[styles.tableColLabel, { width: '10%' }]}><Text>Rec. Real</Text></View>
          </View>
          {/* Fila de datos (asumiendo una sola unidad por liquidación) */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColValue, { width: '15%' }]}><Text>{unidad.proyectoNombre}</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{unidad.deptoNumero}</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{preciosLista.depto.toLocaleString()}</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{(((descuentos?.columnaPct ?? 0) * 100).toFixed(2))}%</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{(((descuentos?.adicionalPct ?? 0) * 100).toFixed(2))}%</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{(((descuentos?.otrosPct ?? 0) * 100).toFixed(2))}%</Text></View>
            {/* Calcular Precio Mínimo a Recuperar - Asegurar orden de operaciones */}
            <View style={[styles.tableColValue, { width: '15%' }]}><Text>{(preciosLista.depto * (1 - (descuentos?.columnaPct ?? 0)) * (1 - (descuentos?.adicionalPct ?? 0)) * (1 - (descuentos?.otrosPct ?? 0))).toLocaleString()} UF</Text></View>
            {/* Calcular Descuento Disponible - Asegurar orden de operaciones */}
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{(preciosLista.depto - (preciosLista.depto * (1 - (descuentos?.columnaPct ?? 0)) * (1 - (descuentos?.adicionalPct ?? 0)) * (1 - (descuentos?.otrosPct ?? 0)))).toLocaleString()} UF</Text></View>
            {/* Recuperación Real - Usar el valor pasado y asegurar que no sea N/A si el backend lo envía */}
            <View style={[styles.tableColValue, { width: '10%' }]}>
              <Text>{(
                (resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0))
                - ((preciosLista.estacionamiento || 0) + (preciosLista.bodega || 0))
              ).toLocaleString()} UF</Text>
            </View>
          </View>
          {/* Agregar celdas Bono Pie y Cálculo Adicional */}
          <View style={styles.tableRow}>
            {/* Celdas vacías para alinear con las columnas de datos */}
            <View style={[styles.tableColLabel, { width: '15%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            <View style={[styles.tableColLabel, { width: '10%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            <View style={[styles.tableColLabel, { width: '10%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            <View style={[styles.tableColLabel, { width: '10%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            <View style={[styles.tableColLabel, { width: '10%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            <View style={[styles.tableColLabel, { width: '10%', backgroundColor: 'transparent', borderRightWidth: 0 }]}></View>
            {/* Celda Bono Pie bajo Desc. Disp. */}
            <View style={[styles.tableColLabel, { width: '15%' }]}><Text>Bono Pie:</Text></View>
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{(((preciosLista.depto - (resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0)))/preciosLista.depto)*100).toFixed(2)} %</Text></View>
            {/* Celda cálculo bajo Rec. Real */}
            {/* Asegurar que Precio Lista sea distinto de cero para evitar división por cero */}
            <View style={[styles.tableColValue, { width: '10%' }]}><Text>{((preciosLista.depto - (resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0)))).toLocaleString() ?? '0'} UF</Text></View>
          </View>
        </View>

        {/* Sección de Cálculos Adicionales según imagen */}
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {/* Bloque Izquierdo */}
          <View style={[styles.table, { width: '50%', marginRight: 4 }]}>
            {/* Descuento Disponible (Cálculo) */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Descuento Disponible</Text>
              <Text style={styles.tableColValue}>
                {(
                  (resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0))
                  - (preciosLista.depto * (1 - (descuentos?.columnaPct ?? 0)) * (1 - (descuentos?.adicionalPct ?? 0)) * (1 - (descuentos?.otrosPct ?? 0)))
                  - ((preciosLista.estacionamiento || 0) + (preciosLista.bodega || 0))
                ).toLocaleString()} UF
              </Text>
            </View>
            {/* Cashback UF */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Cashback UF</Text>
              <Text style={styles.tableColValue}>
                {promociones && promociones.some(p => p.is_against_discount && (p.valorEstimado ?? 0) > 0)
                  ? promociones.filter(p => p.is_against_discount).reduce((sum, p) => sum + (p.valorEstimado ?? 0), 0).toLocaleString() + ' UF'
                  : 'No Aplica'}
              </Text>
            </View>
            {/* Comisión Broker (Monto Bruto) */}
            {comisionBroker?.montoBruto !== undefined && (
              <View style={styles.tableRow}>
                <Text style={styles.tableColLabel}>Comisión Broker</Text>
                <Text style={styles.tableColValue}>{comisionBroker.montoBruto.toLocaleString()} UF</Text>
              </View>
            )}
            {/* Descuento Menos Comisión Broker y Cashback */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Desc. Menos Com. Broker y Cashback</Text>
              <Text style={styles.tableColValue}>
                {(
                  (resumenFinanciero.totalEscrituracion - (resumenFinanciero.subsidio ?? 0))
                  - (preciosLista.depto * (1 - (descuentos?.columnaPct ?? 0)) * (1 - (descuentos?.adicionalPct ?? 0)) * (1 - (descuentos?.otrosPct ?? 0)))
                  - (promociones && promociones.some(p => p.is_against_discount && (p.valorEstimado ?? 0) > 0) ? promociones.filter(p => p.is_against_discount).reduce((sum, p) => sum + (p.valorEstimado ?? 0), 0) : 0)
                  - (comisionBroker?.montoBruto ?? 0)
                  - ((preciosLista.estacionamiento || 0) + (preciosLista.bodega || 0))
                ).toLocaleString()} UF
              </Text>
            </View>
          </View>

          {/* Bloque Derecho (Según imagen) */}
          <View style={[styles.table, { width: '50%', marginLeft: 4 }]}>
             {/* CashBack (Estado) */}
             <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>CashBack</Text>
              <Text style={styles.tableColValue}>
                 {promociones && promociones.some(p => p.is_against_discount) ? 'SI' : 'NO'}
              </Text>
            </View>
             {/* Giftcard Broker */}
             <View style={styles.tableRow}>
              <Text style={styles.tableColLabel}>Giftcard Broker</Text>
              <Text style={styles.tableColValue}>
                {promociones && promociones.some(p => (p as any).promotion_type === 'Giftcard') ? 'SI' : 'No Aplica'}
              </Text>
            </View>
          </View>
        </View>

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