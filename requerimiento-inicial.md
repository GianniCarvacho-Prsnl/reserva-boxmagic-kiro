# PROYECTO: [BOT-RESERVA-BOXMAGIC]]

## 📋 INFORMACIÓN GENERAL

### Objetivo Principal
Automatizar el proceso de reserva de clases de CrossFit para garantizar obtener cupo en la o las clases diarias deseadas, ejecutando la reserva en el momento exacto requerido sin intervención manual.

El problema que resuelve esta automatización es que los cupos se acaban muy rapido, casi en 1 segundo, por lo tanto la reserva se debe producir en el segundo exacto, o incluso milisegundos a partir de la hora indicada que se abren los cupos.

Quisiera aclarar que esta es de momento una aplicacion personal y no profesional, no es necesario que sea tan robusta al comienzo, debe ser simple, considera que es un MVP.

### Contexto de Uso
- **¿Quién lo usará?**: [El usuario seré yo mismo, en el futuro me gustaría que fuese multiusuario, pero inicialmente seré yo solamente]
- **¿Cuándo se ejecutará?**: [Depende de los días que entreno, que es de lunes a sabado, pero debe ser programable, te aclaro que la reserva se habilita 25 horas antes del inicio de la clase]
- **¿Dónde se desplegará?**: [Mi intención es que corra en algún server de forma autónoma, tengo preferencia por vercel, pero no se si este tipo de proyectos se puede desplegar ahí, otra opción sería fly.io que ya tengo dinero cargado, pero mi prioridad es verce de ser posiblel]

---


### Integraciones Externas
- **APIs/Servicios**: [Solo navegacion web]
- **Sitios Web**: [https://members.boxmagic.app/app/horarios]
- **Notificaciones**: [webhooks, telegram, whatsapp en lo posible pero gratis, tengo intencion de conectarlo por webhook con n8n en el futuro para notificarme] -- Esperable, no critico.

### Configuraciones y Credenciales
```
# Variables de entorno requeridas
usuario login= 'gtcarvacho@gmail.com'
password='manad'

Días, Horarios, nombres de clases, hora exacta de reservas: Creo que deberían poder configurarse y poder editarse afuera del codigo.

---

## 🔄 FLUJO PRINCIPAL

### Descripción del Proceso Completo
1. **Paso 1**: [Ingresa al sitio web para comenzar con el flujo]

-Abre link de la aplicacion: https://members.boxmagic.app/app/horarios
-Imagen: requerimiento/crossfit-reservas-requerimiento.md

2. **Paso 2**: [ingresa datos de usuario]

-Ingresa Correo y Contraseña
-Presiona Botón Ingresar
-Imagen: requerimiento/Imagenes/ingresa_credenciales.png


3. **Paso 3**: [Seleccionar día de la clase]

- El día de la clase se debe seleccionar donde se marca en la imagen (requerimiento/Imagenes/seleccionar_dia.png), es decir, el día que es la clase. 
- Siempre mostrará el día de hoy y el de mañana, siempre dos días solamente.


**Acá viene la parte crítica... como comenté, la accion de presionar el boton para reservar se debe hacer en el segundo exacto, con diferencia de milisegundos. el flujo que ocurre es el siguiente que puede dificultar la accion:

El boton para reservar aparece solamente al abrir la clase que se desea, te paso una imagen donde se ven todas las clases de un día antes de ingresar a ella: ejemplo-todas-las-clases.png

Entonces lo que ocurre es que al abrir la clase, recien aparece el boton para reservar, como se ve en la imagen:requerimiento/Imagenes/boton-agendar.png

Entonces lo que debe ocurrir es que primero debe iniciar el flujo desde el cominenzo como ya vimos...pero algunos segundos antes, por ejemplo 30 segundos para que cuando llegue la hora exacta ya hayaoms hecho la navegacion, login, etc, luego a la hora exacta programada, debe abrir la clase y lo mas rapido posible presionar el boton 'Agendar'.

**

### Flujos Alternativos
- **Si [PopUp informativo despues de iniciar sesion]**: [presionar botón OK o X]
- imagen de ejemplo real : requerimiento/Imagenes/alternativo_1.png

- ** Clase no tiene cupos
Asi se vería una clase que se hayan acabdo los cupos:requerimiento/Imagenes/sin-cupos.png


## ⏰ PROGRAMACIÓN Y TIMING

### Frecuencia de Ejecución
- **Tipo**: [Bajo demanda, a lo mas podrían ser dos clases en un mismo día]
- **Horarios específicos**: [Deben ser parametricos].
- **Zona horaria**: [UTC, Santiago de chile]

### Timing Crítico
- **Acciones time-sensitive**: [Hay que considerar que la reserva se debe realizar en el segundo exacto, o incluso milisegundos a partir de la hora indicada que se abren los cupos.]
- **Ventanas de ejecución**: [Paramétrica, debería ser 1 o 2 veces al día]
- **Tolerancia**: [milisegundos]

---

## 🛡️ SEGURIDAD Y ACCESO

### Autenticación
- **Credenciales**: [solo correo y password para el login]

---

### Disponibilidad
- **Uptime requerido**: [De acuerdo a las clases que siempre reservo.. estas son entre las 18:00 y 19:00, en esta ventana requiero 100%, los otros horarios es muy poco frecuente que reserve, a excepcion del viernes que se reserva AM para el sabado]
- **Tolerancia a fallos**: [Reintentas una vez]


### Escalabilidad
- **Crecimiento esperado**: [Por ahora solo seré yo el unico usuario, en el futuro espero poder agregar mas, pero por ahora solo yo]

---

## 🚀 DEPLOYMENT Y OPERACIONES

### Ambiente de Desarrollo
- **OS**: [macOS]



### [SECCIÓN PERSONALIZADA 1]
Hay tema importante que es necesario aclarar:
 -Desde que se inicia el flujo de la web para iniciar el login y buscar la clase, toma algunos segundos, por lo tanto se debe considerar un tiempo delta para que la sesion esté lista y esperando la hora exacta definida.
 -Una vez que llegue el momento exacto, debe presionarse el boton.
 -Inicialmente no desarrollaré ninguna notificacion, solamente los logs.. pero me gustaría que quede comentado esto.. por ultimo una notificacion a un webhook. En el futuro me gustaría implementar Whatsapp, en una nueva version.

-Asi se ve una clase agendada: requerimiento/Imagenes/clase-agendada.png