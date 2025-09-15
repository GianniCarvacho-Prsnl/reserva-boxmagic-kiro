

Para aclarar como debe ser el flujo, creo que ya está así:


Esto es en general.

1.- Abre el sitio web
2.- Ingresa login usuario/password
3.- Selecciona día a reseervar
4.- ESPERA A LA HORA QUE DEBE HACER LA RESERVA.
5.- Abre la clase a reservar
6.- Presiona el botón agendar.


Lo que yo entiendo que funciona:

En el archivo config.json están las clases que yo quiero programar para que haga la reserba diariamente.

 La estructura de cada clase es así: 
        {
        "id": "crossfit-lunes-18",
        "dayToSelect": "tomorrow",
        "className": "08:00 CrossFit",
        "reservationHour": "22:00",
        "reservationDay": "sunday",
        "bufferSeconds": 30,
        "enabled": true,
        "cronExpression": "0 18 * * 0",
        "description": "CrossFit Lunes 18:00 (reserva TODOS los domingos 18:00)"
        },

De forma local en modo dev 'npm run dev' hicimos una prueba exitosa reservando la clase "className": "08:00 CrossFit" y lo reservó perfecto. Lo que yo entiendo es que en modo desarrollo, lo que importa para la reserva es la el nombre de la clase que debe buscar, y la hora de la reserva que es  "reservationHour": "22:00".

Lo que NO está bien.

Cuando te pregunté como funcionará en vercel.. empezarste a decirme que el archivo era 'vercel.json' pero ahi solo veo rutas harcodeadas con id harcodeados:

  "crons": [
    {
      "path": "/api/reserve?scheduleId=metcon-viernes-18",
      "schedule": "0 17 * * 4"
    },


EL PROBLEMA QUE TENGO ES QUE NO ENTIENDO COMO FUNCIONA LA APLICACION O COMO FUNCIONARÁ CUANDO DESPLIEGUE EN VERCEL.
NO ENTIENDO COMO CONFIGURAR LAS CLASES QUE YO DESEO, EN LAS HORAS EXACTAS QUE NECESITO.

EN DEV LO ENTIENDO PORQUE YA HICIMOS UNA RESERVA QUE SALIÓ BIEN.. PERO NO ENTIENDO LO DE VERCEL.

** PUEDES ANALIZAR EN PRODUNDIDAD,"ultrathink" y explicarme como funciona el sistema de reserva en Vercel?.
** DEBO CONFIGURAR CADA ID EN VERCEL.JSON Y TAMBIEN EN CONFIG.JSON??..Si debo hacerlo está bien pero quiero entender como es.
