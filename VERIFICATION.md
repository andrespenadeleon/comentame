# Verificación de la migración

Realizada localmente con Node.js 24.22.1, Next.js 16.4.3, React 19.3.1 y TypeScript 7.0.2.

- Compilación de producción (`next build --webpack`): correcta.
- TypeScript (`tsc --noEmit`): sin errores.
- Pruebas (`node --import tsx --test --test-force-exit tests/*.test.ts`): 6 correctas.
- Smoke HTTP (`node scripts/smoke.mjs`, contra `next start`): 16 comprobaciones correctas. Dashboard, onboarding y cambio de contraseña devuelven 307 a login sin sesión. Las rutas HTML antiguas redirigen con 308; páginas públicas y assets responden 200.
- Los cinco assets originales usados en producción se compararon byte por byte con V8: sin cambios.
- Supabase remoto, comprobación de solo lectura: registro por email habilitado, confirmación de correo obligatoria y tabla `profiles` ausente (404/PGRST205). No se ejecutó la migración en el proyecto remoto.

Las pruebas SQL ejecutan la migración real en PostgreSQL embebido (PGlite), con contratos mínimos de `auth` y `storage` de Supabase. Cubren acceso entre cuentas, restricciones de creación de restaurantes, autorización de un segundo restaurante, permisos sobre identificadores, fotos y validación de borradores.

No se realizaron altas reales, envíos de correo ni submissions de Formspree. Falta verificar el recorrido completo en Supabase hospedado después de aplicar la migración y configurar Auth/SMTP. No se desplegaron cambios en Vercel. El acceso al navegador no estaba disponible y el acceso nativo a Chrome no fue aprobado: la revisión visual responsive sigue pendiente.

## Sprint de feedback

- TypeScript sin errores.
- 14 pruebas correctas: incluyen render de los estados vacío/con empleados, filtro condicional para varios restaurantes, navegación ordenada, modal de verificación y loaders accesibles.
- Regresión de opciones completas con una línea vacía final: corregida y cubierta por prueba.
- SQL: actualización de borradores existentes (incluido uno con 20 preguntas), calificación fija obligatoria, Google Maps opcional, cupo y aislamiento entre cuentas comprobados en PostgreSQL embebido.
- Las pruebas de componentes reemplazan únicamente los transportes de servidor y el router; no sustituyen una revisión visual responsive ni verifican el envío real de correo.
- Migración remota nueva pendiente: `supabase/migrations/202610260002_feedback.sql`. No se realizaron cambios en Supabase ni se enviaron correos de prueba.
- Revisión visual no realizada: el navegador conectado no estaba disponible y el acceso nativo a Chrome no fue aprobado.
- Compilación final de producción correcta con Node.js 26 disponible en este entorno; las pruebas SQL/componentes y TypeScript también pasaron con Node.js 24. La versión configurada para Vercel se mantiene en Node.js 24 LTS.
- No se ejecutó la comprobación HTTP final de este sprint: la autorización para `scripts/smoke.mjs` fue rechazada. La verificación HTTP de la migración anterior no cuenta como verificación de estos cambios.


## Sprint de encuestas — 27 de octubre de 2026

Se implementaron editor visual, vista previa sin persistencia, borrador/publicación separados, formulario público, respuestas con atribución y versión, resumen, filtros y detalle, logo/redes, soporte pendiente y carga centrada.

Por instrucción expresa del propietario, no se ejecutaron tests, typecheck, build, smoke scripts ni revisión de navegador para estos cambios. Los resultados históricos de este documento no validan el sprint actual. La migración `202610270001_surveys.sql` no se aplicó al proyecto remoto; el propietario debe ejecutarla después de las dos migraciones anteriores y realizar su validación.


## Survey Builder V2 y pestañas de diseño

Implementación local de tres pasos, autosave de borradores incompletos, pestañas accesibles Color/Imagen/Botones, temas compartidos entre vista previa y encuesta pública, subida persistente firmada a Supabase y revisión/publicación separadas. Migración preparada: `202610270002_survey_builder_v2.sql`.

No se ejecutaron tests, typecheck, lint, build ni comprobaciones de navegador en este sprint por instrucción del propietario. No se aplicó la migración al proyecto remoto. Esta sección registra el alcance, no resultados verificados.

## Feedback de interfaz: bandeja de opiniones y encuesta publicada

Cambios locales de presentación: filas compactas de opiniones con nombre, estrellas y valor numérico, empleado etiquetado, restaurante y fecha/acción alineados; filtros existentes agrupados en un desplegable con icono; redes destacadas al terminar; acceso a opiniones del empleado mediante icono; aviso de encuesta pendiente en navegación; estado de encuesta publicada con un botón Editar encuesta. Se retiraron los enlaces de empleados de la interfaz del restaurante, sin implementar todavía el portal admin.

Se conservaron las consultas, filtros, orden, paginación, esquema, API y destinos del detalle. Por decisión expresa del propietario, no se amplió la consulta para obtener los tipos de preguntas: los extractos solo aparecen cuando las preguntas de la versión original ya están disponibles (por ejemplo, en el resumen para la versión publicada o cuando ya se cargó su detalle). No se infiere que una opción seleccionada sea un comentario. No existe modelo de leído/no leído, y no se agregó.

No se ejecutaron tests, typecheck, build ni revisión de navegador, por instrucción del propietario. Estos cambios no requieren una nueva migración.
