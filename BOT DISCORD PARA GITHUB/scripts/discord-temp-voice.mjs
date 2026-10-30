import {ChannelType,Events,PermissionFlagsBits as P} from 'discord.js';
export async function installTemporaryVoice(client,guildId,state,persist){
 const guild=await client.guilds.fetch(guildId);await guild.channels.fetch();
 const category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name.split('・').at(-1)==='VOZ DE LA ISLA');
 if(!category)throw Error('Falta la categoría VOZ DE LA ISLA.');
 let hub=guild.channels.cache.find(c=>c.parentId===category.id&&c.type===ChannelType.GuildVoice&&c.name==='➕・Crear tu grupo');
 if(!hub)hub=await guild.channels.create({name:'➕・Crear tu grupo',type:ChannelType.GuildVoice,parent:category.id,permissionOverwrites:[{id:guildId,allow:[P.ViewChannel,P.Connect,P.Speak]}],reason:'Grupos de voz temporales para todos'});
 state.voiceRooms??={};persist();
 const inFlight=new Set();const lastCreated=new Map();
 async function clean(id){
  if(!state.voiceRooms[id])return;
  const channel=guild.channels.cache.get(id);
  if(!channel){delete state.voiceRooms[id];persist();return;}
  if(channel.parentId!==category.id||channel.type!==ChannelType.GuildVoice)return;
  if(channel.members.size===0){await channel.delete('Grupo temporal vacío');delete state.voiceRooms[id];persist();}
 }
 for(const id of Object.keys(state.voiceRooms))await clean(id);
 const handler=async(oldState,newState)=>{
  if(newState.guild.id!==guildId||oldState.channelId===newState.channelId)return;
  try{
   if(oldState.channelId)await clean(oldState.channelId);
   if(newState.channelId!==hub.id||!newState.member||newState.member.user.bot||inFlight.has(newState.id))return;
   inFlight.add(newState.id);
   try{
    const existingId=Object.keys(state.voiceRooms).find(id=>state.voiceRooms[id].ownerId===newState.id&&guild.channels.cache.has(id));
    if(existingId){if(newState.member.voice.channelId===hub.id)await newState.member.voice.setChannel(existingId);return;}
    if(Object.keys(state.voiceRooms).length>=20||Date.now()-(lastCreated.get(newState.id)??0)<30000){await newState.member.voice.disconnect('Espera unos segundos para crear otro grupo');return;}
    lastCreated.set(newState.id,Date.now());
    const displayName=newState.member.displayName.replace(/[\r\n@]/g,'').slice(0,55)||'Superviviente';
    const room=await guild.channels.create({name:'🦕・Grupo de '+displayName,type:ChannelType.GuildVoice,parent:category.id,permissionOverwrites:[{id:guildId,allow:[P.ViewChannel,P.Connect,P.Speak]},{id:newState.id,allow:[P.ViewChannel,P.Connect,P.Speak,P.ManageChannels,P.MuteMembers,P.DeafenMembers,P.MoveMembers]}],reason:'Grupo temporal solicitado al entrar en Crear tu grupo'});
    state.voiceRooms[room.id]={ownerId:newState.id};persist();
    try{if(newState.member.voice.channelId===hub.id)await newState.member.voice.setChannel(room);else await clean(room.id);}catch(e){await clean(room.id);throw e;}
   }finally{inFlight.delete(newState.id);}
  }catch(e){console.error('Grupo de voz: '+(e.code??e.name));}
 };
 client.on(Events.VoiceStateUpdate,handler);
 console.log('Grupos de voz automáticos activos: entra en Crear tu grupo.');
 return {hub,handler};
}
