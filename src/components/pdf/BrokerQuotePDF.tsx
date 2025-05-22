import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a font if you want something other than the default Helvetica
// For example, if you want Times New Roman which often looks more formal:
// Font.register({ family: 'Times-Roman', src: 'http://fonts.gstatic.com/s/timesnewroman/v13/timesnewroman.ttf' });
// For simplicity, we'll stick to default or a basic serif if needed.

// Helper function for formatting
const formatCurrency = (amount: number | null): string => {
  if (amount === null || isNaN(amount) || !isFinite(amount)) return '0.00';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const ufToPesos = (uf: number | null, ufValue: number | null): string => {
  if (uf === null || ufValue === null || isNaN(uf) || !isFinite(uf) || isNaN(ufValue) || !isFinite(ufValue)) return '$ 0';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(uf * ufValue);
};

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica', // Default font
    fontSize: 10,
  },
  section: {
    marginBottom: 10,
  },
  header: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Helvetica-Bold',
  },
  subHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
  },
  text: {
    marginBottom: 3,
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    display: 'table',
    width: 'auto',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: 'auto',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderBottomColor: '#000',
    borderWidth: 1,
    backgroundColor: '#f2f2f2',
    textAlign: 'center',
    padding: 5,
    fontFamily: 'Helvetica-Bold',
  },
  tableCol: {
    width: 'auto',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    padding: 5,
  },
  tableColLeft: {
    flexGrow: 1, // Allow first column to take available space
    width: 'auto',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    padding: 5,
  },
  tableColRight: {
    width: '18%', // Adjust width for numerical columns
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    textAlign: 'right',
    padding: 5,
  },
  tableColSmallRight: {
    width: '10%', // Adjust width for percentage columns
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    textAlign: 'right',
    padding: 5,
  },
  tableColTinyRight: {
    width: '15%', // Adjust width for small numerical columns
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    textAlign: 'right',
    padding: 5,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 5,
    paddingTop: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: 'grey',
  },
  dateInfo: {
    textAlign: 'right',
    marginBottom: 10,
    fontSize: 9,
  },
  quotationNumber: {
    textAlign: 'right',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  }
});

interface BrokerQuotePDFProps {
  cliente: string;
  rut: string;
  ufValue: number | null;
  selectedUnidad: any; // Using 'any' for simplicity, ideally use 'Unidad' interface
  addedSecondaryUnits: any[]; // Using 'any[]' for simplicity
  quotationType: 'descuento' | 'bono' | 'mix';
  discountAmount: number; // Discount in %
  bonoAmount: number; // Bono in UF (configuration)
  pagoReserva: number;
  pagoPromesa: number;
  pagoPromesaPct: number;
  pagoPie: number;
  pagoPiePct: number;
  pagoBonoPieCotizacion: number; // Bono in UF (payment form)
  precioBaseDepartamento: number;
  precioDescuentoDepartamento: number;
  precioDepartamentoConDescuento: number;
  precioTotalSecundarios: number;
  totalEscritura: number;
  pagoCreditoHipotecarioCalculado: number;
  totalFormaDePago: number;
}

const BrokerQuotePDF: React.FC<BrokerQuotePDFProps> = ({
  cliente,
  rut,
  ufValue,
  selectedUnidad,
  addedSecondaryUnits,
  quotationType,
  discountAmount,
  bonoAmount, // This is the configuration bono amount
  pagoReserva,
  pagoPromesa,
  pagoPromesaPct,
  pagoPie,
  pagoPiePct,
  pagoBonoPieCotizacion, // This is the actual bono being applied in payment form
  precioBaseDepartamento,
  precioDescuentoDepartamento,
  precioDepartamentoConDescuento,
  precioTotalSecundarios,
  totalEscritura,
  pagoCreditoHipotecarioCalculado,
  totalFormaDePago,
}) => {
  const currentDate = new Date().toLocaleDateString('es-CL');

  // Determine the effective discount percentage for the department for display in the price table
  let effectiveDeptDiscountPct = 0;
  if (selectedUnidad?.valor_lista && selectedUnidad.valor_lista > 0) {
    if (quotationType === 'descuento' || quotationType === 'mix') {
      effectiveDeptDiscountPct = discountAmount; // This is already the % to display
    } else { // 'bono' type, no direct % discount shown on department
      effectiveDeptDiscountPct = 0;
    }
  }

  // Calculate the actual discount UF applied to the department for the price table
  let actualDeptDiscountUF = precioDescuentoDepartamento;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={{ marginBottom: 20 }}>
          {/* You can add an <Image /> component here for logos later */}
          {/* <Image src="path/to/your/logo.png" style={{ width: 100, height: 50 }} /> */}
          <Text style={[styles.header, { marginTop: 10 }]}>COTIZACIÓN DE PROPIEDAD</Text>
          <Text style={styles.dateInfo}>{currentDate}</Text>
          <Text style={styles.quotationNumber}>COTIZACIÓN Nº: [PENDIENTE]</Text>
          <Text style={styles.dateInfo}>UF: $ {ufValue ? ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</Text>
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>I. INFORMACIÓN DEL CLIENTE</Text>
          <Text style={styles.text}><Text style={styles.boldText}>SEÑOR(A):</Text> {cliente || 'N/A'}</Text>
          <Text style={styles.text}><Text style={styles.boldText}>RUT:</Text> {rut || 'N/A'}</Text>
        </View>

        {/* Unit Characteristics */}
        {selectedUnidad && (
          <View style={styles.section}>
            <Text style={styles.subHeader}>II. CARACTERÍSTICAS DE LA PROPIEDAD</Text>
            <View style={styles.table}>
                <View style={styles.tableRow}>
                    <View style={styles.tableColHeader}><Text>PROYECTO</Text></View>
                    <View style={styles.tableColHeader}><Text>N° BIEN</Text></View>
                    <View style={styles.tableColHeader}><Text>TIPOLOGÍA</Text></View>
                    <View style={styles.tableColHeader}><Text>PISO</Text></View>
                    <View style={styles.tableColHeader}><Text>SUP. ÚTIL</Text></View>
                    <View style={styles.tableColHeader}><Text>SUP. TERRAZA</Text></View>
                    <View style={styles.tableColHeader}><Text>SUP. TOTAL</Text></View>
                </View>
                <View style={styles.tableRow}>
                    <View style={styles.tableCol}><Text>{selectedUnidad.proyecto_nombre || 'N/A'}</Text></View>
                    <View style={styles.tableCol}><Text>{selectedUnidad.unidad || 'N/A'}</Text></View>
                    <View style={styles.tableCol}><Text>{selectedUnidad.tipologia || 'N/A'}</Text></View>
                    <View style={styles.tableCol}><Text>{selectedUnidad.piso || '-'}</Text></View>
                    <View style={styles.tableCol}><Text>{formatCurrency(selectedUnidad.sup_util)} m²</Text></View>
                    <View style={styles.tableCol}><Text>{formatCurrency(selectedUnidad.sup_terraza)} m²</Text></View>
                    <View style={styles.tableCol}><Text>{formatCurrency(selectedUnidad.sup_total)} m²</Text></View>
                </View>
            </View>
          </View>
        )}

        {/* Prices Section */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>III. PRECIOS</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text>ÍTEM</Text></View>
              <View style={styles.tableColHeader}><Text>PRECIO LISTA (UF)</Text></View>
              <View style={styles.tableColHeader}><Text>DSCTO. %</Text></View>
              <View style={styles.tableColHeader}><Text>DSCTO. (UF)</Text></View>
              <View style={styles.tableColHeader}><Text>PRECIO NETO (UF)</Text></View>
              <View style={styles.tableColHeader}><Text>PRECIO NETO ($)</Text></View>
            </View>
            {selectedUnidad && (
              <View style={styles.tableRow}>
                <View style={styles.tableCol}><Text>Departamento {selectedUnidad.unidad}</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>
                <View style={styles.tableColSmallRight}><Text>{formatCurrency(effectiveDeptDiscountPct)}%</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(actualDeptDiscountUF)}</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(precioDepartamentoConDescuento)}</Text></View>
                <View style={styles.tableColRight}><Text>{ufToPesos(precioDepartamentoConDescuento, ufValue)}</Text></View>
              </View>
            )}
            {addedSecondaryUnits.map(unit => (
              <View style={styles.tableRow} key={unit.id}>
                <View style={styles.tableCol}><Text>{unit.tipo_bien} {unit.unidad}</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(unit.valor_lista)}</Text></View>
                <View style={styles.tableColSmallRight}><Text>0.00%</Text></View> {/* Secundarios no tienen descuento en este contexto */}
                <View style={styles.tableColRight}><Text>0.00</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(unit.valor_lista)}</Text></View>
                <View style={styles.tableColRight}><Text>{ufToPesos(unit.valor_lista, ufValue)}</Text></View>
              </View>
            ))}
            <View style={styles.tableRow}>
                <View style={styles.tableCol}><Text style={styles.boldText}>TOTAL ESCRITURA</Text></View>
                <View style={styles.tableColRight}><Text></Text></View>
                <View style={styles.tableColSmallRight}><Text></Text></View>
                <View style={styles.tableColRight}><Text></Text></View>
                <View style={styles.tableColRight}><Text style={styles.boldText}>{formatCurrency(totalEscritura)}</Text></View>
                <View style={styles.tableColRight}><Text style={styles.boldText}>{ufToPesos(totalEscritura, ufValue)}</Text></View>
            </View>
          </View>
        </View>

        {/* Payment Method Section */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>IV. FORMA DE PAGO</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text>GLOSA</Text></View>
              <View style={styles.tableColHeader}><Text>%</Text></View>
              <View style={styles.tableColHeader}><Text>PESOS</Text></View>
              <View style={styles.tableColHeader}><Text>UF</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableColLeft}><Text>Reserva</Text></View>
              <View style={styles.tableColTinyRight}><Text>{totalEscritura > 0 ? formatCurrency((pagoReserva / totalEscritura) * 100) : '0.00'}%</Text></View>
              <View style={styles.tableColRight}><Text>{ufToPesos(pagoReserva, ufValue)}</Text></View>
              <View style={styles.tableColRight}><Text>{formatCurrency(pagoReserva)}</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableColLeft}><Text>Promesa</Text></View>
              <View style={styles.tableColTinyRight}><Text>{formatCurrency(pagoPromesaPct)}%</Text></View>
              <View style={styles.tableColRight}><Text>{ufToPesos(pagoPromesa, ufValue)}</Text></View>
              <View style={styles.tableColRight}><Text>{formatCurrency(pagoPromesa)}</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableColLeft}><Text>Pie</Text></View>
              <View style={styles.tableColTinyRight}><Text>{formatCurrency(pagoPiePct)}%</Text></View>
              <View style={styles.tableColRight}><Text>{ufToPesos(pagoPie, ufValue)}</Text></View>
              <View style={styles.tableColRight}><Text>{formatCurrency(pagoPie)}</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableColLeft}><Text>Crédito Hipotecario</Text></View>
              <View style={styles.tableColTinyRight}><Text>{totalEscritura > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalEscritura) * 100) : '0.00'}%</Text></View>
              <View style={styles.tableColRight}><Text>{ufToPesos(pagoCreditoHipotecarioCalculado, ufValue)}</Text></View>
              <View style={styles.tableColRight}><Text>{formatCurrency(pagoCreditoHipotecarioCalculado)}</Text></View>
            </View>
            {pagoBonoPieCotizacion > 0 && (
              <View style={styles.tableRow}>
                <View style={styles.tableColLeft}><Text>Bono Pie</Text></View>
                <View style={styles.tableColTinyRight}><Text>{totalEscritura > 0 ? formatCurrency((pagoBonoPieCotizacion / totalEscritura) * 100) : '0.00'}%</Text></View>
                <View style={styles.tableColRight}><Text>{ufToPesos(pagoBonoPieCotizacion, ufValue)}</Text></View>
                <View style={styles.tableColRight}><Text>{formatCurrency(pagoBonoPieCotizacion)}</Text></View>
              </View>
            )}
            <View style={styles.tableRow}>
                <View style={styles.tableColLeft}><Text style={styles.boldText}>TOTAL</Text></View>
                <View style={styles.tableColTinyRight}><Text style={styles.boldText}>{totalEscritura > 0 ? formatCurrency((totalFormaDePago / totalEscritura) * 100) : '0.00'}%</Text></View>
                <View style={styles.tableColRight}><Text style={styles.boldText}>{ufToPesos(totalFormaDePago, ufValue)}</Text></View>
                <View style={styles.tableColRight}><Text style={styles.boldText}>{formatCurrency(totalFormaDePago)}</Text></View>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>V. NOTAS</Text>
          <Text style={styles.text}>1.- Validez cotización 7 días corridos a contar de esta fecha y no constituye reserva de compra.</Text>
          <Text style={styles.text}>2.- El valor cancelado por concepto Reserva, será abonado a Pie.</Text>
          <Text style={styles.text}>3.- Serán de cargo exclusivo del comprador los gastos por concepto de estudio de títulos y redacción de escritura.</Text>
          <Text style={styles.text}>4.- La Promotora se reserva el derecho de modificar los precios y condiciones sin previo aviso.</Text>
          <Text style={styles.text}>5.- El pie financiado o abonado con Bono Pie será de responsabilidad exclusiva del Cliente.</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generated by InverAPP - {currentDate}
        </Text>
      </Page>
    </Document>
  );
};

export default BrokerQuotePDF;