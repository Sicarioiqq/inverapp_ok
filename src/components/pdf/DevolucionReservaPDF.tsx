import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

interface DevolucionReservaPDFProps {
  cliente_nombre: string;
  cliente_rut: string;
  proyecto: string;
  fecha_reserva: string;
  numero_departamento: string;
  valor_total: string | number;
  fecha_desistimiento: string;
  monto_pagado_uf: string | number;
  monto_pagado_pesos: string | number;
  monto_cancelado: string | number;
  monto_devolucion_pesos: string | number;
  ejecutivo_ventas_nombre: string;
  causa_motivo: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  correo_cliente: string;
  comentarios?: string;
  fecha_creacion: string;
}

function formatDateDMY(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatNumberThousands(n: string | number) {
  if (n === undefined || n === null) return '';
  return Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.5
  },
  logo: {
    width: 90,
    marginBottom: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  headerRight: {
    alignItems: 'flex-end',
    fontSize: 8
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  table: {
    border: '1px solid #000',
    marginTop: 10,
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
    alignItems: 'center'
  },
  cellLabel: {
    width: '40%',
    padding: 4,
    fontWeight: 'bold',
    backgroundColor: '#f3f3f3'
  },
  cellValue: {
    width: '60%',
    padding: 4
  },
  usoInterno: {
    border: '1px solid #000',
    marginTop: 16,
    padding: 8
  },
  usoLabel: {
    fontWeight: 'bold',
    marginBottom: 2
  },
  comentarios: {
    marginBottom: 4
  },
  bold: {
    fontWeight: 'bold'
  },
  firmas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 50,
    marginBottom: 10
  },
  firmaBlock: {
    width: '30%',
    alignItems: 'center'
  },
  firmaLine: {
    borderBottom: '1px solid #000',
    width: '100%',
    height: 18,
    marginBottom: 4
  },
  firmaLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2
  },
  footnote: {
    fontSize: 7,
    marginTop: 10,
    color: '#888',
    textAlign: 'left'
  },
  comentariosTable: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    marginTop: 12,
    marginBottom: 12,
  },
  comentariosRow: {
    flexDirection: 'row',
  },
  comentariosCellLabel: {
    width: 170,
    fontSize: 11,
    color: '#222',
    fontWeight: 'bold',
    paddingRight: 8,
  },
  comentariosCellDato: {
    fontSize: 11,
    color: '#222',
    flex: 1,
  },
});

const DevolucionReservaPDF: React.FC<DevolucionReservaPDFProps> = (props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Image src="/logoinversiones.png" style={styles.logo} />
        <View style={styles.headerRight}>
          <Text>{formatDateDMY(props.fecha_creacion)}</Text>
        </View>
      </View>
      <Text style={styles.title}>SOLICITUD DEVOLUCIÓN DE RESERVA</Text>
      <View style={styles.table}>
        <View style={styles.row}><Text style={styles.cellLabel}>Nombre del Cliente</Text><Text style={styles.cellValue}>: {props.cliente_nombre}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Rut</Text><Text style={styles.cellValue}>: {props.cliente_rut}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Proyecto</Text><Text style={styles.cellValue}>: {props.proyecto}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Fecha de Reserva</Text><Text style={styles.cellValue}>: {formatDateDMY(props.fecha_reserva)}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>N° Dpto.</Text><Text style={styles.cellValue}>: {props.numero_departamento}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Valor Total</Text><Text style={styles.cellValue}>: {formatNumberThousands(props.valor_total)}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Fecha del Desistimiento</Text><Text style={styles.cellValue}>: {formatDateDMY(props.fecha_desistimiento)}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Monto Cancelado</Text><Text style={styles.cellValue}>: $ {formatNumberThousands(props.monto_cancelado)}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Ejecutivo de Ventas</Text><Text style={styles.cellValue}>: {props.ejecutivo_ventas_nombre}</Text></View>
        <View style={styles.row}><Text style={styles.cellLabel}>Causas o Motivos</Text><Text style={styles.cellValue}>: {props.causa_motivo}</Text></View>
      </View>
      <View style={styles.usoInterno}>
        <Text style={styles.usoLabel}>Comentarios:</Text>
        <View style={styles.comentariosTable}>
          <View style={styles.comentariosRow}>
            <Text style={styles.comentariosCellLabel}>Monto Devolución en Pesos:</Text>
            <Text style={styles.comentariosCellDato}>{formatNumberThousands(props.monto_devolucion_pesos)}</Text>
          </View>
          <View style={styles.comentariosRow}>
            <Text style={styles.comentariosCellLabel}>Banco:</Text>
            <Text style={styles.comentariosCellDato}>{props.banco}</Text>
          </View>
          <View style={styles.comentariosRow}>
            <Text style={styles.comentariosCellLabel}>Tipo de Cuenta:</Text>
            <Text style={styles.comentariosCellDato}>{props.tipo_cuenta}</Text>
          </View>
          <View style={styles.comentariosRow}>
            <Text style={styles.comentariosCellLabel}>N° Cuenta:</Text>
            <Text style={styles.comentariosCellDato}>{props.numero_cuenta}</Text>
          </View>
          <View style={styles.comentariosRow}>
            <Text style={styles.comentariosCellLabel}>Correo:</Text>
            <Text style={styles.comentariosCellDato}>{props.correo_cliente}</Text>
          </View>
        </View>
      </View>
      <View style={styles.firmas}>
        <View style={styles.firmaBlock}>
          <View style={styles.firmaLine} />
          <Text style={styles.firmaLabel}>V°B° Jefe Ventas</Text>
        </View>
        <View style={styles.firmaBlock}>
          <View style={styles.firmaLine} />
          <Text style={styles.firmaLabel}>V°B° Contabilidad</Text>
        </View>
        <View style={styles.firmaBlock}>
          <View style={styles.firmaLine} />
          <Text style={styles.firmaLabel}>V°B° Gte Comercial</Text>
        </View>
      </View>
      <Text style={styles.footnote}>C.c: Archivo</Text>
    </Page>
  </Document>
);

export default DevolucionReservaPDF; 