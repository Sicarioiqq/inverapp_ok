import React from 'react';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';



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



// Define base styles as separate objects/constants BEFORE StyleSheet.create

const baseStyles = {

  tableCol: { // A general base style for merging

    borderStyle: 'solid',

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

  },

  tableColHeader: { // A general base header style for merging

    borderStyle: 'solid',

    borderColor: '#bfbfbf',

    borderBottomColor: '#000',

    borderWidth: 1,

    backgroundColor: '#f2f2f2',

    textAlign: 'center',

    padding: 5,

    fontFamily: 'Helvetica-Bold',

  },

  tableColRight: { // A general base right-aligned style for merging

    borderStyle: 'solid',

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

    textAlign: 'right',

  },

  tableColSmallRight: { // A general base small right-aligned style for merging (for percentages)

    borderStyle: 'solid',

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

    textAlign: 'right',

  },

};





// Create styles using the baseStyles

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

    width: 'auto', // Use 'auto' to allow table to fit content, or '100%' for full width

    marginBottom: 10,

  },

  tableRow: {

    flexDirection: 'row',

  },

  

  // Specific column widths for Unit Characteristics table

  unitTableColHeader: {

    width: '14.28%', // 100% / 7 columns

    ...baseStyles.tableColHeader, // Merge base header properties

  },

  unitTableCol: {

    width: '14.28%', // 100% / 7 columns

    ...baseStyles.tableCol, // Merge base column properties

  },



  // Specific column styles for Prices table

  // Headers

  pricesHeaderItem: { width: '25%', ...baseStyles.tableColHeader }, // ÍTEM

  pricesHeaderListPrice: { width: '15%', ...baseStyles.tableColHeader }, // PRECIO LISTA (UF)

  pricesHeaderDiscountPct: { width: '10%', ...baseStyles.tableColHeader }, // DSCTO. %

  pricesHeaderDiscountUF: { width: '15%', ...baseStyles.tableColHeader }, // DSCTO. (UF)

  pricesHeaderNetPriceUF: { width: '15%', ...baseStyles.tableColHeader }, // PRECIO NETO (UF)

  pricesHeaderNetPriceCLP: { width: '20%', ...baseStyles.tableColHeader }, // PRECIO NETO ($)

  // Data cells

  pricesColItem: { width: '25%', ...baseStyles.tableCol },

  pricesColListPrice: { width: '15%', ...baseStyles.tableColRight },

  pricesColDiscountPct: { width: '10%', ...baseStyles.tableColSmallRight },

  pricesColDiscountUF: { width: '15%', ...baseStyles.tableColRight },

  pricesColNetPriceUF: { width: '15%', ...baseStyles.tableColRight },

  pricesColNetPriceCLP: { width: '20%', ...baseStyles.tableColRight },



  // Specific column styles for Payment Method table

  // Headers

  paymentHeaderGlosa: { width: '35%', ...baseStyles.tableColHeader }, // GLOSA

  paymentHeaderPct: { width: '10%', ...baseStyles.tableColHeader }, // %

  paymentHeaderPesos: { width: '25%', ...baseStyles.tableColHeader }, // PESOS

  paymentHeaderUF: { width: '30%', ...baseStyles.tableColHeader }, // UF

  // Data cells

  paymentColGlosa: { width: '35%', ...baseStyles.tableCol },

  paymentColPct: { width: '10%', ...baseStyles.tableColSmallRight },

  paymentColPesos: { width: '25%', ...baseStyles.tableColRight },

  paymentColUF: { width: '30%', ...baseStyles.tableColRight },





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



// Alias for easier use in JSX - now this is safe as 'styles' is fully defined

const Styles = styles;



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

      <Page size="A4" style={Styles.page}>

        {/* Header Section */}

        <View style={{ marginBottom: 20 }}>

          {/* You can add an <Image /> component here for logos later */}

          {/* <Image src="path/to/your/logo.png" style={{ width: 100, height: 50 }} /> */}

          <Text style={[Styles.header, { marginTop: 10 }]}>COTIZACIÓN DE PROPIEDAD</Text>

          <Text style={Styles.dateInfo}>Fecha: {currentDate}</Text>

          <Text style={Styles.quotationNumber}>COTIZACIÓN Nº: [PENDIENTE]</Text>

          <Text style={Styles.dateInfo}>UF: $ {ufValue ? ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</Text>

        </View>



        {/* Client Information */}

        <View style={Styles.section}>

          <Text style={Styles.subHeader}>I. INFORMACIÓN DEL CLIENTE</Text>

          <Text style={Styles.text}><Text style={Styles.boldText}>SEÑOR(A):</Text> {cliente || 'N/A'}</Text>

          <Text style={Styles.text}><Text style={Styles.boldText}>RUT:</Text> {rut || 'N/A'}</Text>

        </View>



        {/* Unit Characteristics */}

        {selectedUnidad && (

          <View style={Styles.section}>

            <Text style={Styles.subHeader}>II. CARACTERÍSTICAS DE LA PROPIEDAD</Text>

            <View style={Styles.table}>

                <View style={Styles.tableRow}>

                    <View style={Styles.unitTableColHeader}><Text>PROYECTO</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>N° BIEN</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>TIPOLOGÍA</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>PISO</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>SUP. ÚTIL</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>SUP. TERRAZA</Text></View>

                    <View style={Styles.unitTableColHeader}><Text>SUP. TOTAL</Text></View>

                </View>

                <View style={Styles.tableRow}>

                    <View style={Styles.unitTableCol}><Text>{selectedUnidad.proyecto_nombre || 'N/A'}</Text></View>

                    <View style={Styles.unitTableCol}><Text>{selectedUnidad.unidad || 'N/A'}</Text></View>

                    <View style={Styles.unitTableCol}><Text>{selectedUnidad.tipologia || 'N/A'}</Text></View>

                    <View style={Styles.unitTableCol}><Text>{selectedUnidad.piso || '-'}</Text></View>

                    <View style={Styles.unitTableCol}><Text>{formatCurrency(selectedUnidad.sup_util)} m²</Text></View>

                    <View style={Styles.unitTableCol}><Text>{formatCurrency(selectedUnidad.sup_terraza)} m²</Text></View>

                    <View style={Styles.unitTableCol}><Text>{formatCurrency(selectedUnidad.sup_total)} m²</Text></View>

                </View>

            </View>

          </View>

        )}



        {/* Prices Section */}

        <View style={Styles.section}>

          <Text style={Styles.subHeader}>III. PRECIOS</Text>

          <View style={Styles.table}>

            {/* Table Headers */}

            <View style={Styles.tableRow}>

              <View style={Styles.pricesHeaderItem}><Text>ÍTEM</Text></View>

              <View style={Styles.pricesHeaderListPrice}><Text>PRECIO LISTA (UF)</Text></View>

              <View style={Styles.pricesHeaderDiscountPct}><Text>DSCTO. %</Text></View>

              <View style={Styles.pricesHeaderDiscountUF}><Text>DSCTO. (UF)</Text></View>

              <View style={Styles.pricesHeaderNetPriceUF}><Text>PRECIO NETO (UF)</Text></View>

              <View style={Styles.pricesHeaderNetPriceCLP}><Text>PRECIO NETO ($)</Text></View>

            </View>

            {/* Department Row */}

            {selectedUnidad && (

              <View style={Styles.tableRow}>

                <View style={Styles.pricesColItem}><Text>Departamento {selectedUnidad.unidad}</Text></View>

                <View style={Styles.pricesColListPrice}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>

                <View style={Styles.pricesColDiscountPct}><Text>{formatCurrency(effectiveDeptDiscountPct)}%</Text></View>

                <View style={Styles.pricesColDiscountUF}><Text>{formatCurrency(actualDeptDiscountUF)}</Text></View>

                <View style={Styles.pricesColNetPriceUF}><Text>{formatCurrency(precioDepartamentoConDescuento)}</Text></View>

                <View style={Styles.pricesColNetPriceCLP}><Text>{ufToPesos(precioDepartamentoConDescuento, ufValue)}</Text></View>

              </View>

            )}

            {/* Added Secondary Units Rows */}

            {addedSecondaryUnits.map(unit => (

              <View style={Styles.tableRow} key={unit.id}>

                <View style={Styles.pricesColItem}><Text>{unit.tipo_bien} {unit.unidad}</Text></View>

                <View style={Styles.pricesColListPrice}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                <View style={Styles.pricesColDiscountPct}><Text>0.00%</Text></View> {/* Secundarios no tienen descuento en este contexto */}

                <View style={Styles.pricesColDiscountUF}><Text>0.00</Text></View>

                <View style={Styles.pricesColNetPriceUF}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                <View style={Styles.pricesColNetPriceCLP}><Text>{ufToPesos(unit.valor_lista, ufValue)}</Text></View>

              </View>

            ))}

            {/* Total Row */}

            <View style={Styles.tableRow}>

                <View style={Styles.pricesColItem}><Text style={Styles.boldText}>TOTAL ESCRITURA</Text></View>

                <View style={Styles.pricesColListPrice}><Text></Text></View>

                <View style={Styles.pricesColDiscountPct}><Text></Text></View>

                <View style={Styles.pricesColDiscountUF}><Text></Text></View>

                <View style={Styles.pricesColNetPriceUF}><Text style={Styles.boldText}>{formatCurrency(totalEscritura)}</Text></View>

                <View style={Styles.pricesColNetPriceCLP}><Text style={Styles.boldText}>{ufToPesos(totalEscritura, ufValue)}</Text></View>

            </View>

          </View>

        </View>



        {/* Payment Method Section */}

        <View style={Styles.section}>

          <Text style={Styles.subHeader}>IV. FORMA DE PAGO</Text>

          <View style={Styles.table}>

            {/* Table Headers */}

            <View style={Styles.tableRow}>

              <View style={Styles.paymentHeaderGlosa}><Text>GLOSA</Text></View>

              <View style={Styles.paymentHeaderPct}><Text>%</Text></View>

              <View style={Styles.paymentHeaderPesos}><Text>PESOS</Text></View>

              <View style={Styles.paymentHeaderUF}><Text>UF</Text></View>

            </View>

            {/* Payment Rows */}

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Reserva</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalEscritura > 0 ? formatCurrency((pagoReserva / totalEscritura) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoReserva, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoReserva)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Promesa</Text></View>

              <View style={Styles.paymentColPct}><Text>{formatCurrency(pagoPromesaPct)}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoPromesa, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoPromesa)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Pie</Text></View>

              <View style={Styles.paymentColPct}><Text>{formatCurrency(pagoPiePct)}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoPie, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoPie)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Crédito Hipotecario</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalEscritura > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalEscritura) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoCreditoHipotecarioCalculado, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoCreditoHipotecarioCalculado)}</Text></View>

            </View>

            {pagoBonoPieCotizacion > 0 && (

              <View style={Styles.tableRow}>

                <View style={Styles.paymentColGlosa}><Text>Bono Pie</Text></View>

                <View style={Styles.paymentColPct}><Text>{totalEscritura > 0 ? formatCurrency((pagoBonoPieCotizacion / totalEscritura) * 100) : '0.00'}%</Text></View>

                <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoBonoPieCotizacion, ufValue)}</Text></View>

                <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoBonoPieCotizacion)}</Text></View>

              </View>

            )}

            {/* Total Row */}

            <View style={Styles.tableRow}>

                <View style={Styles.paymentColGlosa}><Text style={Styles.boldText}>TOTAL</Text></View>

                <View style={Styles.paymentColPct}><Text style={Styles.boldText}>{totalEscritura > 0 ? formatCurrency((totalFormaDePago / totalEscritura) * 100) : '0.00'}%</Text></View>

                <View style={Styles.paymentColPesos}><Text style={Styles.boldText}>{ufToPesos(totalFormaDePago, ufValue)}</Text></View>

                <View style={Styles.paymentColUF}><Text style={Styles.boldText}>{formatCurrency(totalFormaDePago)}</Text></View>

            </View>

          </View>

        </View>



        {/* Notes Section */}

        <View style={Styles.section}>

          <Text style={Styles.subHeader}>V. NOTAS</Text>

          <Text style={Styles.text}>1.- Cotización provisoria, información debe ser validada con cotización formal emitida por la inmobiliaria.</Text>

          <Text style={Styles.text}>2.- El valor cancelado por concepto Reserva, será abonado a Pie.</Text>

          <Text style={Styles.text}>3.- Serán de cargo exclusivo del comprador, los gastos que genere esta operación, tales como: tasación; estudio de títulos; confección de escritura; gastos notariales y conservador de bienes raíces.</Text>

          <Text style={Styles.text}>4.- Por no ser una cotización formal, los precios y condiciones pueden variar sin previo aviso.</Text>

        </View>



        {/* Footer */}

        <Text style={Styles.footer} fixed>

          Generada por InverAPP - {currentDate}

        </Text>

      </Page>

    </Document>

  );

};



export default BrokerQuotePDF;