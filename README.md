# RESTAURANTE

PWA móvil para un restaurante pequeño cerca de una universidad. El objetivo es que la dueña y las personas que atienden puedan registrar ventas, transferencias, fiados y el menú del día sin convertir el negocio en un POS complicado.

## Estado actual

La primera base funcional ya incluye:

- inicio con resumen diario;
- cobro rápido por efectivo, transferencia o fiado;
- captura/subida de comprobante en la interfaz;
- clientes fiados con cargos, abonos y liquidación;
- editor del menú del día con Disponible / Agotado;
- vista pública del menú para el futuro QR;
- cierre diario;
- historial de ventas;
- configuración del negocio y precios rápidos;
- PWA instalable;
- modo local con persistencia en el navegador;
- cliente de Supabase preparado mediante variables de entorno;
- esquema SQL de Supabase con Auth, RLS y políticas de Storage.

## Importante: modo local vs Supabase

Mientras no existan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, la app usa datos locales del navegador. Esto sirve para construir y probar la experiencia sin bloquear el desarrollo.

La sincronización real entre varios celulares se conectará a Supabase después de crear el proyecto. No uses una service_role key en el frontend.

## Desarrollo

Requisitos: Node.js 22.

~~~bash
npm install
npm run dev
~~~

Para comprobar producción:

~~~bash
npm run build
npm run preview
~~~

## Variables de entorno

Copia .env.example a .env.local y completa:

~~~text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
~~~

## Supabase

El archivo supabase/schema.sql contiene el diseño propuesto. Todavía NO hay que ejecutarlo hasta tener creado el proyecto y hacer la revisión final.

Modelo preparado:

- businesses
- staff_profiles
- business_public_settings
- menu_items
- customers
- sales
- sale_items
- credit_movements
- receipts

Los comprobantes se guardarán en un bucket privado llamado receipts. Ruta esperada:

~~~text
<business_id>/<sale_id>/<archivo>
~~~

Cuando el proyecto de Supabase esté conectado se hará lo siguiente:

1. revisar el SQL contra el proyecto real;
2. ejecutarlo;
3. crear el bucket privado receipts desde Storage;
4. crear la primera cuenta de la dueña/administrador;
5. crear el negocio y sus miembros;
6. sustituir el proveedor local por consultas a Supabase;
7. subir comprobantes reales a Storage;
8. probar dos celulares simultáneamente;
9. revisar Security y Performance Advisors;
10. desplegar a Vercel.

## Datos todavía provisionales

El nombre "Restaurante Doña Paty", los platos y los precios son temporales. La visita al local definirá:

- nombre oficial;
- logo y colores;
- menú real;
- precios reales;
- banco y cuenta;
- teléfono;
- quiénes usarán el panel;
- flujo exacto de fiados;
- fotografías reales de los platos.

## Diseño

La interfaz es mobile-first y prioriza botones grandes, texto legible y pocos pasos. Debe poder usarse con una sola mano durante la hora de almuerzo y sin requerir conocimientos técnicos.

## Seguridad

La información de ventas, clientes, fiados y comprobantes no se publica. El menú del cliente sí se prepara para lectura pública mediante QR. Las políticas de base de datos están pensadas para separar los datos internos del contenido público.

## Próximo hito

Conectar el Supabase real y reemplazar el modo local por sincronización en nube sin cambiar la experiencia de uso.
