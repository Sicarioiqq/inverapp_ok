import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

interface Persona {
  nombre: string;
  rut: string;
  cargo?: string;
}
interface Cliente {
  nombre: string;
  rut: string;
  direccion: string;
  comuna: string;
  nacionalidad: string;
}
interface FormularioONUProps {
  jefatura: Persona;
  vendedor: Persona;
  cliente: Cliente;
  proyecto: string;
  fechaHora: string;
}

const styles = StyleSheet.create({
  page: { 
    padding: 60, 
    fontSize: 10, 
    fontFamily: 'Helvetica',
    lineHeight: 1.5
  },
  logo: { 
    width: 120, 
    marginTop: 10,
    marginBottom: 10 
  },
  title: { 
    textAlign: 'center', 
    fontWeight: 'bold', 
    fontSize: 13, 
    marginTop: 10, 
    marginBottom: 16,
  },
  subtitle: { 
    textAlign: 'center', 
    fontWeight: 'bold', 
    fontSize: 11, 
    marginBottom: 24,
    textDecoration: 'underline' 
  },
  cityDate: {
    marginBottom: 18,
    textAlign: 'left',
  },
  text: { 
    marginBottom: 10, 
    textAlign: 'justify', 
    lineHeight: 1.5,
    hyphens: 'none',
    wordBreak: 'keep-all'
  },
  bold: { 
    fontWeight: 'bold' 
  },
  underline: { 
    textDecoration: 'underline' 
  },
  link: { 
    color: '#2563EB', 
    textDecoration: 'underline' 
  },
  signature: { 
    marginTop: 8,
    textAlign: 'center', 
    fontWeight: 'bold' 
  },
  signatureLine: {
    marginBottom: 2,
    borderBottom: '1px solid black',
    width: 200,
    alignSelf: 'center'
  },
  cargo: { 
    textAlign: 'center', 
    fontSize: 10,
    textTransform: 'capitalize'
  },
  footnote: { 
    fontSize: 7, 
    marginTop: 30, 
    color: '#888', 
    textAlign: 'left' 
  },
});

const FormularioONUPDF: React.FC<FormularioONUProps & { comunaProyecto?: string }> = ({ jefatura, vendedor, cliente, proyecto, fechaHora, comunaProyecto }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Image src="/logoinversiones.png" style={styles.logo} />
      <Text style={styles.title}>Formulario de Verificación de Clientes</Text>
      <Text style={styles.subtitle}>Listado del Consejo de Seguridad de las Naciones Unidas</Text>
      <Text style={styles.cityDate}>
        En la ciudad de Santiago, a la fecha {fechaHora}.
      </Text>
      <Text style={styles.text}>
        Yo, <Text style={styles.bold}>{jefatura.nombre}</Text>, cédula de identidad N° <Text style={styles.bold}>{jefatura.rut}</Text> en calidad de <Text style={styles.bold}>{jefatura.cargo?.toLowerCase()}</Text>, declaro haber confirmado que el ejecutivo de ventas <Text style={styles.bold}>{vendedor.nombre}</Text> cédula de identidad N° <Text style={styles.bold}>{vendedor.rut}</Text>, ha realizado la verificación correspondiente en la página web<Text style={styles.footnote}>1</Text> oficial de la Unidad de Análisis Financiero sobre el listado del Consejo de Seguridad de las Naciones Unidas, link 
        <Text style={styles.link}> https://scsanctions.un.org/search/</Text>, confirmando que el/la <Text style={styles.bold}>{cliente.nombre}</Text>, con cédula de identidad N° <Text style={styles.bold}>{cliente.rut}</Text>, domiciliado(a) en <Text style={styles.bold}>{cliente.direccion}</Text>, comuna de <Text style={styles.bold}>{cliente.comuna}</Text>, de nacionalidad <Text style={styles.bold}>{cliente.nacionalidad}</Text>, cliente del proyecto Ecasa denominado <Text style={styles.bold}>{proyecto}</Text>, ubicado en la ciudad de <Text style={styles.bold}>{comunaProyecto || '________'}</Text>. No se encuentra registrado(a) en el listado del Consejo de Seguridad de las Naciones Unidas.
      </Text>
      <View style={{ marginTop: 90, alignItems: 'center' }}>
        <View style={styles.signatureLine} />
        <Text style={styles.signature}>{jefatura.nombre}</Text>
        <Text style={styles.cargo}>{jefatura.cargo?.toLowerCase()}</Text>
      </View>
      <Text style={styles.footnote}>
        1 https://www.uaf.cl/asuntos/intro.aspx
      </Text>
    </Page>
  </Document>
);

export default FormularioONUPDF; 