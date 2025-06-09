import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  body: {
    padding: 32,
    fontSize: 12,
    fontFamily: 'Helvetica',
    color: '#222',
  },
  logo: {
    width: 120,
    marginBottom: 16,
    alignSelf: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  box: {
    border: '1px solid #222',
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
    minWidth: 120,
  },
  value: {
    textAlign: 'right',
  },
  highlight: {
    backgroundColor: '#eee',
    fontWeight: 'bold',
    padding: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    fontSize: 13,
  },
});

interface LiquidacionComisionPDFProps {
  datos: {
    idLiquidacion: string;
    fechaLiquidacion: string;
    broker: string;
    project: string;
    unidad: string;
    precioLista: number;
    dctoDisponible: number;
    precioMinimo: number;
    comisionIVAIncluido: number;
    comisionPct: number;
    dctoDisponibleConComisionUF: number;
    politicaComercial?: string | null;
  };
}

const formatPct = (v: number | null | undefined) => v !== null && v !== undefined ? (v * 100).toFixed(2) + '%' : '';
const formatUF = (v: number | null | undefined) => v !== null && v !== undefined ? Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const LiquidacionComisionPDF: React.FC<LiquidacionComisionPDFProps> = ({ datos }) => (
  <Document>
    <Page style={styles.body}>
      <Image src={'/logoinversiones.png'} style={styles.logo} />
      <Text style={styles.title}>LIQUIDACIÓN DE COMISIÓN BROKER</Text>
      <View style={styles.row}>
        <Text>ID Liquidación:</Text>
        <Text style={{ fontWeight: 'bold' }}>{datos.idLiquidacion}</Text>
      </View>
      <View style={styles.row}>
        <Text>Fecha generación:</Text>
        <Text style={{ fontWeight: 'bold' }}>{datos.fechaLiquidacion}</Text>
      </View>
      <View style={styles.row}>
        <Text>Broker:</Text>
        <Text style={{ fontWeight: 'bold' }}>{datos.broker}</Text>
      </View>
      <View style={styles.box}>
        <View style={styles.row}>
          <Text style={styles.label}>PROYECTO:</Text>
          <Text>{datos.project}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>UNIDAD:</Text>
          <Text>{datos.unidad}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PRECIO LISTA</Text>
          <Text style={styles.value}>{formatUF(datos.precioLista)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>DCTO. DISPONIBLE</Text>
          <Text style={styles.value}>{formatPct(datos.dctoDisponible)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PRECIO MÍNIMO</Text>
          <Text style={styles.value}>{formatUF(datos.precioMinimo)}</Text>
        </View>
        <View style={[styles.row, styles.highlight]}>
          <Text style={styles.label}>COMISIÓN IVA INCLUIDO</Text>
          <Text style={styles.value}>{formatUF(datos.comisionIVAIncluido)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>COMISIÓN</Text>
          <Text style={styles.value}>{formatPct(datos.comisionPct)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>DCTO. DISPONIBLE CON COMISIÓN</Text>
          <Text style={styles.value}>{formatUF(datos.dctoDisponibleConComisionUF)}</Text>
        </View>
      </View>
      {datos.politicaComercial && (
        <View>
          <Text style={styles.sectionTitle}>Política Comercial</Text>
          <Text>{datos.politicaComercial}</Text>
        </View>
      )}
    </Page>
  </Document>
);

export default LiquidacionComisionPDF; 