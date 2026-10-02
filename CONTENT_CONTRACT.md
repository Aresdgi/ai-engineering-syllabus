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
