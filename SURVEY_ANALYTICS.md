# Visitas y navegación por restaurante

Aplicar `supabase/migrations/202611030001_survey_visits.sql` después de las migraciones anteriores. La migración no se ha ejecutado contra Supabase desde esta implementación.

Cada apertura/recarga de una encuesta publicada envía un evento desde el navegador, después de montar la encuesta. Las vistas previas, el prefetch y las encuestas no disponibles no generan visitas. Un UUID por apertura evita duplicar el conteo por Strict Mode o repetir el mismo evento. No se guardan IP, cookies de visitantes, nombres o contactos. El evento incluye restaurante, empleado, versión y fecha del servidor. No se cuentan personas únicas ni se recuperan visitas anteriores a la activación. Los bloqueadores de solicitudes o visitantes sin JavaScript pueden impedir registrar una apertura.

La tabla tiene RLS y solo permite lectura al propietario del restaurante. Los clientes públicos no pueden escribir directamente: `record_survey_visit` valida que restaurante, empleado activo y versión publicada correspondan. El portal consulta el conteo global y por empleado mediante su función protegida por `private.portal_admins`.

## Interfaz

- Resumen: visitas, opiniones y promedio para el restaurante y periodo seleccionados.
- Opiniones y métricas: pestañas Opiniones / Por empleado, visitas, opiniones, promedio, conversión por apertura y distribución de estrellas. La tabla por empleado incluye archivados con su indicación y enlaza a sus opiniones.
- Filtros comunes: periodo, calificación, empleado y alcance (restaurante activo / todos mis restaurantes). Una visita no tiene estrellas: ese filtro solo afecta las respuestas. La conversión se omite con un filtro de estrellas, cero visitas o más respuestas que visitas. Las respuestas previas al registro pueden afectar la proporción.
- Portal admin: visitas acumuladas según los filtros existentes del directorio y conteo por empleado.
- Mientras falta la migración, las métricas de visitas se muestran pendientes y la encuesta sigue funcionando.

## Selección de restaurante

El selector del sidebar reemplaza los botones horizontales. Usa logo o iniciales, selección marcada, búsqueda local con más de cinco restaurantes y acceso a Administrar restaurantes. Un solo restaurante se muestra sin dropdown. Se integra en el drawer móvil existente.

La URL es la fuente de verdad para el restaurante explícito. La cookie `cm_restaurant` conserva la última selección como preferencia; nunca concede permisos. El servidor valida la selección contra los restaurantes del usuario en cada render y elige uno autorizado si el ID guardado o recibido ya no está disponible. Al cambiar de restaurante se conserva sección/periodo/pestaña y se eliminan empleado, calificación, página, detalle y alcance consolidado. El contenido anterior se oculta mientras cambia para evitar mostrar datos viejos como actuales.

No se ejecutaron tests, typecheck, build ni QA de navegador, conforme a la indicación del usuario. No se aplicaron migraciones remotas ni se hizo commit/push.
