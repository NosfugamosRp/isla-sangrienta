# Isla Jurásica ESP · Bot de Discord

Bot de bienvenidas, grupos de voz temporales y tickets privados.

## Render

Este repositorio despliega SOLO el bot. La web permanece en Netlify.
Usa el Blueprint render.yaml. Crea un worker de pago con disco persistente de 1 GB.
Revisa el coste antes de confirmar en Render.

Variables privadas en Render:
- DISCORD_SETUP_BOT_TOKEN: token del bot. Nunca publicarlo en GitHub.
- DISCORD_SETUP_GUILD_ID: ID del servidor.
- DISCORD_DATA_DIR: /data/discord (ya definido en el Blueprint).
- DISCORD_BOOTSTRAP_STATE: copia inicial privada del estado, codificada en base64.

Para migrar, detén el bot local antes de copiar su estado y arrancar Render.
No ejecutes ambas instancias a la vez.
El estado actual no se incluye en este repositorio por privacidad.
Solo se importa DISCORD_BOOTSTRAP_STATE cuando el disco no tiene messages.json.

Activa Server Members Intent en Discord Developer Portal.
Los rangos de Discord no se sincronizan con la web automáticamente.
No se cobran donaciones ni se entregan monedas o VIP automáticamente.
