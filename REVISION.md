# Revisión de seguridad y mejoras — Reglas de Derivación SSVSA

Fecha: 20 de octubre de 2026. Repositorio: `cmorenoglobal/derivacion-red`.

## Resumen en pocas líneas

- **No es un sitio fácil de atacar.** Es una página estática: no tiene usuarios ni contraseñas, no tiene formularios que envíen datos a ningún servidor, no tiene base de datos y no guarda nada de quien la visita. Lo único que hace es leer `reglas.xlsx` y mostrarlo en tablas.
- **No hay datos de pacientes ni claves expuestas.** Revisé el Excel (4.539 reglas) y todo el historial de git (7 commits): solo hay reglas de derivación (comunas, establecimientos, especialidades, diagnósticos CIE-10). No aparecen RUT, nombres de pacientes, correos, teléfonos, claves ni tokens.
- **Para "botarlo" o modificarlo, la vía real es tu cuenta de GitHub**, no el código. Quien entre a tu cuenta puede cambiar las reglas que ve toda la red. Por eso la recomendación más importante es proteger la cuenta (ver punto S1).
- Corregí directamente 6 cosas de bajo riesgo (ver tabla). Todas las probé en un navegador Chromium: la página carga las 4.539 reglas, filtra, exporta a Excel y ahora también funciona sin internet.
- Lo que más ayudaría a quienes usan la página en el celular: **buscador por diagnóstico, mostrar la prioridad de cada regla y no dibujar las 4.539 reglas de una vez** (ver mejoras M1 a M3).

## Lo que ya quedó corregido en esta rama

| # | Cambio | Por qué |
|---|--------|---------|
| 1 | Se escapa el texto del Excel antes de mostrarlo (`esc()`) | Una celda con código HTML (por ejemplo `<img onerror=...>`) se ejecutaba en el navegador de quien consultaba. Probado con un Excel trampa: ya no se ejecuta. |
| 2 | Política de seguridad (CSP) y `Referrer-Policy` como meta etiquetas | Limita de dónde puede cargar scripts la página (solo el propio sitio y cdnjs) y bloquea `<object>`, `<base>` ajenos y envío de formularios. |
| 3 | Service worker con rutas relativas y "red primero" | Usaba rutas como `/index.html`, que en GitHub Pages apuntan a la raíz del dominio y no a `/derivacion-red/`: nunca llegaba a instalarse. Además era "caché primero", así que si se hubiera instalado mostraría para siempre una versión vieja de la página y guardaría una copia nueva de `reglas.xlsx` en cada visita. |
| 4 | El service worker guarda también la librería del CDN | Sin eso, sin internet la página abría pero no podía leer el Excel. Ahora sin conexión se cargan las reglas de la última visita. |
| 5 | Accesibilidad: `<label for>` en los filtros, aviso anunciado a lectores de pantalla, zona de "cargar archivo manualmente" usable con teclado | Lectores de pantalla y uso sin mouse. |
| 6 | Exportar a Excel ya no falla con especialidades vacías, con `/ : ? * [ ]` o con nombres que coinciden en los primeros 31 caracteres | Excel rechaza esos nombres de hoja y la exportación se caía con un error. |

No se cambió ningún dato clínico ni se borró contenido.

---

## Parte 1 — Seguridad y disponibilidad

Clasificación: **Alto** = conviene hacerlo ya; **Medio** = hacerlo pronto; **Bajo** = bueno tenerlo.

### S1. Acceso a tu cuenta de GitHub — **Alto** (pendiente, lo debes hacer tú)

- **Qué pasa:** eres el único con permisos (admin) y la rama `main` no tiene protección. Todo el contenido se sube con "Add files via upload" desde la web.
- **Cómo se explotaría:** alguien que obtenga tu contraseña (phishing, contraseña repetida en otro sitio filtrado) podría cambiar `reglas.xlsx` para derivar pacientes al establecimiento equivocado, cambiar la página para mostrar otra cosa, o borrar el repositorio. Nadie lo notaría hasta que alguien reclame.
- **Cómo arreglarlo:**
  1. Activa la verificación en dos pasos en GitHub (Settings → Password and authentication), idealmente con passkey o app autenticadora, no SMS. Guarda los códigos de recuperación.
  2. En el repositorio: Settings → Rules → Rulesets → nueva regla para `main` que **bloquee borrado y "force push"**. Así, aunque alguien suba algo, el historial anterior queda y se puede volver atrás.
  3. Revisa de vez en cuando Settings → Applications / Sessions y quita lo que no reconozcas.

### S2. Librería SheetJS (xlsx) 0.18.5 con fallas conocidas — **Medio** (pendiente)

- **Qué pasa:** la página usa `xlsx 0.18.5` desde cdnjs. Esa versión tiene dos vulnerabilidades públicas: CVE-2023-30533 ("prototype pollution" al leer un archivo manipulado, corregida en 0.19.3) y CVE-2024-22363 (un archivo manipulado puede dejar la pestaña colgada, corregida en 0.20.2). cdnjs ya no publica versiones nuevas de esta librería.
- **Cómo se explotaría:** alguien tendría que convencer a un usuario de cargar manualmente un Excel trampa (botón "cargar archivo manualmente"), o reemplazar `reglas.xlsx` (lo que requiere tu cuenta, ver S1). El impacto práctico es bajo: lo más probable es que la pestaña se cuelgue o la tabla muestre datos raros.
- **Cómo arreglarlo:** descargar `xlsx.full.min.js` versión 0.20.3 desde el sitio oficial (`https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`), subirlo al repositorio y cambiar el `<script src>` a `xlsx.full.min.js`. Esto además elimina la dependencia de cdnjs (ver S4) y permite quitar `https://cdnjs.cloudflare.com` de la CSP y de `sw.js`. No lo hice aquí porque cambia el origen de la librería y desde este entorno no se puede acceder a cdn.sheetjs.com para probarlo.

### S3. Script externo sin verificación de integridad (SRI) — **Medio** (pendiente)

- **Qué pasa:** `<script src="https://cdnjs.cloudflare.com/.../xlsx.full.min.js">` no tiene atributo `integrity`. La versión sí está fijada (0.18.5), lo que está bien.
- **Cómo se explotaría:** si cdnjs fuera comprometido y cambiara ese archivo, el código del atacante correría en tu página. Es poco probable, pero ya ha ocurrido con otros CDN (por ejemplo polyfill.io en 2024).
- **Cómo arreglarlo:** lo mejor es S2 (tener la librería dentro del repositorio). Si prefieres seguir con cdnjs: en `https://cdnjs.com/libraries/xlsx/0.18.5` usa "Copy SRI" del archivo `xlsx.full.min.js` y agrega `integrity="sha512-..." crossorigin="anonymous"` al `<script>`. No lo agregué porque desde este entorno cdnjs está bloqueado y no pude comprobar el hash del archivo exacto que sirve cdnjs; un hash equivocado deja la página sin funcionar para todos.

### S4. Dependencia de cdnjs para funcionar — **Bajo/Medio** (disponibilidad)

- Si cdnjs se cae, o si el firewall de algún hospital o CESFAM bloquea `cdnjs.cloudflare.com`, la página abre pero queda en "No se pudo cargar". Se resuelve con lo mismo de S2 (librería dentro del repositorio).

### S5. Inyección de código (XSS) al mostrar la tabla — **Medio → corregido**

- **Qué pasaba:** los textos del Excel se insertaban con `innerHTML` sin escapar.
- **Cómo se explotaba:** un Excel (el del servidor o uno cargado a mano) con una celda como `<img src=x onerror="...">` ejecutaba código en el navegador de quien consultaba.
- **Arreglo aplicado:** función `esc()` en todos los campos que vienen del archivo. Los menús desplegables ya usaban `textContent`, que es seguro. No hay `eval`, no se leen parámetros de la URL y no hay otros puntos de entrada.

### S6. Faltaba política de seguridad del contenido (CSP) — **Bajo → corregido en parte**

- GitHub Pages no permite configurar cabeceras HTTP, así que la CSP se agregó como `<meta>`. Quedó `'unsafe-inline'` porque los botones usan `onclick="..."` dentro del HTML.
- **Para endurecerla más (pendiente):** pasar el JavaScript a un archivo `app.js`, cambiar los `onclick`/`onchange` por `addEventListener` y quitar `'unsafe-inline'` de `script-src`. Con eso, incluso si apareciera otro error de escape, el código inyectado no correría.
- Lo que una `<meta>` no puede hacer: impedir que otro sitio muestre tu página dentro de un marco (`frame-ancestors`). El riesgo es bajo porque la página no tiene acciones sensibles.

### S7. Datos y secretos en el código e historial — **Sin hallazgos**

- 7 commits, siempre con los mismos 4 archivos (`index.html`, `sw.js`, `manifest.json`, `reglas.xlsx`). No hay archivos borrados que pudieran esconder algo, ni claves, tokens ni API keys.
- `reglas.xlsx` tiene 4.539 reglas, todas activas. No hay columnas ni textos con RUT, correos o teléfonos. Lo único "personal" es que el archivo lo generó un script (openpyxl), no una persona con su nombre.
- **A considerar:** el Excel completo se puede descargar desde internet por cualquiera (`.../derivacion-red/reglas.xlsx`). Si las reglas de derivación de la red no son información pública, conviene confirmarlo con el Servicio. Si deben ser internas, GitHub Pages público no es el lugar adecuado.

### S8. Formularios, endpoints, GitHub Actions — **Sin hallazgos**

- No hay formularios que envíen datos, no hay servidor propio, no hay carpeta `.github/workflows` (sin Actions ni secretos). El botón "cargar archivo manualmente" lee el archivo solo en el navegador; no lo sube a ningún lado.

### S9. Riesgo de que GitHub Pages "boten" el sitio — **Bajo**

- GitHub Pages sirve el sitio a través de una red de distribución con protección contra ataques de saturación; un sitio estático así es muy difícil de botar por tráfico. Los límites son de 1 GB por sitio y unos 100 GB de transferencia al mes (el sitio pesa menos de 1 MB). GitHub solo lo bajaría por uso comercial masivo o contenido prohibido, que no es el caso.
- El riesgo de disponibilidad real es S1 (alguien con tu cuenta borra o cambia el repositorio) y S4 (cdnjs). Como respaldo, conviene tener una copia descargada del repositorio (botón "Code → Download ZIP") cada vez que actualices las reglas.

---

## Parte 2 — Mejoras

### M1. Mostrar la **prioridad** de cada regla — importante (clínico)

La columna "Prioridad" del Excel (valores 1 a 6+) **no se muestra ni se usa para ordenar**. Un mismo CESFAM puede tener varias reglas para una especialidad con distinta prioridad (2.404 reglas con prioridad 1, 1.030 con prioridad 2, etc.), y en la página todas aparecen como equivalentes. Recomiendo agregar la columna y ordenar por ella. No lo hice porque cambia cómo se presenta información clínica; conviene que lo decida quien conoce las reglas.

Tampoco se muestran "Procedimiento(s)" (543 reglas lo tienen), "Origen Centro" y "Sexo" (hoy todas dicen "Todos", pero si algún día se usa, la página lo ignoraría).

### M2. No dibujar las 4.539 reglas de una vez — rendimiento en celular

Sin filtros, la página crea casi 4.900 filas de tabla. En un computador potente tardó 1,6 segundos; en un celular de gama media puede ser mucho más y la página queda de más de un millón de píxeles de alto. Sugerencias:

- Mostrar resultados solo cuando haya al menos un filtro elegido, o
- mostrar las primeras 100 filas con un botón "ver más".

### M3. Buscador por texto (diagnóstico o código CIE-10)

La pregunta típica es "¿a dónde derivo una catarata?" y hoy hay que adivinar la especialidad. Un cuadro de búsqueda que filtre por diagnóstico (y por código, por ejemplo `H25`) sería la mejora más útil.

### M4. Filtros que se ajusten entre sí

Si eliges "Establecimiento derivador = CESFAM X", el menú de especialidades sigue mostrando las 52, aunque X solo tenga reglas en algunas. Es fácil terminar en "Sin resultados". Conviene que cada menú muestre solo las opciones que tienen reglas con los otros filtros ya elegidos.

### M5. En el celular

- Los filtros quedan debajo de "Estado del archivo" y "Resumen": hay que bajar dos pantallas para empezar a consultar. Se podría poner los filtros primero y achicar el resumen.
- Las tablas tienen un ancho mínimo de 650 px, así que en el celular hay que deslizar de lado. Una alternativa es mostrar cada regla como una tarjeta en pantallas chicas.
- Guardar los filtros en la dirección (por ejemplo `?espec=OFTALMOLOGIA&orig=...`) permitiría compartir un enlace con la consulta ya hecha.

### M6. Accesibilidad (pendientes)

- Varios textos son de 10 a 12 px; sube el mínimo a 13–14 px.
- Los íconos emoji (🏥, 📍, 🔍) los leen en voz alta los lectores de pantalla; se pueden marcar con `aria-hidden="true"`.
- Los menús quitan el contorno de foco (`outline:none`); conviene un borde de foco más visible para quien navega con teclado.

### M7. Mantenimiento de los datos

- **La página lee las columnas por posición** (columna 3 = entidad, 12 = diagnóstico, etc.). Si alguien inserta o mueve una columna en el Excel, la página mostrará datos en el lugar equivocado **sin avisar**. Recomiendo validar los títulos de la primera fila y mostrar un error claro si no coinciden.
- **"Actualizado: ..." muestra la hora en que abriste la página, no la fecha de las reglas.** Puede hacer creer que los datos son de hoy. Mejor mostrar la fecha de la última actualización del Excel (por ejemplo, una celda con la fecha de corte, o un pequeño archivo `version.json`).
- Cada actualización se sube como "Add files via upload". Escribir en el mensaje qué cambió ("Actualiza reglas oftalmología según Ord. N°...") deja un registro útil de los cambios.
- Agregar un `README.md` corto: qué es la página, de dónde salen los datos, quién la mantiene y cómo actualizarla.

### M8. Errores visibles

- `manifest.json` menciona `icon-192.png` y `icon-512.png`, que no existen en el repositorio (error 404). Al "instalar" la página en el celular no aparece ícono. Basta con subir esas dos imágenes.
- Si se cargan las reglas y aparece un aviso mientras otro todavía se muestra, el segundo puede desaparecer antes de tiempo (detalle menor del aviso flotante).

### M9. Estructura del código

Todo está en un solo `index.html` (CSS, HTML y JavaScript). Para el tamaño actual está bien. Si la página crece, separar `app.js` y `styles.css` facilita revisar cambios y permite endurecer la CSP (S6).

---

## Cómo se revisó

- Lectura completa de `index.html`, `sw.js` y `manifest.json`.
- Revisión de los 7 commits del historial, de las ramas, de los colaboradores y de la ausencia de GitHub Actions.
- Análisis de `reglas.xlsx` buscando RUT, correos, teléfonos y código HTML.
- Prueba en Chromium con pantalla de celular (375 px): carga de las reglas, filtros, exportación a Excel, un Excel trampa con código HTML, la CSP sin `'unsafe-eval'`, el service worker y el uso sin conexión. Como cdnjs está bloqueado en el entorno de prueba, se usó la copia oficial de npm de la misma versión de la librería.
