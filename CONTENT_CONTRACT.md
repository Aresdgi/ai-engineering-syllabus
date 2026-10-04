# Content Contract

Contrato obligatorio para cualquier código que procese el syllabus.

## Categorías de contenido

### SOURCE

Contenido directamente importado del repositorio.

Debe conservar:

- source_path;
- source_url;
- source_commit;
- source_hash;
- language;
- raw_content.

### USER

Contenido creado por el usuario:

- notas;
- marcadores;
- progreso;
- repositorios personales;
- comentarios personales.

Nunca debe mezclarse con SOURCE.

### AI_RESPONSE

Respuesta del tutor.

No forma parte del syllabus.

Debe poder mostrar las fuentes SOURCE usadas.

### EXTERNAL_ARCHIVE

Copia literal de material externo enlazado por documentos del corpus,
conservada para que el curso siga consultable sin acceso a 4Geeks (ADR-020).

Puede contener:

- Markdown literal de lecciones externas, capturado vía API pública del registro
  BreatheCode + raw de GitHub con commit pinneado, con sus imágenes;
- metadatos de respaldo Wayback Machine de enlaces de herramienta;
- páginas de sustitución (`alias`) de lecciones retiradas, decididas por el
  usuario, que muestran el Markdown literal de la lección destino.

Dónde vive:

- tablas propias `external_archive_items`, `external_archive_assets` y
  `external_archive_item_assets`, nunca en las tablas SOURCE;
- vista propia `/archive/…` (material) y `/archive-assets/<sha256>` (imágenes).

Reglas de literalidad y marcado:

- literalidad: se guarda byte a byte (`sha256` verificable), con URL original,
  fecha de captura, método y hash; sin resúmenes, traducciones, títulos ni
  descripciones generadas (el `title` solo se guarda si es literal);
- marcado: todo item se muestra con el aviso visible
  "Material externo archivado. No forma parte del repositorio." (EN: "Archived
  external material. Not part of the repository.");
- render: allowlist de saneado de ADR-014; las URLs de imagen se reescriben a
  `/archive-assets/<sha256>` solo en render, sin mutar el contenido guardado;
- alias: fila con `status = 'alias'`, `method = 'user-alias'` y
  `alias_of_canonical_url`; el mapa es un dato versionado
  (`platform/src/external-archive/aliases.json`) y la página muestra un aviso
  persistente de sustitución con enlace al original retirado; no se genera
  texto educativo;
- runtime: leer `/archive/…` no requiere ningún host de 4Geeks;
- los enlaces de marketing (`4geeksacademy.com/*`, home de `4geeks.com`) no
  entran en esta clase: quedan intactos (AC-2.5.6).

## Prohibición de contenido DERIVED persistido como curso

No generar y guardar mediante IA:

- lecciones;
- módulos;
- proyectos;
- requisitos;
- quizzes;
- resúmenes "oficiales";
- rúbricas.

Si en el futuro se añade alguna ayuda derivada, deberá mostrarse visualmente como ayuda generada, nunca como fuente del curso.

## Fidelidad

El renderer puede:

- transformar Markdown a HTML;
- resolver enlaces relativos;
- mostrar bloques de código;
- renderizar imágenes;
- añadir tabla de contenidos;
- mejorar navegación.

No puede:

- omitir requisitos silenciosamente;
- reescribir instrucciones;
- alterar números;
- modificar restricciones;
- combinar proyectos distintos como si fueran uno.

## Idioma

Cuando exista `README.es.md`, `CONTEXT-*.es.md` u otra variante española, la plataforma puede preferirla.

Si no existe español:

- mostrar el original disponible;
- opcionalmente permitir traducción como herramienta separada;
- la traducción debe marcarse como traducción, no como fuente original.

## Enlaces

Los enlaces relativos del repo deben conservar su semántica.

## Archivos auxiliares

El importador debe reconocer cuando corresponda:

- README.md
- README.es.md
- learn.json
- assets
- CSV
- JSON
- PDFs
- contextos
- archivos de referencia

No asumir que cada proyecto tiene idéntica estructura.
