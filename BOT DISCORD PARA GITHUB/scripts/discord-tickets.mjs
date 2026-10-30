import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,EmbedBuilder,Events,MessageFlags,ModalBuilder,PermissionFlagsBits as P,TextInputBuilder,TextInputStyle} from 'discord.js';
export const ticketTypes={
 donacion:{name:'Donaciones / VIP',emoji:'💎',roles:['Owner','Superadmin'],prompt:'Indica tu consulta sobre donación o VIP. No envíes datos bancarios, tarjetas, contraseñas ni tokens.'},
 reporte:{name:'Reportar jugador',emoji:'🚨',roles:['Owner','Superadmin','Admin','Moderador'],prompt:'Indica qué ocurrió, jugador implicado, fecha aproximada y pruebas. Puedes adjuntar capturas después.'},
 ayuda:{name:'Ayuda técnica',emoji:'🛠️',roles:['Owner','Superadmin','Admin','Moderador'],prompt:'Explica el problema, dónde ocurre y el mensaje de error. No compartas contraseñas ni tokens.'},
 apelacion:{name:'Apelar sanción',emoji:'⚖️',roles:['Owner','Superadmin','Admin'],prompt:'Indica la sanción, fecha y por qué solicitas su revisión.'},
 consulta:{name:'Otras consultas',emoji:'💬',roles:['Owner','Superadmin','Admin','Moderador'],prompt:'Cuéntanos qué necesitas. Una persona del equipo te atenderá cuando esté disponible.'},
};
const baseName=name=>name.split('・').at(-1);
const footer={text:'Isla Jurásica ESP · Atención privada'};
export async function installTickets(client,guildId,state,persist){
 const guild=await client.guilds.fetch(guildId);await guild.channels.fetch();await guild.roles.fetch();
 const roleId=name=>guild.roles.cache.find(r=>r.name===name)?.id;
 const permissions=type=>[
  {id:guildId,deny:[P.ViewChannel]},
  {id:client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.EmbedLinks,P.AttachFiles,P.ManageChannels]},
  ...ticketTypes[type].roles.map(name=>{const id=roleId(name);if(!id)throw Error('Falta el rango '+name);return {id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]};}),
 ];
 let category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name==='🎫・TICKETS PRIVADOS');
 if(!category)category=await guild.channels.create({name:'🎫・TICKETS PRIVADOS',type:ChannelType.GuildCategory,permissionOverwrites:[{id:guildId,deny:[P.ViewChannel]},{id:client.user.id,allow:[P.ViewChannel,P.ManageChannels]}],reason:'Atención privada de Isla Jurásica ESP'});
 const community=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&baseName(c.name)==='COMUNIDAD');if(!community)throw Error('Falta la categoría Comunidad.');
 let panel=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&baseName(c.name)==='abrir-ticket'&&c.parentId===community.id);
 if(!panel)panel=await guild.channels.create({name:'🎫・abrir-ticket',type:ChannelType.GuildText,parent:community.id,permissionOverwrites:[{id:guildId,allow:[P.ViewChannel,P.ReadMessageHistory],deny:[P.SendMessages,P.CreatePublicThreads,P.CreatePrivateThreads,P.SendMessagesInThreads]},{id:client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.EmbedLinks]}],reason:'Panel público de tickets'});
 state.tickets??={};
 const controls=new ActionRowBuilder().addComponents(Object.entries(ticketTypes).map(([type,t])=>new ButtonBuilder().setCustomId('ticket:open:'+type).setLabel(t.name).setEmoji(t.emoji).setStyle(type==='reporte'?ButtonStyle.Danger:ButtonStyle.Secondary)));
 const payload={embeds:[new EmbedBuilder().setColor(0xd9512d).setTitle('🎫 ¿En qué podemos ayudarte?').setDescription('Elige un motivo para abrir un **ticket privado** con el equipo.\n\n💎 **Donaciones / VIP:** solo Owner y Superadmin.\n🚨 **Reportes:** comunica incidencias con pruebas.\n🛠️ **Ayuda:** problemas técnicos y dudas.\n⚖️ **Apelaciones:** solicita revisar una sanción.\n💬 **Otras consultas:** lo que necesites.\n\nNo publiques datos bancarios, contraseñas ni tokens. No se realizan cobros ni se conceden recompensas automáticamente. El equipo responderá cuando esté disponible.').setFooter(footer)],components:[controls],allowedMentions:{parse:[]}};
 let message;if(state.ticketPanel){try{message=await panel.messages.fetch(state.ticketPanel);}catch(e){if(e.code!==10008)throw e;}}
 if(message)await message.edit(payload);else{message=await panel.send(payload);state.ticketPanel=message.id;persist();}
 const inFlight=new Set();const cooldown=new Map();
 const buttons=closed=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(closed?'ticket:reopen':'ticket:close').setLabel(closed?'Reabrir (equipo)':'Cerrar ticket').setEmoji(closed?'🔓':'🔒').setStyle(closed?ButtonStyle.Secondary:ButtonStyle.Danger));
 async function authorized(interaction,record,allowOwner){
  if(allowOwner&&interaction.user.id===record.ownerId)return true;
  const member=await guild.members.fetch({user:interaction.user.id,force:true});
  return guild.ownerId===member.id||member.permissions.has(P.Administrator)||ticketTypes[record.type].roles.some(name=>{const id=roleId(name);return id&&member.roles.cache.has(id);});
 }
 const handler=async interaction=>{
  if(interaction.guildId!==guildId||(!interaction.isButton()&&!interaction.isModalSubmit())||!interaction.customId.startsWith('ticket:'))return;
  try{
   if(interaction.isButton()&&interaction.customId.startsWith('ticket:open:')){
    const type=interaction.customId.split(':')[2];if(!ticketTypes[type])return;
    const modal=new ModalBuilder().setCustomId('ticket:submit:'+type).setTitle(ticketTypes[type].name);
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Explica tu consulta (sin datos sensibles)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1800)));
    await interaction.showModal(modal);return;
   }
   await interaction.deferReply({flags:MessageFlags.Ephemeral});
   if(interaction.isModalSubmit()&&interaction.customId.startsWith('ticket:submit:')){
    const type=interaction.customId.split(':')[2];if(!ticketTypes[type])return;
    const key=interaction.user.id;
    if(inFlight.has(key)){await interaction.editReply('Ya se está creando tu ticket.');return;}
    inFlight.add(key);
    try{
     const existing=Object.entries(state.tickets).find(([id,t])=>t.ownerId===key&&t.type===type&&t.status==='open'&&guild.channels.cache.has(id));
     if(existing){await interaction.editReply('Ya tienes este ticket abierto: <#'+existing[0]+'>');return;}
     if(Date.now()-(cooldown.get(key)??0)<30000){await interaction.editReply('Espera 30 segundos entre tickets.');return;}
     if(Object.values(state.tickets).filter(t=>t.ownerId===key&&t.status==='open').length>=3){await interaction.editReply('Tienes 3 tickets abiertos. Resuelve alguno antes de abrir otro.');return;}
     const description=interaction.fields.getTextInputValue('description').trim();if(description.length<10)throw Error('Descripción incompleta');
     cooldown.set(key,Date.now());
     const channel=await guild.channels.create({name:'ticket-'+type+'-'+key.slice(-6),type:ChannelType.GuildText,parent:category.id,permissionOverwrites:[...permissions(type),{id:key,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles],deny:[P.CreatePublicThreads,P.CreatePrivateThreads]}],reason:'Ticket solicitado por un miembro'});
     const record={ownerId:key,type,status:'open',createdAt:new Date().toISOString()};state.tickets[channel.id]=record;persist();
     const intro=await channel.send({content:'<@'+key+'>',embeds:[new EmbedBuilder().setTitle(ticketTypes[type].emoji+' '+ticketTypes[type].name).setDescription(description).addFields({name:'Siguiente paso',value:ticketTypes[type].prompt},{name:'Privacidad',value:'Este canal es privado para ti y el equipo autorizado. Puedes cerrar el ticket sin borrar su historial.'}).setColor(0xd9512d).setFooter(footer)],components:[buttons(false)],allowedMentions:{parse:[],users:[key]}});
     record.messageId=intro.id;persist();await interaction.editReply('Tu ticket está listo: <#'+channel.id+'>');
    }finally{inFlight.delete(key);}
    return;
   }
   const record=state.tickets[interaction.channelId];if(!record||!ticketTypes[record.type]){await interaction.editReply('Este canal no es un ticket gestionado por el bot.');return;}
   const close=interaction.customId==='ticket:close';if(!close&&interaction.customId!=='ticket:reopen')return;
   if(!await authorized(interaction,record,close)){await interaction.editReply('No tienes permiso para esta acción.');return;}
   const lock='channel:'+interaction.channelId;if(inFlight.has(lock)){await interaction.editReply('Este ticket ya está cambiando de estado.');return;}
   inFlight.add(lock);
   try{
    const channel=await guild.channels.fetch(interaction.channelId);await channel.permissionOverwrites.edit(record.ownerId,{SendMessages:!close,AttachFiles:!close});
    record.status=close?'closed':'open';record.updatedAt=new Date().toISOString();record.updatedBy=interaction.user.id;persist();
    if(record.messageId){try{const intro=await channel.messages.fetch(record.messageId);await intro.edit({components:[buttons(close)]});}catch(e){if(e.code!==10008)throw e;}}
    await interaction.editReply(close?'Ticket cerrado. El historial se conserva y el equipo puede reabrirlo.':'Ticket reabierto.');
   }finally{inFlight.delete(lock);}
  }catch(e){console.error('Tickets: '+(e.code??e.name));const message='No se pudo completar. Reintenta; si ya se creó el canal, el bot te lo indicará.';try{if(interaction.deferred||interaction.replied)await interaction.editReply(message);else await interaction.reply({content:message,flags:MessageFlags.Ephemeral});}catch{}}
 };
 client.on(Events.InteractionCreate,handler);
 console.log('Tickets activos: Donaciones, reportes, ayuda, apelaciones y consultas.');
 return {panel,category,handler};
}
