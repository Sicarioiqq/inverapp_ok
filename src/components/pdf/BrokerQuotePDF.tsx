import React, { useState } from 'react';

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';



// Register fonts using Google Fonts CDN which has better CORS support

Font.register({

  family: 'Helvetica',

  src: 'https://fonts.gstatic.com/s/roboto/v29/KFOmCnqEu92Fr1Me5Q.ttf',

});



Font.register({

  family: 'Helvetica-Bold',

  src: 'https://fonts.gstatic.com/s/roboto/v29/KFOlCnqEu92Fr1MmWUlvAw.ttf',

  fontWeight: 'bold',

});



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



const baseStyles = {

  tableCol: {

    borderStyle: 'solid' as const,

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

  },

  tableColHeader: {

    borderStyle: 'solid' as const,

    borderColor: '#bfbfbf',

    borderBottomColor: '#000',

    borderWidth: 1,

    backgroundColor: '#f2f2f2',

    textAlign: 'center' as const,

    padding: 5,

    fontFamily: 'Helvetica-Bold',

  },

  tableColRight: {

    borderStyle: 'solid' as const,

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

    textAlign: 'right' as const,

  },

  tableColSmallRight: {

    borderStyle: 'solid' as const,

    borderColor: '#bfbfbf',

    borderWidth: 1,

    padding: 5,

    textAlign: 'right' as const,

  },

};



const styles = StyleSheet.create({

  page: {

    padding: 30,

    fontFamily: 'Helvetica',

    fontSize: 9,

  },

  section: {

    marginBottom: 10,

  },

  header: {

    fontSize: 16,

    textAlign: 'center',

    marginBottom: 20,

    fontFamily: 'Helvetica-Bold',

  },

  logo: {

    width: 150,

    height: 75,

    marginBottom: 10,

    alignSelf: 'center',

    objectFit: 'contain',

  },

  subHeader: {

    fontSize: 11,

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

    width: 'auto',

    marginBottom: 10,

  },

  tableRow: {

    flexDirection: 'row',

  },

  

  unitTableColHeader: {

    width: '14.28%',

    ...baseStyles.tableColHeader,

  },

  unitTableCol: {

    width: '14.28%',

    ...baseStyles.tableCol,

  },



  pricesHeaderItem: { width: '25%', ...baseStyles.tableColHeader },

  pricesHeaderListPrice: { width: '15%', ...baseStyles.tableColHeader },

  pricesHeaderDiscountPct: { width: '10%', ...baseStyles.tableColHeader },

  pricesHeaderDiscountUF: { width: '15%', ...baseStyles.tableColHeader },

  pricesHeaderNetPriceUF: { width: '15%', ...baseStyles.tableColHeader },

  pricesHeaderNetPriceCLP: { width: '20%', ...baseStyles.tableColHeader },

  

  pricesColItem: { width: '25%', ...baseStyles.tableCol },

  pricesColListPrice: { width: '15%', ...baseStyles.tableColRight },

  pricesColDiscountPct: { width: '10%', ...baseStyles.tableColSmallRight },

  pricesColDiscountUF: { width: '15%', ...baseStyles.tableColRight },

  pricesColNetPriceUF: { width: '15%', ...baseStyles.tableColRight },

  pricesColNetPriceCLP: { width: '20%', ...baseStyles.tableColRight },



  paymentHeaderGlosa: { width: '35%', ...baseStyles.tableColHeader },

  paymentHeaderPct: { width: '10%', ...baseStyles.tableColHeader },

  paymentHeaderPesos: { width: '25%', ...baseStyles.tableColHeader },

  paymentHeaderUF: { width: '30%', ...baseStyles.tableColHeader },

  

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



const Styles = styles;



interface BrokerQuotePDFProps {

  cliente: string;

  rut: string;

  ufValue: number | null;

  selectedUnidad: any;

  addedSecondaryUnits: any[];

  quotationType: 'descuento' | 'bono' | 'mix';

  discountAmount: number;

  bonoAmount: number;

  pagoReserva: number;

  pagoPromesa: number;

  pagoPromesaPct: number;

  pagoPie: number;

  pagoPiePct: number;

  pagoBonoPieCotizacion: number;

  precioBaseDepartamento: number;

  precioDescuentoDepartamento: number;

  precioDepartamentoConDescuento: number;

  precioTotalSecundarios: number;

  totalEscritura: number;

  pagoCreditoHipotecarioCalculado: number;

  totalFormaDePago: number;

  numeroCotizacion?: number | null;

}



const BrokerQuotePDF: React.FC<BrokerQuotePDFProps> = ({

  cliente,

  rut,

  ufValue,

  selectedUnidad,

  addedSecondaryUnits,

  quotationType,

  discountAmount,

  bonoAmount,

  pagoReserva,

  pagoPromesa,

  pagoPromesaPct,

  pagoPie,

  pagoPiePct,

  pagoBonoPieCotizacion,

  precioBaseDepartamento,

  precioDescuentoDepartamento,

  precioDepartamentoConDescuento,

  precioTotalSecundarios,

  totalEscritura,

  pagoCreditoHipotecarioCalculado,

  totalFormaDePago,

  numeroCotizacion,

}) => {

  const currentDate = new Date().toLocaleDateString('es-CL');



  let effectiveDeptDiscountPct = 0;

  if (selectedUnidad?.valor_lista && selectedUnidad.valor_lista > 0) {

    if (quotationType === 'descuento' || quotationType === 'mix') {

      effectiveDeptDiscountPct = discountAmount;

    } else {

      effectiveDeptDiscountPct = 0;

    }

  }



  let actualDeptDiscountUF = precioDescuentoDepartamento;



  const logoPath = '/logoinversiones.png';



  let descuentoDisponibleBroker = 0;

  let montoDescuentoBroker = 0;

  let commissionRate = selectedUnidad?.commission_rate || 0;

  let porcentajeRedondeado = 0;

  if (selectedUnidad && selectedUnidad.valor_lista && selectedUnidad.descuento) {

    const valorLista = selectedUnidad.valor_lista;

    const descuentoUnidad = selectedUnidad.descuento;

    commissionRate = selectedUnidad.commission_rate || 0;

    const valorConDescuento = valorLista * (1 - descuentoUnidad);

    const comisionBroker = valorConDescuento * (commissionRate / 100);

    const montoDescuento = valorLista * descuentoUnidad;

    descuentoDisponibleBroker = (montoDescuento - comisionBroker) / valorLista;

    porcentajeRedondeado = Math.floor(descuentoDisponibleBroker * 1000) / 10;

    montoDescuentoBroker = valorLista * (porcentajeRedondeado / 100);

  }

  // Calcular precioConDescuentoBroker igual que en la web
  const precioConDescuentoBroker = selectedUnidad && selectedUnidad.valor_lista
    ? selectedUnidad.valor_lista * (1 - porcentajeRedondeado / 100)
    : 0;

  // Detectar si se deben ocultar las columnas de descuento
  const hideDiscountColumns = !(precioDescuentoDepartamento && precioDescuentoDepartamento > 0);

  // Estilos de columnas dinámicos según si se ocultan columnas de descuento
  const priceColStyles = hideDiscountColumns
    ? {
        item: { width: '30%', ...baseStyles.tableCol },
        listPrice: { width: '23%', ...baseStyles.tableColRight },
        netPriceUF: { width: '23%', ...baseStyles.tableColRight },
        netPriceCLP: { width: '24%', ...baseStyles.tableColRight },
      }
    : {
        item: Styles.pricesColItem,
        listPrice: Styles.pricesColListPrice,
        discountPct: Styles.pricesColDiscountPct,
        discountUF: Styles.pricesColDiscountUF,
        netPriceUF: Styles.pricesColNetPriceUF,
        netPriceCLP: Styles.pricesColNetPriceCLP,
      };
  const priceHeaderStyles = hideDiscountColumns
    ? {
        item: { width: '30%', ...baseStyles.tableColHeader },
        listPrice: { width: '23%', ...baseStyles.tableColHeader },
        netPriceUF: { width: '23%', ...baseStyles.tableColHeader },
        netPriceCLP: { width: '24%', ...baseStyles.tableColHeader },
      }
    : {
        item: Styles.pricesHeaderItem,
        listPrice: Styles.pricesHeaderListPrice,
        discountPct: Styles.pricesHeaderDiscountPct,
        discountUF: Styles.pricesHeaderDiscountUF,
        netPriceUF: Styles.pricesHeaderNetPriceUF,
        netPriceCLP: Styles.pricesHeaderNetPriceCLP,
      };

  // Calcula el porcentaje real de descuento aplicado
  const porcentajeDescuentoReal = precioDescuentoDepartamento > 0 && precioBaseDepartamento > 0
    ? ((precioDescuentoDepartamento / precioBaseDepartamento) * 100)
    : 0;

  // Si es flujo bono pie, usar los props correctos para mostrar el descuento real aplicado
  const descuentoAplicableUF = quotationType === 'bono' ? precioDescuentoDepartamento : precioDescuentoDepartamento;
  const descuentoAplicablePct = quotationType === 'bono' ? porcentajeDescuentoReal : porcentajeDescuentoReal;
  const precioVentaUF = quotationType === 'bono' ? (precioBaseDepartamento - descuentoAplicableUF) : (precioBaseDepartamento - precioDescuentoDepartamento);

  // Helper para proxificar imágenes S3 si es necesario
  const getVisualizableImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      const s3Match = url.match(/^https?:\/\/(?:[a-zA-Z0-9.-]+\.)?s3\.amazonaws\.com\/(.+)$/);
      if (s3Match) {
        // Usar proxy de Weserv
        return `https://images.weserv.nl/?url=s3.amazonaws.com/${encodeURIComponent(s3Match[1])}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  return (

    <Document>

      <Page size="A4" style={Styles.page}>

        <View style={{ marginBottom: 20 }}>

          <Image src={logoPath} style={Styles.logo} />

          <Text style={[Styles.header, { marginTop: 10 }]}>COTIZACIÓN DE PROPIEDAD</Text>

          <Text style={Styles.dateInfo}>Fecha: {currentDate}</Text>

          <Text style={Styles.quotationNumber}>

            COTIZACIÓN Nº: {numeroCotizacion ? numeroCotizacion : '[PENDIENTE]'}

          </Text>

          <Text style={Styles.dateInfo}>UF: $ {ufValue ? ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</Text>

        </View>



        <View style={Styles.section}>

          <Text style={Styles.subHeader}>I. INFORMACIÓN DEL CLIENTE</Text>

          <Text style={Styles.text}><Text style={Styles.boldText}>SEÑOR(A):</Text> {cliente || 'N/A'}</Text>

          <Text style={Styles.text}><Text style={Styles.boldText}>RUT:</Text> {rut || 'N/A'}</Text>

        </View>



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



        <View style={Styles.section}>

          <Text style={Styles.subHeader}>III. PRECIOS</Text>

          <View style={Styles.table}>

            {/* Encabezado de la tabla */}
            <View style={Styles.tableRow}>
              <View style={priceHeaderStyles.item}><Text>ITEM</Text></View>
              <View style={priceHeaderStyles.listPrice}><Text>PRECIO LISTA</Text></View>
              {!hideDiscountColumns && <View style={priceHeaderStyles.discountPct}><Text>%</Text></View>}
              {!hideDiscountColumns && <View style={priceHeaderStyles.discountUF}><Text>DESCUENTO</Text></View>}
              <View style={priceHeaderStyles.netPriceUF}><Text>PRECIO VENTA UF</Text></View>
              <View style={priceHeaderStyles.netPriceCLP}><Text>PRECIO VENTA $</Text></View>
            </View>

            {quotationType === 'bono' && (

              <View style={Styles.tableRow}>

                <View style={priceColStyles.item}><Text>Departamento {selectedUnidad.unidad}</Text></View>

                <View style={priceColStyles.listPrice}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>

                {!hideDiscountColumns && <View style={priceColStyles.discountPct}><Text>{descuentoAplicablePct > 0 ? `${descuentoAplicablePct.toFixed(2)}%` : '-'}</Text></View>}

                {!hideDiscountColumns && <View style={priceColStyles.discountUF}><Text>{descuentoAplicableUF > 0 ? formatCurrency(descuentoAplicableUF) : '-'}</Text></View>}

                <View style={priceColStyles.netPriceUF}><Text>{formatCurrency(precioVentaUF)}</Text></View>

                <View style={priceColStyles.netPriceCLP}><Text>{ufToPesos(precioVentaUF, ufValue)}</Text></View>

              </View>

            )}

            {quotationType === 'bono' && addedSecondaryUnits.map(unit => (

              <View style={Styles.tableRow} key={unit.id}>

                <View style={priceColStyles.item}><Text>{unit.tipo_bien} {unit.unidad}</Text></View>

                <View style={priceColStyles.listPrice}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                {!hideDiscountColumns && <View style={priceColStyles.discountPct}><Text>-</Text></View>}

                {!hideDiscountColumns && <View style={priceColStyles.discountUF}><Text>-</Text></View>}

                <View style={priceColStyles.netPriceUF}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                <View style={priceColStyles.netPriceCLP}><Text>{ufToPesos(unit.valor_lista, ufValue)}</Text></View>

              </View>

            ))}

            {quotationType === 'bono' && (

              <View style={Styles.tableRow}>

                <View style={priceColStyles.item}><Text style={Styles.boldText}>TOTAL ESCRITURA</Text></View>

                <View style={priceColStyles.listPrice}></View>

                {!hideDiscountColumns && <View style={priceColStyles.discountPct}></View>}

                {!hideDiscountColumns && <View style={priceColStyles.discountUF}></View>}

                <View style={priceColStyles.netPriceUF}><Text style={Styles.boldText}>{formatCurrency(totalEscritura)}</Text></View>

                <View style={priceColStyles.netPriceCLP}><Text style={Styles.boldText}>{ufToPesos(totalEscritura, ufValue)}</Text></View>

              </View>

            )}

            {quotationType !== 'bono' && (

              hideDiscountColumns ? (

              <View style={Styles.tableRow}>

                <View style={priceColStyles.item}><Text>Departamento {selectedUnidad.unidad}</Text></View>

                <View style={priceColStyles.listPrice}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>

                  <View style={priceColStyles.netPriceUF}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>

                  <View style={priceColStyles.netPriceCLP}><Text>{ufToPesos(precioBaseDepartamento, ufValue)}</Text></View>

                </View>

              ) : (

                <View style={Styles.tableRow}>

                  <View style={priceColStyles.item}><Text>Departamento {selectedUnidad.unidad}</Text></View>

                  <View style={priceColStyles.listPrice}><Text>{formatCurrency(precioBaseDepartamento)}</Text></View>

                  <View style={priceColStyles.discountPct}><Text>{descuentoAplicablePct > 0 ? `${descuentoAplicablePct.toFixed(2)}%` : '-'}</Text></View>

                  <View style={priceColStyles.discountUF}><Text>{descuentoAplicableUF > 0 ? formatCurrency(descuentoAplicableUF) : '-'}</Text></View>

                  <View style={priceColStyles.netPriceUF}><Text>{formatCurrency(precioVentaUF)}</Text></View>

                  <View style={priceColStyles.netPriceCLP}><Text>{ufToPesos(precioVentaUF, ufValue)}</Text></View>

              </View>

              ))}

            

            {quotationType !== 'bono' && addedSecondaryUnits.map(unit => (

              <View style={Styles.tableRow} key={unit.id}>

                <View style={priceColStyles.item}><Text>{unit.tipo_bien} {unit.unidad}</Text></View>

                <View style={priceColStyles.listPrice}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                {!hideDiscountColumns && <View style={priceColStyles.discountPct}><Text>0.00%</Text></View>}

                {!hideDiscountColumns && <View style={priceColStyles.discountUF}><Text>0.00</Text></View>}

                <View style={priceColStyles.netPriceUF}><Text>{formatCurrency(unit.valor_lista)}</Text></View>

                <View style={priceColStyles.netPriceCLP}><Text>{ufToPesos(unit.valor_lista, ufValue)}</Text></View>

              </View>

            ))}

            {quotationType !== 'bono' && (

              <View style={Styles.tableRow}>

                <View style={priceColStyles.item}><Text style={Styles.boldText}>TOTAL ESCRITURA</Text></View>

                <View style={priceColStyles.listPrice}></View>

                {!hideDiscountColumns && <View style={priceColStyles.discountPct}></View>}

                {!hideDiscountColumns && <View style={priceColStyles.discountUF}></View>}

                <View style={priceColStyles.netPriceUF}><Text style={Styles.boldText}>{formatCurrency(totalEscritura)}</Text></View>

                <View style={priceColStyles.netPriceCLP}><Text style={Styles.boldText}>{ufToPesos(totalEscritura, ufValue)}</Text></View>

              </View>

            )}

          </View>



        </View>



        <View style={Styles.section}>

          <Text style={Styles.subHeader}>IV. FORMA DE PAGO</Text>

          <View style={Styles.table}>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentHeaderGlosa}><Text>GLOSA</Text></View>

              <View style={Styles.paymentHeaderPct}><Text>%</Text></View>

              <View style={Styles.paymentHeaderPesos}><Text>PESOS</Text></View>

              <View style={Styles.paymentHeaderUF}><Text>UF</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Reserva</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalFormaDePago > 0 ? formatCurrency((pagoReserva / totalFormaDePago) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoReserva, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoReserva)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Promesa</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalFormaDePago > 0 ? formatCurrency((pagoPromesa / totalFormaDePago) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoPromesa, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoPromesa)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Pie</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalFormaDePago > 0 ? formatCurrency((pagoPie / totalFormaDePago) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoPie, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoPie)}</Text></View>

            </View>

            <View style={Styles.tableRow}>

              <View style={Styles.paymentColGlosa}><Text>Crédito Hipotecario</Text></View>

              <View style={Styles.paymentColPct}><Text>{totalFormaDePago > 0 ? formatCurrency((pagoCreditoHipotecarioCalculado / totalFormaDePago) * 100) : '0.00'}%</Text></View>

              <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoCreditoHipotecarioCalculado, ufValue)}</Text></View>

              <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoCreditoHipotecarioCalculado)}</Text></View>

            </View>

            {quotationType === 'bono' && pagoBonoPieCotizacion > 0 && (

              <View style={Styles.tableRow}>

                <View style={Styles.paymentColGlosa}><Text>Bono Pie</Text></View>

                <View style={Styles.paymentColPct}><Text>{totalFormaDePago > 0 ? formatCurrency((pagoBonoPieCotizacion / totalFormaDePago) * 100) : '0.00'}%</Text></View>

                <View style={Styles.paymentColPesos}><Text>{ufToPesos(pagoBonoPieCotizacion, ufValue)}</Text></View>

                <View style={Styles.paymentColUF}><Text>{formatCurrency(pagoBonoPieCotizacion)}</Text></View>

              </View>

            )}

            <View style={Styles.tableRow}>

                <View style={Styles.paymentColGlosa}><Text style={Styles.boldText}>TOTAL</Text></View>

                <View style={Styles.paymentColPct}><Text style={Styles.boldText}>{totalFormaDePago > 0 ? formatCurrency((totalFormaDePago / totalFormaDePago) * 100) : '0.00'}%</Text></View>

                <View style={Styles.paymentColPesos}><Text style={Styles.boldText}>{ufToPesos(totalFormaDePago, ufValue)}</Text></View>

                <View style={Styles.paymentColUF}><Text style={Styles.boldText}>{formatCurrency(totalFormaDePago)}</Text></View>

            </View>

          </View>

        </View>



      </Page>

      {/* Segunda hoja: Galería de imágenes de unidades */}
      <Page size="A4" style={Styles.page}>
        <Text style={[Styles.header, { marginBottom: 10 }]}>Imágenes de Unidades Cotizadas</Text>
        {/* Unidades principales y secundarias con imagen */}
        {[
          ...(selectedUnidad && selectedUnidad.imagen ? [{ ...selectedUnidad, isPrincipal: true }] : []),
          ...addedSecondaryUnits.filter(u => u.imagen)
        ].length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40 }}>No hay imágenes asociadas a las unidades cotizadas.</Text>
        ) : (
          <View style={{ flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {[
              ...(selectedUnidad && selectedUnidad.imagen ? [{ ...selectedUnidad, isPrincipal: true }] : []),
              ...addedSecondaryUnits.filter(u => u.imagen)
            ].map((unit, idx) => {
              const imgUrl = getVisualizableImageUrl(unit.imagen);
              return (
                <View key={unit.id || idx} style={{ width: '100%', alignItems: 'center', marginBottom: 30 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                    {unit.isPrincipal ? 'Departamento Principal' : `${unit.tipo_bien || 'Unidad'} ${unit.unidad || ''}`}
                  </Text>
                  {imgUrl && (
                    <Image src={imgUrl} style={{ width: '90%', height: 260, objectFit: 'cover', borderRadius: 8, border: '1px solid #ccc', alignSelf: 'center' }} />
                  )}
                </View>
              );
            })}
          </View>
        )}
        {/* Sección V. NOTAS al final de la segunda hoja */}
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 2 }}>
            V. NOTAS
          </Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>1.- Cotización provisoria, información debe ser validada con cotización formal emitida por la inmobiliaria.</Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>2.- El valor cancelado por concepto Reserva, será abonado a Pie.</Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>3.- Serán de cargo exclusivo del comprador, los gastos que genere esta operación, tales como: tasación; estudio de títulos; confección de escritura; gastos notariales y conservador de bienes raíces.</Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>4.- Por no ser una cotización formal, los precios y condiciones pueden variar sin previo aviso.</Text>
          <Text style={{ fontSize: 9, marginBottom: 2 }}>5.- Las imágenes son referenciales y pueden no corresponder exactamente a la unidad cotizada.</Text>
        </View>
      </Page>
    </Document>
  );
};



export default BrokerQuotePDF;