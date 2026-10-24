# Manga Tambo

PWA de lectura de caravanas con persistencia local y sincronización confirmada con Google Sheets.

## Compatibilidad

Se mantienen las rutas, manifests, nombres de IndexedDB y claves de localStorage. Al abrir cada módulo se guarda una copia previa en `MangaTamboBackups_v1`, sin vaciar ni migrar la base original. Respaldar descarga un JSON del módulo. Vaciar Local bloquea el borrado si hay pendientes.

Los módulos conservan el control de repetidos existente. La base central conserva las columnas y el modelo de último evento. Los enviados anteriores no se reclasifican ni se reenvían automáticamente.

## Publicación

El cliente utiliza protocolo 1 y exige una confirmación individual. `appsscript/Tambo.gs` debe instalarse como único doPost/doGet y publicarse en la implementación de Inseminación existente. Las otras siete implementaciones históricas se conservan para clientes anteriores. Las funciones legacy del editor tienen nombres únicos y no son puntos de entrada. No publicar el cliente sin verificar primero salud y dryRun del backend.

## Pruebas

`node --test tests/*.test.cjs`

No incluyen escrituras en la planilla productiva. La verificación de datos compara la exportación anterior y posterior.
