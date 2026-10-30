import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installTemporaryVoice} from './discord-temp-voice.mjs';
import {installTickets} from './discord-tickets.mjs';
import {Client,Events,GatewayIntentBits,REST,Routes,EmbedBuilder} from 'discord.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const localEnv=path.join(root,'.env.discord-setup');
if(fs.existsSync(localEnv))process.loadEnvFile(localEnv);
const token=process.env.DISCORD_SETUP_BOT_TOKEN?.trim();const guildId=process.env.DISCORD_SETUP_GUILD_ID?.trim();
if(!token||!/^\d{17,22}$/.test(guildId??''))throw Error('Completa el archivo privado .env.discord-setup.');
const rest=new REST({version:'10'}).setToken(token);
if(process.env.RENDER&&!process.env.DISCORD_DATA_DIR)throw Error('Configura DISCORD_DATA_DIR en el disco persistente de Render.');
const directory=path.resolve(process.env.DISCORD_DATA_DIR??path.join(root,'.discord-bot'));fs.mkdirSync(directory,{recursive:true});
const stateFile=path.join(directory,'messages.json');
if(!fs.existsSync(stateFile)&&process.env.DISCORD_BOOTSTRAP_STATE){
 const initial=JSON.parse(Buffer.from(process.env.DISCORD_BOOTSTRAP_STATE,'base64').toString('utf8'));
 if(!initial||Array.isArray(initial)||typeof initial!=='object')throw Error('Estado inicial del bot no válido.');
 fs.writeFileSync(stateFile,JSON.stringify(initial),{flag:'wx',mode:0o600});
}
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
function persist(){const temp=stateFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2));fs.renameSync(temp,stateFile);}
const baseName=name=>name.split('・').at(-1);
const footer={text:'Isla Jurásica ESP · Sobrevive, evoluciona y domina la isla'};
async function channels(){return rest.get(Routes.guildChannels(guildId));}
const channelLink=(list,name)=>{const channel=list.find(c=>baseName(c.name)===name&&c.type===0);return channel?'<#'+channel.id+'>':'el canal '+name;};
function welcomeEmbed(list,user){return new EmbedBuilder().setColor(0xe84a2d).setTitle('🦖 ¡Una nueva huella en la isla!').setDescription(`¡Bienvenido/a <@${user.id}> a **Isla Jurásica ESP**!\nLa aventura comienza contigo. Encuentra tu manada y disfruta de la comunidad de The Isle: Evrima.`).addFields({name:'📜 Empieza aquí',value:`Lee ${channelLink(list,'normas')} y consulta ${channelLink(list,'guia-del-servidor')}.`},{name:'🌴 Conoce a la comunidad',value:`Preséntate en ${channelLink(list,'presentaciones')} y busca compañeros en ${channelLink(list,'buscar-grupo')}.`},{name:'🆘 ¿Necesitas ayuda?',value:`Escríbenos en ${channelLink(list,'ayuda')}. Nunca compartas contraseñas ni tokens.`}).setThumbnail(user.displayAvatarURL?.({size:256})??`https://cdn.discordapp.com/embed/avatars/0.png`).setFooter(footer).setTimestamp();}
async function publish(){
 const list=await channels();
 const posts=[
 ['bienvenida','🦖 Bienvenido a Isla Jurásica ESP','Tu próxima historia comienza aquí.\n\nSomos una comunidad de **The Isle: Evrima**: dinosaurios, supervivencia y aventuras en equipo.\n\n📜 Lee '+channelLink(list,'normas')+'\n🙋 Preséntate en '+channelLink(list,'presentaciones')+'\n🦕 Encuentra compañeros en '+channelLink(list,'buscar-grupo')+'\n🆘 Pide ayuda en '+channelLink(list,'ayuda')+'\n\n**Sobrevive, evoluciona y domina la isla.**',0xe84a2d],
 ['normas','📜 Normas de la comunidad','**1. Respeto.** Sin insultos, acoso, amenazas ni discriminación.\n**2. Juego limpio.** Sin trampas, exploits ni promoción de herramientas prohibidas.\n**3. Sin spam.** Evita flood, publicidad no autorizada y menciones masivas.\n**4. Protege la privacidad.** No publiques datos privados, contraseñas ni tokens.\n**5. Cada tema en su canal.** Usa ayuda para dudas y sugerencias para propuestas.\n**6. Incidencias.** Comunica los problemas al equipo con contexto y pruebas, sin acoso público.\n**7. Normas de juego.** Las reglas específicas y el acceso al servidor se anunciarán cuando estén preparados.\n\nEl equipo revisará las incidencias según su gravedad. Tener VIP no exime de estas normas.',0xd6aa59],
 ['anuncios','📢 ¡Isla Jurásica ESP abre su comunidad!','Ya tenemos espacios para compartir aventuras, buscar grupo, publicar capturas y resolver dudas.\n\n🦖 **The Isle: Evrima** nos reúne.\n🌴 Conoce a los demás en '+channelLink(list,'general')+'.\n📸 Comparte tus momentos en '+channelLink(list,'capturas-y-clips')+'.\n💡 Ayúdanos a mejorar en '+channelLink(list,'sugerencias')+'.\n\n**El servidor de juego todavía no está conectado.** Publicaremos aquí los avances y los detalles de acceso cuando estén disponibles.\n\n¡Gracias por formar parte del comienzo!',0xe84a2d],
 ['guia-del-servidor','📖 Tu primera visita a la isla','**Estado del juego:** pendiente de conectar el servidor de Evrima. No hay dirección de entrada anunciada todavía.\n\n**Para empezar:** lee las normas, preséntate y encuentra compañeros de tu especie.\n\n**Rangos VIP:** VIP, Super VIP y Mega VIP son rangos de comunidad; no conceden permisos administrativos.\n\n**Web y Discord:** las cuentas y rangos no se sincronizan automáticamente todavía.\n\n**Seguridad:** el equipo nunca te pedirá tu contraseña de Steam o Discord. Consulta cualquier duda en '+channelLink(list,'ayuda')+'.',0x88b486],
 ];
 for(const [name,title,description,color]of posts){
  const channel=list.find(c=>c.type===0&&baseName(c.name)===name);if(!channel)throw Error('Falta el canal '+name);
  const embed=new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setFooter(footer);
  const key=guildId+':'+name;const payload={embeds:[embed.toJSON()],allowed_mentions:{parse:[]}};
  let message;
  if(state[key]){try{message=await rest.patch(Routes.channelMessage(channel.id,state[key]),{body:payload});}catch(e){if(e.status!==404)throw e;}}
  if(!message)message=await rest.post(Routes.channelMessages(channel.id),{body:payload});
  state[key]=message.id;persist();console.log('Publicado: '+name);
 }
}
async function check(){const application=await rest.get(Routes.oauth2CurrentApplication());const enabled=(BigInt(application.flags??0)&((1n<<14n)|(1n<<15n)))!==0n;console.log(enabled?'SERVER MEMBERS INTENT: activado.':'SERVER MEMBERS INTENT: pendiente. Abre Developer Portal > Bot > Privileged Gateway Intents > Server Members Intent y guarda.');return enabled;}
async function run(){
 if(process.argv.includes('--publish')){await publish();return;}
 if(process.argv.includes('--check')){await check();return;}
 if(!await check()){process.exitCode=1;return;}
 // Exclusive local lock prevents duplicate welcome workers.
 const lockFile=path.join(directory,'worker.lock');
 const localLock=!process.env.RENDER;
 if(localLock&&fs.existsSync(lockFile)){const pid=Number(fs.readFileSync(lockFile,'utf8'));let alive=false;try{process.kill(pid,0);alive=true;}catch{}if(alive)throw Error('El bot de bienvenida ya está ejecutándose.');fs.unlinkSync(lockFile);}
 if(localLock)fs.writeFileSync(lockFile,String(process.pid),{flag:'wx'});
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates]});
 function stop(){client.destroy();try{if(localLock&&fs.readFileSync(lockFile,'utf8')===String(process.pid))fs.unlinkSync(lockFile);}catch{}}
 process.once('exit',stop);process.once('SIGINT',()=>{stop();process.exit(0);});process.once('SIGTERM',()=>{stop();process.exit(0);});
 client.once(Events.ClientReady,()=>console.log('Bienvenidas automáticas activas en Isla Jurásica ESP. Mantén este proceso funcionando.'));
 client.on(Events.Error,e=>console.error('Error del bot: '+(e.code??e.name)));
 client.once(Events.ClientReady,()=>{installTickets(client,guildId,state,persist).catch(e=>console.error('No se pudieron activar tickets: '+(e.code??e.message)));});
 client.once(Events.ClientReady,()=>{installTemporaryVoice(client,guildId,state,persist).catch(e=>console.error('No se pudo activar grupos de voz: '+(e.code??e.message)));});
 client.on(Events.GuildMemberAdd,async member=>{
  if(member.guild.id!==guildId||member.user.bot)return;
  const eventKey=guildId+':join:'+member.id+':'+member.joinedTimestamp;if(state[eventKey])return;
  try{
   const list=await channels();const welcome=list.find(c=>baseName(c.name)==='bienvenida'&&c.type===0);if(!welcome)throw Error('Falta bienvenida');
   const channel=await client.channels.fetch(welcome.id);
   await channel.send({content:`¡Bienvenido/a <@${member.id}>!`,embeds:[welcomeEmbed(list,member.user)],allowedMentions:{parse:[],users:[member.id]}});
   state[eventKey]=Date.now();const joins=Object.keys(state).filter(k=>k.includes(':join:')).sort((a,b)=>state[b]-state[a]);for(const key of joins.slice(2000))delete state[key];persist();
  }catch(e){console.error('No se pudo enviar una bienvenida: '+(e.code??e.name));}
 });
 await client.login(token);
}
run().catch(e=>{console.error('Discord: '+(e.status?'HTTP '+e.status:e.code??e.message));process.exitCode=1;});
