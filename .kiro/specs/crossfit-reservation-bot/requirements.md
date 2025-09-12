# Documento de Requerimientos

## Introducción

El Bot de Reservas de CrossFit es un sistema automatizado diseñado para reservar clases de CrossFit en BoxMagic exactamente cuando los cupos se vuelven disponibles. El sistema aborda el desafío crítico de timing donde los cupos de las clases se llenan en segundos (o milisegundos) después de estar disponibles, requiriendo una ejecución automatizada precisa 25 horas antes de que comience cada clase. Esta es inicialmente una solución MVP personal para un solo usuario, con potencial para expansión multiusuario en el futuro.

## Requerimientos

### Requerimiento 1

**Historia de Usuario:** Como entusiasta del CrossFit, quiero un sistema automatizado que reserve mis clases deseadas en el momento exacto que se abren los cupos, para poder asegurar mi lugar sin intervención manual y evitar perder el cupo debido al proceso de reserva extremadamente rápido.

#### Criterios de Aceptación

1. CUANDO llegue la hora programada de reserva ENTONCES el sistema DEBERÁ ejecutar el proceso de reserva dentro de milisegundos del tiempo objetivo
2. CUANDO haya cupos disponibles para la clase objetivo ENTONCES el sistema DEBERÁ completar exitosamente la reserva y confirmar la reserva
3. CUANDO inicie el proceso de reserva ENTONCES el sistema DEBERÁ completar el login, navegación y selección de clase dentro de 30 segundos antes del tiempo objetivo de reserva
4. SI la reserva falla en el primer intento ENTONCES el sistema DEBERÁ reintentar una vez inmediatamente

### Requerimiento 2

**Historia de Usuario:** Como usuario, quiero configurar mis credenciales de login, clases objetivo y horarios de reserva fuera del código, para poder modificar fácilmente mis preferencias sin tocar la lógica de la aplicación.

#### Criterios de Aceptación

1. CUANDO configure el sistema ENTONCES el sistema DEBERÁ aceptar credenciales de email y contraseña desde variables de entorno
2. CUANDO configure reservas ENTONCES el sistema DEBERÁ permitir configuración de días, horarios, nombres de clases y tiempos exactos de reserva a través de configuración externa
3. CUANDO actualice preferencias ENTONCES el sistema DEBERÁ leer cambios de configuración sin requerir modificaciones de código
4. SI la configuración falta o es inválida ENTONCES el sistema DEBERÁ proporcionar mensajes de error claros y fallar de manera elegante

### Requerimiento 3

**Historia de Usuario:** Como usuario, quiero que el sistema maneje automáticamente todo el flujo de navegación web, para que el proceso de reserva se ejecute sin ninguna intervención manual.

#### Criterios de Aceptación

1. CUANDO inicie el proceso de reserva ENTONCES el sistema DEBERÁ navegar a https://members.boxmagic.app/app/horarios
2. CUANDO cargue la página de login ENTONCES el sistema DEBERÁ ingresar credenciales y enviar el formulario de login
3. CUANDO el login sea exitoso ENTONCES el sistema DEBERÁ manejar cualquier popup informativo haciendo clic en OK o X
4. CUANDO seleccione el día de la clase ENTONCES el sistema DEBERÁ elegir el día correcto (hoy o mañana) según la configuración
5. CUANDO llegue el tiempo objetivo ENTONCES el sistema DEBERÁ abrir la clase específica y hacer clic en el botón "Agendar" inmediatamente
6. SI no hay cupos disponibles ENTONCES el sistema DEBERÁ detectar el estado "sin cupos" y registrar el fallo

### Requerimiento 4

**Historia de Usuario:** Como usuario, quiero que el sistema funcione de manera autónoma en una plataforma de servidor, para no tener que activar manualmente las reservas o mantener mi máquina local funcionando.

#### Criterios de Aceptación

1. CUANDO despliegue el sistema ENTONCES el sistema DEBERÁ ser compatible con plataformas de hosting Vercel o Fly.io
2. CUANDO esté programado para ejecutarse ENTONCES el sistema DEBERÁ ejecutarse automáticamente en los horarios configurados
3. CUANDO esté funcionando ENTONCES el sistema DEBERÁ operar en zona horaria de Santiago de Chile (UTC-3/UTC-4)
4. SI la plataforma de despliegue no soporta los requerimientos ENTONCES el sistema DEBERÁ proporcionar opciones alternativas de despliegue

### Requerimiento 5

**Historia de Usuario:** Como usuario, quiero capacidades básicas de logging y notificaciones webhook futuras, para poder monitorear el rendimiento del sistema y recibir actualizaciones sobre el estado de las reservas.

#### Criterios de Aceptación

1. CUANDO el sistema se ejecute ENTONCES el sistema DEBERÁ registrar todos los pasos principales y resultados
2. CUANDO una reserva tenga éxito o falle ENTONCES el sistema DEBERÁ registrar el resultado con timestamp y detalles
3. CUANDO se proporcione configuración de webhook ENTONCES el sistema DEBERÁ enviar notificaciones al endpoint configurado
4. SI el logging falla ENTONCES el sistema DEBERÁ continuar la operación sin interrumpir el proceso de reserva

### Requerimiento 6

**Historia de Usuario:** Como usuario, quiero que el sistema maneje los requerimientos de precisión de timing, para que las reservas se hagan en el momento exacto que los cupos se vuelven disponibles.

#### Criterios de Aceptación

1. CUANDO calcule el tiempo de ejecución ENTONCES el sistema DEBERÁ considerar los retrasos de navegación y login (aproximadamente 30 segundos de buffer)
2. CUANDO se acerque el tiempo objetivo de reserva ENTONCES el sistema DEBERÁ estar listo y esperando en la pantalla de selección de clase
3. CUANDO llegue el tiempo exacto de reserva ENTONCES el sistema DEBERÁ ejecutar el clic del botón "Agendar" dentro de milisegundos
4. SI la sincronización de timing falla ENTONCES el sistema DEBERÁ registrar la desviación de timing e intentar la reserva de todos modos

### Requerimiento 7

**Historia de Usuario:** Como usuario, quiero que el sistema maneje diferentes patrones de programación, para poder reservar clases para mi horario regular de entrenamiento (lunes a sábado con horarios variables).

#### Criterios de Aceptación

1. CUANDO configure horarios ENTONCES el sistema DEBERÁ soportar múltiples horarios de reserva por día (hasta 2 clases)
2. CUANDO configure patrones semanales ENTONCES el sistema DEBERÁ manejar programación de lunes a sábado
3. CUANDO se necesiten reservas ENTONCES el sistema DEBERÁ ejecutarse durante la ventana crítica de 18:00-19:00 con requerimiento de 100% uptime
4. SI se programan múltiples reservas ENTONCES el sistema DEBERÁ manejar cada una independientemente sin conflictos