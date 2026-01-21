# 🪟 Cotizador Online - Cristalum / Cripter

Este es un sistema integral de cotización para cristales y ventanas, desarrollado con **Next.js 14**, **TypeScript**, **Tailwind CSS** y **Firebase**. La aplicación permite calcular presupuestos detallados para diferentes tipos de cerramientos y vidrios, gestionando todo desde un panel centralizado.

> **Proyecto actualizado**: Repositorio migrado a [optimizador-ventanas](https://github.com/crist38/optimizador-ventanas).

## 🚀 Módulos del Sistema

### 1. 🪟 Configurador de Ventanas de PVC
Permite diseñar y presupuestar ventanas de PVC de forma interactiva con soporte para múltiples líneas:
- **Líneas Soportadas**: PVC 58 CD, 70 CD, PD-10 (Corredera), 58 DJ y 50 DJ (Oscilobatientes/Abatibles).
- **Diseño visual**: Vista previa dinámica basada en SVG.
- **Personalización**: Dimensiones, tipos de apertura, colores, tipos de vidrio y accesorios.
- **Calculadora Inteligente**: Ajuste de precios base según la línea seleccionada y configuración de vidrios.

### 2. 🏗️ Configurador de Ventanas de Aluminio
Herramienta similar enfocada en perfiles de aluminio para diversas aplicaciones.
- **Líneas Soportadas**:
  - **Tradicionales**: AL 25, AL 42, AL 20, AL 32, AL 5000.
  - **Puertas**: AM-35.
  - **Especiales**: L-12 Shower Door.
  - **RPT (Ruptura Puente Térmico)**: S-33 RPT, S-38 RPT.
- **Funcionalidades**:
  - Configuración de medidas y acabados.
  - Desglose de materiales y pautas de corte detalladas en PDF.

### 3. 📦 Gestión de Materiales (Nuevo)
Panel dedicado (`/admin/materiales`) para la administración de inventario.
- **Base de Datos**: Gestión de perfiles, accesorios, vidrios y otros insumos.
- **Importador CSV**: Carga masiva de productos desde archivos locales (`Productos.csv`, `plantilla_producto.csv`).
- **Control de Stock**: Visualización y edición rápida de precios y cantidades.

### 4. ⚙️ Administración y Configuración
Panel centralizado (`/admin`) mejorado:
- **Configuración de Precios**: Ajuste dinámico de precios base por línea (Aluminio/PVC), colores y vidrios sin tocar código.
- **Gestión de Usuarios**: Administración de roles y accesos.
- **Dashboard**: Estadísticas de presupuestos y accesos rápidos.

### 5. 🌡️ Calculador de Termopaneles
Módulo especializado para la cotización de vidrios termopaneles (DVH).
- Selección de espesores de cristal y cámara de aire.
- Cálculo de metros cuadrados y precios unitarios.

## 🧱 Tecnologías Utilizadas

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos**: [Firebase Firestore](https://firebase.google.com/docs/firestore)
- **Generación de PDF**: [jsPDF](https://github.com/parallax/jsPDF) y [html2canvas](https://html2canvas.hertzen.com/)
- **Iconos**: [Lucide React](https://lucide.dev/)

## 📦 Instalación y Desarrollo

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/crist38/optimizador-ventanas.git
   cd optimizador-ventanas
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crea un archivo `.env.local` con tus credenciales de Firebase:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=xxx
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
   NEXT_PUBLIC_FIREBASE_APP_ID=xxx
   ```

4. **Reglas de Firestore**:
   Asegúrate de aplicar las reglas de seguridad incluidas en `firestore.rules` para habilitar el módulo de Materiales.

5. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

- `app/` - Rutas y páginas principales (App Router).
  - `admin/` - Panel de administración y gestión de materiales.
  - `pvc/` - Configurador de PVC.
  - `aluminio/` - Configurador de Aluminio.
- `components/` - Componentes de UI reutilizables.
- `lib/` - Configuraciones (Firebase, utilidades) y datos estáticos (`data/`).
- `public/` - Recursos estáticos.

---
**Cripter Limitada** - Sistema de Cotización Avanzado.