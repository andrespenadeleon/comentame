# Resumen del restaurante — 9 de noviembre de 2026

Presentación exclusiva de la sección Resumen de la cuenta del restaurante. No cambia el portal admin, Opiniones, permisos, editor, selector de restaurantes ni gestión de empleados.

Encabezado sin breadcrumb ni subtítulo, con nombre dinámico en azul. Toolbar compacta a la derecha, con las mismas opciones 7/30/90/all y formulario Actualizar. Cuatro KPIs reutilizan los agregados existentes: visitas, opiniones, promedio y clics Google (no reseñas confirmadas). Se quitó la lista de opiniones recientes solamente del overview; ya no se consulta para esta pantalla.

Aplicar `supabase/migrations/202611090001_restaurant_employee_performance.sql` para el agregado de desempeño. Consulta solo lectura con SECURITY INVOKER, RLS y comprobación del propietario. No crea tablas ni cambia las consultas de Opiniones. Antes de aplicarla, las tarjetas de empleados muestran que está pendiente activar la consulta; no inventan datos.

No había ranking, configuración de periodo ni exclusiones de ranking implementadas. Se usa el mismo periodo seleccionado para todos los indicadores. Reconocimiento: empleados activos, puestos reconocidos de atención al comensal y mínimo 3 opiniones. Roles reconocidos por texto: mesero/a, camarero/a, waiter/waitress, anfitrión/a, host/hostess, bartender, barista y garrotero/a. Se excluyen puestos que también indiquen gerencia, administración, encargado, propietario, dueño, cocina, chef, limpieza o mantenimiento. Puestos personalizados no reconocidos no participan; su desempeño puede aparecer con el estado Fuera del reconocimiento. Esta lista queda centralizada en employee-performance.ts para ajustarse a la nomenclatura real.

Orden: promedio exacto calculado desde suma/cantidad, porcentaje exacto de cinco estrellas y cantidad de opiniones. Empates en todos los criterios comparten puesto y reconocimiento; nunca se desempata al ganador por nombre o UUID. Las cifras mostradas se redondean solo al presentar. El panel de personas muestra máximo tres filas y un enlace a las métricas completas con el periodo conservado. Muestra sin opiniones, muestra insuficiente y falta de migración tienen estados distintos.

Sin tests, typecheck, builds ni QA de navegador por instrucción del usuario. Solo revisión del código y comprobación de disponibilidad de localhost. No se aplicó la migración remota ni se hizo commit/push.

Archivos: src/app/dashboard/page.tsx, src/app/globals.css, src/components/restaurant-overview.tsx, src/components/employee-performance-panels.tsx, src/lib/overview.ts, src/lib/employee-performance.ts y la migración indicada. Reglas de reconocimiento confirmadas por el usuario durante esta implementación.
