# Landing pública de AMY

La landing comunica la experiencia de aprendizaje y una arquitectura conceptual. No representa la topología de despliegue.

## Comportamiento

- Inicio, Funcionalidades, Método Socrático y Arquitectura RAG desplazan la página a su sección, actualizan el fragmento de URL y permiten enlaces directos. El menú permanece disponible en móvil y marca la sección visible.
- Las tarjetas de funcionalidades cambian un ejemplo de uso; su llamada a la acción lleva al registro.
- El ejemplo socrático permite contestar, recibir retroalimentación, avanzar y reiniciar. Es una demostración local identificada como tal, sin solicitudes al backend.
- Los cinco bloques de arquitectura permiten explorar consulta, conocimiento académico, contexto RAG, tutor y aprendizaje guiado. Las flechas representan relaciones funcionales, no conexiones de red.
- La nueva animación utiliza SVG y CSS, permite pausar y respeta movimiento reducido y visibilidad. La landing ya no necesita WebGL. Las pantallas de acceso y sus dependencias 3D se cargan bajo demanda.

## Contenido público

`frontend/src/components/landing/PublicArchitecture.jsx` contiene una descripción manual y limitada a funciones generales. No debe generarse a partir de configuración, diagnósticos o inventarios del backend.

El diagrama no contiene nombres de proveedores/modelos, hosts, puertos, direcciones de red, endpoints, tablas internas, versiones, credenciales, políticas de autorización ni reglas del sistema. No realiza solicitudes a servicios internos. Esta limitación reduce la información publicada en la sección; no sustituye la autorización ni las medidas de seguridad del backend.

## Actualización local

La instancia de Nginx sirve los archivos compilados dentro de la imagen Docker. Editar `src` no actualiza ese contenedor. Para cambios posteriores:

```sh
docker compose build frontend
docker compose up -d --no-deps frontend
```

Las comprobaciones del frontend no validan credenciales reales ni el funcionamiento de los proveedores de IA.

## Verificación de esta revisión

Compilación de producción correcta. Pruebas con Brave/Playwright a 1440, 1100, 768, 390 y 320 px: enlaces y posición de las secciones, indicador de navegación, selección de funcionalidades, ejercicio socrático, selección de los cinco bloques, pausa, movimiento reducido y enlaces directos. Sin errores JavaScript ni desbordamiento horizontal. Las interacciones de la landing no emitieron solicitudes a `/api/`. Se inspeccionó la presentación en temas claro y oscuro.

El archivo JavaScript de entrada quedó en aproximadamente 208 KB (66 KB comprimido). Las dependencias de autenticación, animación 3D y chat se descargan al entrar a sus rutas; continúan existiendo fragmentos grandes en esas rutas.


## Recorridos RAG y socrático

La arquitectura cuenta con conexiones SVG que se ajustan al tamaño de los bloques, selección de etapas y un panel de explicación. Tres ejemplos locales (claves, consultas SQL y relaciones) muestran cómo cambia el contexto a lo largo de cinco etapas. El recorrido se inicia explícitamente, se puede pausar y finaliza tras la última etapa. Al ocultarse la sección o la pestaña se suspende el avance automático; con movimiento reducido se mantienen los controles manuales. Ningún ejemplo hace consultas al backend.

El método socrático conserva la elección de cada pregunta mientras se exploran los pasos, muestra retroalimentación y permite intentar otra respuesta. El progreso cuenta preguntas exploradas, no respuestas correctas. «Repetir ejemplo» restablece el ejercicio. Las transiciones de preguntas y retroalimentación respetan movimiento reducido.

La revisión de los recorridos se validó también sobre `http://localhost` después de reconstruir el frontend: reproducción, pausa y finalización, ejemplos, controles manuales con movimiento reducido, persistencia de elecciones, reintento y reinicio socrático. Sin errores JavaScript ni llamadas a la API en estas interacciones.

## Visibilidad de las animaciones en tema claro

Los colores de los SVG del hero y del fondo ahora se definen mediante variables CSS por tema. En claro se usan azules y violetas más oscuros, trazos de señal más definidos y partículas con mayor opacidad mínima. Se redujo la capa blanca que ocultaba las líneas del fondo. RAG utiliza el mismo criterio de contraste para sus conexiones y señales; la barra de progreso socrática también ajusta sus colores.

No se cambia el ciclo ni se reconstruyen las animaciones al alternar el tema. Prueba con Brave: continuidad del mismo objeto de animación durante el cambio, avance de los trazos en ambos temas, conservación de la pausa, movimiento reducido y tamaños de 1440, 390 y 320 px.
