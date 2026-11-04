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

## Tiempo activo e inicio de encuesta

Aplicar `supabase/migrations/202611030002_survey_engagement.sql` después de la migración de visitas. No se ha aplicado remotamente. No se ejecutaron tests, typecheck ni builds.

Cada apertura usa el mismo UUID para visitas y participación. El primer cambio de un input marca el inicio, incluso si después se borra. Se guarda un acumulado de tiempo visible cada 15 segundos y al ocultar/salir mediante Beacon o keepalive. Al regresar continúa; al guardar una respuesta termina. El tiempo no identifica atención humana: una pestaña visible sin interacción sigue contando. Los saltos de reloj/suspensión se limitan a 30 segundos por intervalo y el total a 24 horas. Los últimos segundos pueden perderse si el navegador termina sin reportar.

Solo se reportan identificadores de campos tocados y de campos con contenido; nunca texto, contacto ni respuestas parciales. La secuencia de eventos protege el último estado frente a peticiones fuera de orden; tiempo y campos tocados son acumulativos. La finalización se registra en la misma transacción que la respuesta validada, vinculada por response_id, y los eventos tardíos no la revierten. Dejar otra opinión recarga para crear una apertura nueva. Las vistas previas no registran nada.

El embudo, los tiempos y el desglose por pregunta usan exclusivamente visitas con el nuevo tracking. Los registros anteriores no se incluyen. Se agrupa cada pregunta por restaurante y versión original para no mezclar cambios de preguntas. El periodo corresponde a la apertura de la sesión. Las estrellas solo filtran opiniones, no el embudo. Iniciadas sin envío es un estado actual, no abandono definitivo.

El endpoint de reporte es público para permitir encuestas sin login: el UUID aleatorio actúa como identificador de la apertura y no se expone públicamente. Se validan vínculos, campos permitidos, tamaños y rangos en servidor/SQL. Son métricas aproximadas del navegador, no un mecanismo antifraude. Los envíos y el conteo básico de visitas siguen funcionando durante el despliegue si falta la nueva migración.

El portal admin también presenta el embudo, tiempos y participación por empleado, respetando búsqueda, restaurante y estado del directorio. Las consultas de administración siguen detrás de la comprobación explícita de portal_admin.
