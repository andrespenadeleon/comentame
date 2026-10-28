# comenta.me

Next.js App Router + React + TypeScript, Tailwind CSS y componentes base estilo shadcn/ui. Supabase aporta Auth, PostgreSQL y Storage. La landing conserva el diseño V8 y sus demostraciones; el código original queda en `legacy/`.

## Desarrollo

Usar Node.js 24 LTS. Las versiones exactas de paquetes están en `package-lock.json`.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Abrir http://localhost:3000. Los únicos valores públicos son `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL`. Nunca configurar una clave secreta/service_role con prefijo `NEXT_PUBLIC_`.

## Activación de Supabase (pendiente en el proyecto remoto)

1. En el proyecto `odthdpmmqzdzwqwggeuv`, abrir **SQL Editor** y ejecutar **una sola vez** las migraciones en orden: `202610260001_initial.sql`, `202610260002_feedback.sql` , `202610270001_surveys.sql` y `202610270002_survey_builder_v2.sql`, desde `supabase/migrations/`. Ejecuta únicamente las migraciones que todavía no hayas aplicado. Cada migración es transaccional. Crean tablas, políticas, funciones, fotos privadas de empleados y logos públicos de restaurantes. No modifica usuarios existentes.
2. En **Authentication → Providers → Email**, mantener registro por correo y confirmación de correo habilitados. Contraseña mínima: al menos 8 caracteres.
3. En **Authentication → URL Configuration**, configurar:
   - Site URL: `https://comentame.vercel.app`
   - Redirect URLs:
     - `https://comentame.vercel.app/auth/callback`
     - `https://comentame.vercel.app/auth/callback?next=/restablecer`
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/callback?next=/restablecer`
4. Configurar SMTP propio antes de habilitar registros de clientes: el proveedor de correo de prueba de Supabase tiene restricciones de destinatarios y límites. Ver https://supabase.com/docs/guides/auth/auth-smtp.
5. Para confirmación y recuperación que funcionen incluso al abrir el correo en otro navegador, usar estas plantillas en **Authentication → Email Templates**:
   - Confirm signup: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Confirmar mi correo</a>`
   - Reset password: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Restablecer contraseña</a>`
   Las plantillas anteriores apuntan al Site URL (producción). Las plantillas predeterminadas con `ConfirmationURL` también son compatibles por PKCE, pero se deben abrir en el mismo navegador donde se inició el flujo. Para pruebas locales con token_hash, usar un proyecto de desarrollo con Site URL local; no cambiar el Site URL de producción mientras recibe usuarios.

La clave pública por sí sola no permite crear el esquema ni cambiar SMTP o las plantillas. No se realizaron altas reales ni envíos de correos durante la implementación.

## Vercel

El repositorio local todavía no tiene remoto configurado. Para desplegar la migración en el proyecto existente:

1. Subir este repositorio al GitHub conectado a `comentame.vercel.app`.
2. En Vercel, cambiar el preset del proyecto estático a **Next.js**, Node.js 24 LTS, build `npm run build`, output automático (eliminar cualquier `Output Directory` estático como `.` o `public`).
3. Agregar las tres variables de `.env.example` en el entorno de producción, usando `https://comentame.vercel.app` para `NEXT_PUBLIC_SITE_URL`. `NEXT_PUBLIC_SITE_URL` debe ser la URL estable, sin `/` final. Para desarrollo, usar `http://localhost:3000`; las previews con correos necesitan URL y redirect allowlist propios.
4. Ejecutar la migración/configuración de Supabase indicada arriba y desplegar.

`vercel.json` declara Next.js. `/index.html` redirige a `/` y `/gracias.html` a `/gracias`. Los favicons conservan sus rutas y versión V8.

## Alcance implementado

- Registro con correo/contraseña, confirmación, login, cierre de sesión y recuperación.
- Sesiones con cookies mediante `@supabase/ssr`; validación de usuario en cada operación del servidor y RLS en tablas y fotos.
- Onboarding persistente: administrador → primer restaurante → empleados opcionales → borrador opcional.
- Dashboard con datos reales de configuración, edición de administrador/restaurante, alta/edición/eliminación de empleados, foto privada opcional e iniciales.
- Borrador por restaurante con preguntas de texto, selección múltiple y una opción desplegable; vista previa completa en una sola pantalla. Máximo 20 preguntas adicionales a la calificación fija y 10 opciones por pregunta.
- Enlaces inmutables `/encuesta/<restaurant_uuid>/<employee_uuid>`: encuesta pública única por restaurante con atribución por empleado. Nombre y estrellas obligatorios; contacto opcional. Envíos múltiples con identificador de reintento para evitar duplicados accidentales.
- Vista previa interactiva sin guardar respuestas, borradores privados y publicación versionada e independiente. Las respuestas conservan la versión original de las preguntas.
- Logo opcional y enlaces de Instagram, Facebook, TikTok y YouTube. Google Maps es obligatorio al publicar; la invitación a reseñar se muestra a todos los comensales después del envío, con cualquier calificación.
- Resumen con promedio, distribución y opiniones recientes; Opiniones con filtros, paginación de 20 registros y detalle privado. Los filtros incluyen empleados archivados.
- Al eliminar empleados se desactiva su enlace y se conservan sus opiniones. Soporte muestra una pantalla de próximamente; el chat sigue pendiente.
- Formspree para leads sigue funcionando de forma independiente y redirige después de un HTTP exitoso. No se enviaron leads de prueba.

Siguen pendientes el portal admin, el chat de soporte y los cobros. La nueva migración está preparada localmente y no fue ejecutada en el proyecto remoto con la clave pública.

## Autorización de restaurantes adicionales

Cada usuario tiene un restaurante por defecto. No puede insertar restaurantes ni modificar el límite directamente. `create_restaurant` comprueba el usuario, los datos y el límite bajo un bloqueo transaccional por cuenta.

Hasta construir el portal admin, el operador autorizado puede aumentar el cupo desde SQL Editor:

```sql
insert into private.restaurant_limits(owner_id, max_restaurants)
values ('UUID-DEL-ADMINISTRADOR', 2)
on conflict (owner_id) do update set max_restaurants = excluded.max_restaurants;
```

El usuario podrá usar **Mi restaurante → Agregar restaurante autorizado**. Este formulario no envía una solicitud de aprobación; solo crea si el cupo ya fue autorizado. Los identificadores de restaurantes/empleados no cambian al editar nombres.

## Verificación

```sh
npm run typecheck
npm test
npm run build
# Con npm start activo en otra terminal:
npm run test:smoke
```

Las pruebas de PostgreSQL embebido (PGlite) ejecutan la migración real con esquemas `auth` y `storage` de prueba: verifican RLS entre cuentas, cupos, cambios de identificadores, borradores y permisos de fotos. No sustituyen la prueba del Storage/Auth hospedado, de los correos ni una prueba de navegador.

El build usa Webpack por compatibilidad con este entorno; mantiene App Router y Server Components. Tailwind se utiliza para el sistema base y componentes nuevos; el CSS original de la landing está encapsulado en `.landing`.

## Pendientes antes del lanzamiento público

- Completar el aviso de privacidad con datos reales del responsable (`/privacidad` está marcado como borrador).
- Aplicar el esquema remoto y configurar Auth/SMTP.
- Comprobar visualmente móvil y escritorio y ejecutar el recorrido completo con dos cuentas de prueba después del despliegue.
- Verificar invitaciones y recuperación de correo, fotos privadas y recepción de Formspree en el dominio real.

## Actualización de feedback: Google Maps y calificación fija

Si ya aplicaste la migración inicial, ejecuta **solo** `supabase/migrations/202610260002_feedback.sql` en Supabase SQL Editor. Para instalaciones nuevas, aplica las cuatro migraciones en orden, incluida la actualización de encuestas indicada abajo. No vuelvas a ejecutar la inicial sobre una base existente.

La actualización agrega `google_maps_url` opcional, conserva el cupo y aislamiento de restaurantes, y antepone la pregunta fija de 1–5 estrellas a los borradores existentes sin borrar sus preguntas. Se admiten hasta 20 preguntas adicionales a la calificación. La interfaz de borrador normaliza líneas vacías en las opciones antes de validar/guardar.

El equipo del dashboard muestra empleados de todos los restaurantes propios, con filtro solo para cuentas con más de uno. Al crear un empleado se puede seleccionar su restaurante; editarlo no mueve su pertenencia. Los enlaces estables se consultan en Mi encuesta después de publicar, y no se muestran ni copian en las tarjetas de empleados.

El chat de soporte continúa pendiente de definición del portal admin. No hay nuevas solicitudes de aprobación ni funcionalidades de chat simuladas.


## Encuestas y opiniones — 27 de octubre de 2026

Con las dos migraciones anteriores ya aplicadas, ejecutar una sola vez `supabase/migrations/202610270001_surveys.sql` en SQL Editor. No requiere una clave secreta en la app. Esta migración agrega versiones inmutables, respuestas privadas con RLS, funciones públicas de consulta/envío, archivado de empleados, redes y el bucket público `restaurant-logos`. Las tablas de respuestas y versiones no admiten escritura directa desde clientes; los envíos se validan en PostgreSQL contra las preguntas originales. Las fotos de empleados siguen siendo privadas.

Recorrido para revisión manual por el propietario: configurar restaurante y Google Maps → agregar empleado → diseñar encuesta → probar Vista previa → guardar borrador → publicar → abrir enlace desde Mi encuesta → enviar opinión → revisar Resumen y Opiniones. Guardar otro borrador no cambia la versión pública. Publicar cambios no altera respuestas anteriores. El panel de detalle muestra la fecha en horario de Monterrey.

Las redes y el logo reflejan los datos actuales del restaurante; las preguntas, el nombre del restaurante y el nombre del empleado asociados a una respuesta se conservan históricamente. La eliminación desde Mi equipo archiva al empleado y conserva sus datos necesarios para el historial; no es una eliminación de datos personales completa.

Por instrucción del propietario no se ejecutaron pruebas, typecheck, build ni revisión de navegador durante este sprint. Los comandos de verificación anteriores quedan como referencia para que el propietario los ejecute. El aviso de privacidad sigue pendiente de completar antes del lanzamiento público.


## Survey Builder V2 — Personalizar, Preguntas y Publicar

Aplicar `supabase/migrations/202610270002_survey_builder_v2.sql` después de las tres migraciones anteriores. No volver a ejecutar migraciones ya aplicadas. No se ejecutó esta migración en Supabase durante la implementación.

El editor incorpora tres pasos con autosave tras 900 ms sin cambios de texto y cola de guardado. Se guarda el paso actual. El estado Guardado solo aparece tras una respuesta exitosa del backend. Los errores muestran Reintentar; los cambios nuevos no se sustituyen por respuestas antiguas. Al salir mediante los enlaces de la aplicación se intenta terminar el guardado; al recargar con cambios pendientes, el navegador puede pedir confirmación.

En Personalizar, las pestañas Color, Imagen y Botones conservan sus valores y abren inicialmente en Color. Admiten flechas izquierda/derecha, Inicio y Fin. La vista previa usa el mismo `CustomerSurvey`, tema y reglas de contraste que la encuesta pública. En móvil se abre desde Vista previa. Probar el envío no escribe respuestas ni muestra la invitación a Google.

Los temas contienen fondo hexadecimal, ruta de imagen y color de acento. La imagen tiene prioridad y el color queda como respaldo. El contenido permanece dentro de una tarjeta clara protegida del fondo. Los temas se guardan por separado en borradores y versiones publicadas; editar un borrador no cambia la versión activa. Las respuestas existentes no se modifican.

Las imágenes de fondo se suben a `survey-backgrounds`, bucket público de Supabase con límite de 5 MB y formatos JPG/PNG/WebP. La app comprueba tamaño/formato, decodificación local y firma del archivo en servidor. Usa subida directa con URL firmada para no pasar archivos de 5 MB por el límite de recepción de las funciones de Vercel. Se valida la pertenencia al restaurante, la ruta y los metadatos del objeto al guardar/publicar. Los archivos son públicos; no subir imágenes confidenciales. Cambiar o quitar una imagen elimina la referencia del borrador, sin borrar archivos que una versión publicada pudiera seguir utilizando. No hay limpieza automática de imágenes sin referencias en este sprint.

`editor_state` conserva preguntas incompletas mientras se editan; las columnas canónicas siguen cumpliendo las restricciones previas. Publicar exige título y preguntas válidos, Google Maps y un tema válido. Las presentaciones corta/larga usan el tipo existente text, y calificación/Sí-No usan single con opciones fijas: se conserva el formato de respuestas anterior.

Archivos principales: `src/components/survey-editor.tsx`, `survey-design.tsx`, `customer-survey.tsx`, `src/hooks/use-survey-autosave.ts`, `src/lib/survey-theme.ts`, `validation.ts`, `restaurant-data.ts` y `src/app/actions/workspace.ts`.

No se ejecutaron tests, typecheck, lint, build ni revisión de navegador para este sprint, por instrucción del propietario. La guía anterior de comprobaciones permanece disponible para su revisión manual.

## Ajustes de bandeja y estado publicado

La bandeja de opiniones agrupa sus filtros existentes en un desplegable y presenta filas compactas, sin cambios de consulta, filtros, orden ni paginación. Los extractos usan únicamente respuestas de preguntas de texto cuyo tipo ya se conoce con los datos cargados; si no se conoce, se omiten. No se agregó un estado leído/no leído.

Al entrar en Mi encuesta, una encuesta ya publicada muestra su estado y Editar encuesta. Los enlaces de empleados dejaron de mostrarse en la cuenta del restaurante: su administración queda pendiente para el portal admin. Al finalizar la encuesta pública se destacan las redes configuradas. El nav indica con un icono cuando el restaurante seleccionado aún no tiene una encuesta publicada.
