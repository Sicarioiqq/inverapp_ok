# 📺 Dashboard TV - InverApp

## 🎯 Descripción

El **Dashboard TV** es una página especializada para mostrar información comercial en tiempo real en pantallas de TV, similar a los indicadores que se ven en clínicas o salas de trading. Está diseñado para ser visible desde lejos y actualizarse automáticamente.

## ✨ Características

### 🎨 **Diseño Optimizado para TV**
- **Pantalla completa** con gradiente azul profesional
- **Fuentes grandes** y legibles desde lejos
- **Colores contrastantes** para máxima visibilidad
- **Responsive** para diferentes tamaños de pantalla

### ⚡ **Actualización Automática**
- **Actualización cada 30 segundos** sin intervención del usuario
- **Notificaciones visuales** para nuevas reservas
- **Indicador de última actualización** en tiempo real

### 📊 **Información Mostrada**

#### **Métricas Principales (4 tarjetas)**
1. **Reservas del Mes** - Con comparativo vs mes anterior
2. **Reservas de Hoy** - Actualizado en tiempo real
3. **Promesas Pendientes** - Flujos en progreso
4. **Ingresos del Mes** - Total acumulado en UF

#### **Información Detallada (3 columnas)**
1. **Últimas Reservas** - Las 5 reservas más recientes
2. **Promesas Pendientes** - Flujos con días de atraso
3. **Pagos Recientes** - Últimos pagos completados

### 🔔 **Notificaciones**
- **Animación de entrada** para nuevas reservas
- **Mensaje destacado** con número de reserva
- **Auto-ocultación** después de 5 segundos

## 🚀 Cómo Usar

### **Acceso desde Navegador**
1. Inicia sesión en InverApp
2. Ve al **Sidebar** → **Dashboard TV**
3. O navega directamente a: `/dashboard-tv`

### **Acceso desde Smart TV**
1. Abre el navegador del Smart TV
2. Ve a la URL de tu aplicación
3. Inicia sesión
4. Navega a `/dashboard-tv`

### **Modo Pantalla Completa**
- Presiona **F11** en el navegador para modo pantalla completa
- En Smart TV, usa la función de pantalla completa del navegador

## 🎛️ Configuración

### **Intervalo de Actualización**
El dashboard se actualiza automáticamente cada **30 segundos**. Para cambiar este intervalo:

```typescript
// En src/pages/DashboardTV.tsx, línea ~320
intervalRef.current = setInterval(fetchTVStats, 30000); // 30 segundos
```

### **Personalización de Colores**
Los colores se pueden personalizar en `src/index.css`:

```css
.dashboard-tv {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%);
}
```

## 📱 Compatibilidad

### **Dispositivos Soportados**
- ✅ **Smart TV** (Samsung, LG, Sony, etc.)
- ✅ **Monitores grandes** (1920x1080, 4K, etc.)
- ✅ **Tablets** (modo landscape)
- ✅ **Computadoras** (pantalla completa)

### **Navegadores Recomendados**
- **Chrome/Chromium** (mejor rendimiento)
- **Firefox** (compatible)
- **Safari** (compatible)
- **Navegadores de Smart TV** (compatible)

## 🔧 Personalización

### **Agregar Nuevas Métricas**
Para agregar nuevas métricas al dashboard:

1. **Actualizar la interfaz** `TVStats`:
```typescript
interface TVStats {
  // ... métricas existentes
  nuevaMetrica: number;
}
```

2. **Agregar la consulta** en `fetchTVStats`:
```typescript
const { count: nuevaMetrica } = await supabase
  .from('tabla')
  .select('id', { count: 'exact', head: true });
```

3. **Agregar la tarjeta** en el JSX:
```typescript
<div className="tv-card">
  <div className="text-lg font-semibold mb-4 text-blue-200">Nueva Métrica</div>
  <div className="tv-metric">{stats.nuevaMetrica}</div>
</div>
```

### **Cambiar Información Mostrada**
Para cambiar qué información se muestra en las listas:

1. **Modificar las consultas** en `fetchTVStats`
2. **Actualizar los límites** (actualmente 5 elementos por lista)
3. **Cambiar el orden** de los elementos

## 🐛 Solución de Problemas

### **No se actualiza automáticamente**
- Verifica que no haya errores en la consola
- Revisa la conexión a internet
- Confirma que Supabase esté funcionando

### **No se ven las notificaciones**
- Verifica que haya nuevas reservas
- Revisa que las notificaciones no estén bloqueadas
- Confirma que el navegador soporte las animaciones CSS

### **Problemas de rendimiento**
- Reduce el intervalo de actualización
- Limita la cantidad de datos consultados
- Usa un navegador más potente

## 📞 Soporte

Si tienes problemas con el Dashboard TV:

1. **Revisa la consola** del navegador para errores
2. **Verifica la conexión** a Supabase
3. **Prueba en otro navegador** o dispositivo
4. **Contacta al equipo** de desarrollo

---

**¡El Dashboard TV está listo para mostrar información comercial en tiempo real!** 🎉 