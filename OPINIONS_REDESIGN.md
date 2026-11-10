# Opiniones y métricas — 9 de noviembre de 2026

Se reordena la sección compartida por restaurante y portal: tabs/filtros → contexto y chips → recorrido de conversión → dos KPIs → distribución y vista previa de participación → lista de opiniones o empleados. No se modifican consultas, APIs, SQL, agregados del backend, permisos ni lógica de filtrado. Las proporciones de la presentación se calculan sobre sus cohortes correspondientes.

El embudo usa engagement.visits, starts y completions, la misma cohorte con tracking; no se mezclan los inicios recientes con aperturas históricas sin seguimiento. Si las visitas históricas totales difieren se muestra el contexto. Clics a Google cuenta repeticiones reales y su ratio por encuesta completada puede superar 100%; el indicador decorativo se limita visualmente a 100%, el texto conserva la proporción real. No acredita reseñas publicadas.

Calificación promedio conserva el agregado de opiniones y sus filtros. Visitas con opinión es completions / engagement.visits, no respuestas históricas / visitas recientes. Embudo y participación no se filtran por estrellas; se aclara junto a las métricas. Tiempo activo e iniciadas sin envío se conservan como información compacta bajo el recorrido.

Los chips y selects usan estado efectivo de la consulta y la URL. Remover un filtro restablece paginación/detalle y conserva el resto del estado; limpiar vuelve al periodo por defecto, contexto activo y tab vigente. Un key del formulario sincroniza los defaultValue después de navegar. Las barras de estrellas aplican el filtro existente.

La pantalla de preguntas se integra con `section=opiniones&view=questions` en las rutas existentes /dashboard y /admin. El enlace de vuelta conserva restaurante, periodo, tab, filtros y página. Usa el mismo data fetching y hereda Suspense/loading/error existentes. No se añade una navegación paralela ni un modal.

Por decisión explícita del usuario, NO se agrega la posición original de pregunta a las consultas. Tanto la vista previa (máximo 3) como la completa conservan el orden actual entregado por el RPC: cantidad de respuestas, etiqueta y versión. Esto no garantiza el orden de creación de la encuesta. No se inventa ni reconstruye un orden desde los UUID.

La lista de opiniones y el detalle/paginación se conservan. La lista por empleado se simplifica a sus datos principales; el rol se muestra solo si ya viene en los datos, sin ampliar consultas. Las métricas adicionales siguen en los detalles de Mi equipo. El rediseño del Resumen previo queda independiente.

Archivos: components/opinions.tsx, opinion-analytics.tsx, opinion-filters.tsx; lib/opinion-navigation.ts y tipos en lib/opinions.ts; títulos condicionales en app/dashboard/page.tsx y app/admin/page.tsx; estilos scoped en app/globals.css.

Sin tests, typecheck, builds ni QA de navegador por instrucción del usuario. Sin migraciones, commit ni push en esta tarea.
