# Catálogo de datos de Dragons Den

Aquí vive **lo que es igual para todos**: los retos, los niveles, las preguntas
del trivial y los planes. Se versiona en git y se despliega con la web.

**Lo que cambia por usuario no está aquí**: envíos, XP, duelos, suscripciones y
consentimientos viven en Postgres (`sql/002-gamificacion-suscripciones.sql`).
La regla es simple: si perderlo sería un problema para una persona concreta, va
a la base de datos; si perderlo solo obliga a reescribirlo, va a un JSON.

| Archivo | Qué contiene | ¿Se sirve al navegador? |
|---|---|---|
| `data/quests.json` | Retos semanales con criterios de validación | Sí, entero |
| `data/niveles.json` | Escalera de XP, nombres de nivel y recompensas | Sí, entero |
| `data/planes.json` | Precios y límites de Rookie / PRO / Élite / B2B | Sí, entero |
| `api/_lib/iq-clash.solucionario.json` | Preguntas **con las respuestas** | **No. Nunca.** |

## Por qué el solucionario no está en esta carpeta

Lleva `correcta` y `explicacion`. Esta web se sirve estática desde la raíz: todo
lo que esté en `data/` es descargable escribiendo la ruta en el navegador. Si el
solucionario estuviera aquí, cualquier chaval abre las herramientas de
desarrollador y ve las respuestas, y el ranking se vuelve decorativo el mismo
día.

Por eso vive en **`api/_lib/`**. Vercel no sirve el contenido de `api/` como
archivos estáticos, y el guion bajo delante de `_lib` hace que tampoco lo trate
como un endpoint. Solo lo alcanza el código del servidor, que es justo lo que
queremos. **No lo muevas de vuelta a `data/`.**

Lo que tiene que hacer la plataforma:

1. El endpoint de preguntas devuelve `id`, `tema`, `escenario` y `opciones`.
   Nada más.
2. El cronómetro de 10 segundos se mide en el servidor, desde que se sirve la
   pregunta. El cliente puede mentir sobre cuánto ha tardado.
3. La corrección se hace en el servidor. `explicacion` se devuelve **después**
   de responder, que es cuando enseña algo.

Comprobación rápida después de cada despliegue: abre
`https://<dominio>/api/_lib/iq-clash.solucionario.json` en una ventana privada.
Tiene que dar 404. Si devuelve el JSON, para el trivial hasta arreglarlo.

## Cómo se aprueba un reto

Cada reto tiene `criterios`, y cada criterio tiene `peso` (los pesos de un reto
suman 100) y `obligatorio`.

- **Algún obligatorio sin cumplir** → `a_corregir`. No se concede XP todavía y
  el jugador puede reenviar una vez dentro del plazo.
- **Todos los obligatorios cumplidos** → se concede
  `xp_base × (suma de pesos cumplidos / 100)`, redondeado hacia abajo.
  Estado `aprobado` si suma 100, `parcial` si no.
- **Fuera de plazo** → la mitad, y se rompe la racha.

Esto existe para que corregir un ticket sea marcar casillas y no redactar. Un
criterio que no se pueda responder con sí o no viendo el clip está mal escrito:
reescríbelo antes de publicar el reto.

## Añadir un reto

1. Copia el bloque de un reto existente y cambia `id` (formato
   `q-AAAA-wSS-nombre-corto`), `semana`, `abre` y `cierra`.
2. Comprueba que los `peso` de los criterios suman 100.
3. Enlaza `leccion` con el vídeo de la videoteca que lo explica. Esto no es
   decorativo: es lo que hace que el reto empuje a consumir la videoteca, que es
   justo por lo que el Rookie está pagando.
4. `planes` decide quién lo ve. Un reto de carga alta no debería estar
   disponible para alguien a quien no puedes corregir.
5. Sube `version` en la cabecera del archivo. Los envíos guardan
   `catalogo_version` para poder explicarse con los criterios que se les
   aplicaron, aunque el reto se reescriba después.

## Vídeo de menores

Todo reto con `requiere_clip: true` está tratando la imagen de un menor en la
mayoría de los casos. Antes de aceptar la subida, la plataforma llama a
`puede_subir_video(user_id)`. Sin consentimiento del tutor para los menores de
14, no se acepta el archivo: no se sube y se avisa. Es más barato bloquearlo en
el formulario que retirarlo después.
