# Leads por restaurante

## Implementado localmente

- Navegación Leads en dashboard y portal admin. Admin debe elegir un restaurante; no se mezclan contactos entre restaurantes.
- Una fila por encuesta enviada con nombre y contacto: nombre, contacto original, fecha/hora (Monterrey), mesero y estado de clic voluntario en Google. Página de 20 registros ordenados por fecha e ID.
- Ver detalles reutiliza el diálogo de opinión y las preguntas de la versión original. Cerrar o usar Escape conserva restaurante y página.
- Clave de contacto normalizado preparada por respuesta: correo recortado/en minúsculas o teléfono mexicano +52. Formatos desconocidos devuelven null; el nombre no identifica personas. Usar siempre junto al restaurant_id en futuras agrupaciones. No se fusionan personas, no se verifica identidad y no se implementan campañas.
- Sin redirección automática: Google se abre únicamente al pulsar el enlace, para cualquier calificación. Preview no navega ni registra clics. El tiempo y las respuestas mantienen el tracking existente.

## Migración necesaria antes de desplegar la app

Aplicar `supabase/migrations/202611180001_restaurant_leads.sql` después de las migraciones anteriores. No fue aplicada desde esta sesión.

La función de lectura valida en SQL usuario autenticado y propietario del restaurante o portal admin, y limita también el detalle al restaurante y a respuestas con contacto. La lista no trae respuestas completas; solo el detalle solicitado las incluye. No se amplían las políticas de lectura directa de tablas.

La columna event_kind marca todos los eventos existentes como legacy. Se conservan sin contarlos como clics confirmados, porque no es posible separar clics de redirecciones históricas. La nueva función de escritura registra voluntary; la función anterior sigue creando solo legacy. El endpoint exige event_kind=voluntary, así que clientes antiguos que todavía tengan el temporizador no pueden clasificar sus eventos como clics voluntarios. Los agregados de Google cuentan únicamente voluntary, sin cambiar el resto de cálculos.

Leads distingue Sí / Histórico sin confirmar / Sin clic registrado. Los agregados de Google siguen visibles solo en admin; el estado individual del lead sí es visible para el restaurante según la última decisión.

## Validación

Solo revisión de código y diffs, incluyendo autorización, alcance por restaurante, paginación, separación de eventos y reutilización del detalle. No se ejecutaron tests, build, typecheck ni revisión en navegador, siguiendo la instrucción del usuario. No hay commit, push ni despliegue en esta tarea.


## Apertura inmediata de detalles (optimización local)

Aplicar también `supabase/migrations/202611180002_lead_details_prefetch.sql`. Esta función reutiliza la validación de acceso de restaurant_leads y en la misma llamada entrega las respuestas/preguntas originales para los 20 leads de la página actual. No se precarga todo el historial. La carga inicial transfiere más contenido; abrir y cerrar un lead preparado ya no requiere peticiones a Supabase ni recargar el dashboard.

LeadDetails controla el diálogo usando el query param detail y la integración documentada de Next con History API. Conserva enlaces profundos, navegación Atrás/Adelante, clic modificado y nueva pestaña. El listado permanece visible; Escape, cerrar y backdrop usan el mismo cierre local. Las otras secciones conservan su navegación. No hay caché global de contactos ni respuestas entre restaurantes o usuarios.

Sin la segunda migración se conserva la lectura anterior como fallback; la mejora de precarga requiere aplicarla. Sin tests, builds ni benchmark: el resultado de rendimiento aún requiere la prueba manual del usuario.


## Drawer compartido: Leads, Opiniones y métricas y admin

ResponseDetails comparte la apertura local entre listas; OpinionDialog mantiene el panel montado durante los 220ms de salida. Escape, botón cerrar, backdrop y cambios de historial respetan la animación, con movimiento desactivado según prefers-reduced-motion. La precarga de preguntas originales en Opiniones requiere además `supabase/migrations/202611180003_opinion_details_prefetch.sql`; la función admite hasta 20 IDs y filtra cada respuesta por propietario o portal admin. Usa las respuestas ya cargadas y no vuelve a consultar todos los indicadores al abrir/cerrar. Los filtros, paginación y cambio de restaurante siguen usando navegación de servidor.

El resumen de admin conserva su URL y contexto al abrir una opinión reciente. Sin la nueva función SQL, la navegación existente permanece como fallback. No se ejecutaron tests, builds ni pruebas de navegador para estos ajustes.
