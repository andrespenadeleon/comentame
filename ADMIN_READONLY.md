# Portal admin y equipo compacto

Aplicar `supabase/migrations/202611030003_portal_readonly_dashboard.sql` después de las migraciones de visitas y engagement. La migración no se ha aplicado remotamente.

El portal conserva la comprobación server-side de `private.portal_admins`. Cada nueva RPC vuelve a comprobar ese permiso antes de consultar datos globales. No se ampliaron políticas RLS, permisos de tablas ni acciones de escritura de las cuentas de restaurantes.

Navegación: Resumen, Opiniones y métricas, Restaurantes, Equipo, Encuestas, Soporte. Selector compartido con el dashboard, preferencia independiente `cm_portal_restaurant`, validada contra los restaurantes obtenidos con permiso admin. Incluye Todos los restaurantes. El resumen y Opiniones reutilizan la presentación, periodos, filtros, paginación y detalle existentes. Las rutas del portal permanecen en `/admin`.

Encuestas permite consultar borradores y versiones publicadas, indicando la activa. Las versiones publicadas tienen paginación de 20. La vista previa usa el mismo renderizador con `preview`, sin tracking ni guardado de respuestas. No se puede editar, publicar, crear restaurantes ni modificar empleados desde este portal. Soporte sigue como placeholder.

El listado compacto se aplica a Mi equipo y al directorio admin. Se conservan las acciones de edición/eliminación de la cuenta propietaria dentro de detalles; las acciones de copiar/abrir siguen solo en admin. Solo se expande una fila a la vez. Se reutilizan los cálculos y las RPC de métricas existentes; Mi equipo agrega su lectura para disponer de las métricas que antes no cargaba. No se inventan valores cuando el tracking no está disponible. Las métricas del equipo son acumuladas.

Los enlaces copiados agregan `?restaurante=nombre&empleado=nombre-apellido`. Son etiquetas descriptivas, pueden quedar desactualizadas al renombrar y no se usan para autorización, renderizado ni atribución. Los UUID continúan siendo la identidad real; los enlaces viejos siguen funcionando. El texto identifica personas a quien reciba el enlace, por decisión del producto.

Sin tests, typecheck, builds ni revisión de navegador por instrucción del usuario. Sin commit/push. Archivos principales: componentes compact-employee-row, portal-employee-list, portal-employee-row, employees, dashboard-shell, restaurant-switcher; página admin; lib portal-dashboard, restaurant-data y tipos/links de opiniones; globals.css y migración SQL.
