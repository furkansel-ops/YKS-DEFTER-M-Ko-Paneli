/* Only public YouTube metadata and original links are indexed.
   No video or audio is downloaded or re-hosted. Data stays under /media/.
   An unsuccessful scan preserves the last confirmed teacher snapshot. */
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdir,rm,rename} from "node:fs/promises";
import {resolve,dirname} from "node:path";

const ROOT=resolve(process.cwd()),OUT=resolve(ROOT,"media/my-teachers-feed.json");
const FOLDER=resolve(ROOT,"media/my-teachers");
const PAGE_SIZE=80,CONCURRENT_PLAYLISTS=5;
const CHANNELS=[
  {name:"Eyüp B.",handle:"@EyupB",id:"UCbv-0vMCnLqwlZXUWoI4a5w",subjects:["Matematik","Geometri"]},
  {name:"3D Yayınları",handle:"@3DYayınları",id:"",subjects:["Matematik","Geometri","Türkçe","Edebiyat","Fizik","Kimya","Biyoloji","Tarih","Coğrafya","Felsefe","Din Kültürü"]},
  {name:"Ferrum",handle:"@yferrum",id:"UC0yco2kB3xW3WI__8E8HaKw",subjects:["Kimya"]},
  {name:"Biosem",handle:"@Biosem",id:"",subjects:["Biyoloji"]},
  {name:"Özcan Aykın",handle:"@ÖzcanAykınFİZİK-y2k",id:"UC_IRxSYYyDa4Li9lxAM4xbQ",subjects:["Fizik"]}
];
const CHANNEL_TIMEOUT=210000,PLAYLIST_TIMEOUT=65000;
function idOf(entry){
  const value=String(entry?.id||entry?.url||"");
  const match=value.match(/[?&]v=([A-Za-z0-9_-]{11})/)||value.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)||value.match(/^([A-Za-z0-9_-]{11})$/);
  return match?.[1]||"";
}
function playlistId(entry){
  const value=String(entry?.id||entry?.url||"");
  const match=value.match(/[?&]list=([A-Za-z0-9_-]{10,})/)||value.match(/^((?:PL|UU|OLAK5uy_)[A-Za-z0-9_-]{8,})$/);
  return match?.[1]||"";
}
function validChannelVideo(entry,channel){
  const id=String(entry?.channel_id||entry?.uploader_id||"");
  return !channel.id||!id||id===channel.id;
}
function asVideo(item,channel){
  if(!validChannelVideo(item,channel))return null;
  const id=idOf(item);if(!id)return null;
  const title=String(item?.title||"YouTube videosu").replace(/\s+/g," ").trim().slice(0,320);
  return {id,title,url:"https://www.youtube.com/watch?v="+id,
    thumbnail:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",
    channel:String(item?.channel||item?.uploader||channel.name).slice(0,110)};
}
function asPlaylist(item){
  const id=playlistId(item);if(!id)return null;
  return {id,title:String(item?.title||"Oynatma listesi").replace(/\s+/g," ").trim().slice(0,320),
    url:"https://www.youtube.com/playlist?list="+encodeURIComponent(id)};
}
function unique(items){
  const seen=new Set();return items.filter(x=>{if(!x||seen.has(x.id))return false;seen.add(x.id);return true;});
}
async function ytdlp(url,timeout){
  return await new Promise((resolve,reject)=>{
    const args=["-m","yt_dlp","--flat-playlist","--dump-single-json","--no-warnings",
      "--ignore-errors","--socket-timeout","12","--retries","1","--extractor-retries","1",url];
    const child=spawn("python3",args,{stdio:["ignore","pipe","pipe"]});
    let result="",err="",done=false;
    const finish=(error,value)=>{
      if(done)return;done=true;clearTimeout(timer);
      if(error)reject(error);else resolve(value);
    };
    const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("timeout"));},timeout);
    child.stdout.on("data",chunk=>{result+=String(chunk);});
    child.stderr.on("data",chunk=>{err+=String(chunk).slice(-1500);});
    child.on("error",e=>finish(e));
    child.on("close",code=>{
      if(done)return;
      if(!result.trim()){finish(new Error("yt-dlp "+code+" "+err.slice(-180)));return;}
      try{finish(null,JSON.parse(result));}catch(e){finish(e);}
    });
  });
}
function safeRows(data){return Array.isArray(data?.entries)?data.entries.filter(Boolean):[];}
async function readJson(path){try{return JSON.parse(await readFile(path,"utf8"));}catch{return null;}}
async function pool(rows,limit,handler){
  let i=0;const results=new Array(rows.length);
  await Promise.all(Array.from({length:Math.min(limit,rows.length)},async()=>{
    while(i<rows.length){const ix=i++;results[ix]=await handler(rows[ix],ix);}
  }));return results;
}
function slug(name){
  return {"Eyüp B.":"eyup-b","3D Yayınları":"3d-yayinlari","Ferrum":"ferrum",
    "Biosem":"biosem","Özcan Aykın":"ozcan-aykin"}[name];
}
async function snapshot(channel,previous){
  const name=channel.name,handle="https://www.youtube.com/"+encodeURI(channel.handle);
  const primary=channel.id?"https://www.youtube.com/channel/"+channel.id:handle;
  let videos=[],playlists=[],errors=[];
  try{
    const response=await ytdlp(primary+"/videos",CHANNEL_TIMEOUT);
    videos=unique(safeRows(response).map(v=>asVideo(v,channel)));
  }catch(e){errors.push("videolar: "+String(e?.message||e));}
  try{
    const response=await ytdlp(primary+"/playlists",CHANNEL_TIMEOUT);
    playlists=unique(safeRows(response).map(asPlaylist));
  }catch(e){errors.push("listeler: "+String(e?.message||e));}
  const old=previous?.teachers?.[name];
  const priorIndex=old?.archiveIndex?await readJson(resolve(ROOT,old.archiveIndex)):null;
  // Never replace a previously verified archive with an empty/failed scan.
  if(!videos.length&&priorIndex?.pages?.length){
    console.warn("[media] "+name+": Video scan unavailable; preserving previous data.");
    const oldFirst=await readJson(resolve(ROOT,priorIndex.pages[0]));
    videos=oldFirst?.videos||[];
  }
  if(!playlists.length&&Array.isArray(priorIndex?.playlists))playlists=priorIndex.playlists;
  if(!videos.length&&!playlists.length){
    console.warn("[media] "+name+": No public index could be fetched; not marking complete.");
    return null;
  }
  const lastPlaylists=new Map((priorIndex?.playlists||[]).map(x=>[x.id,x]));
  const enriched=await pool(playlists,CONCURRENT_PLAYLISTS,async item=>{
    try{
      const data=await ytdlp(item.url,PLAYLIST_TIMEOUT);
      const all=unique(safeRows(data).map(v=>asVideo(v,{...channel,id:""})));
      if(!all.length)throw new Error("empty playlist");
      const total=Number(data?.playlist_count||data?.n_entries||data?.entries?.length||0);
      return {...item,videoCount:Math.max(total,all.length),videos:all,contentComplete:Boolean(total&&all.length>=total)};
    }catch(e){
      const oldItem=lastPlaylists.get(item.id);
      errors.push("playlist "+item.id+": "+String(e?.message||e));
      return oldItem?.videos?.length?{...item,videoCount:oldItem.videoCount||oldItem.videos.length,
        videos:oldItem.videos,contentComplete:Boolean(oldItem.contentComplete)}:
        {...item,videos:[],videoCount:0,contentComplete:false};
    }
  });
  // Include public videos found inside playlists, not only recent uploads.
  const allVideos=unique([...videos,...enriched.flatMap(x=>x.videos||[])]);
  const pages=[];const dir=resolve(FOLDER,slug(name));
  await mkdir(dir,{recursive:true});
  for(let p=0;p<allVideos.length;p+=PAGE_SIZE){
    const file="media/my-teachers/"+slug(name)+"/p"+(Math.floor(p/PAGE_SIZE)+1)+".json";
    pages.push(file);
    await writeFile(resolve(ROOT,file),JSON.stringify({videos:allVideos.slice(p,p+PAGE_SIZE)})+"\n","utf8");
  }
  const channelUrl=handle;
  const index={
    version:1,name,channelName:name,channelUrl,channelId:channel.id,
    archiveComplete:errors.length===0,
    videosComplete:videos.length>0&&errors.every(x=>!x.startsWith("videolar:")),
    refreshedAt:new Date().toISOString(),
    videoCount:allVideos.length,playlistCount:enriched.length,
    pages,playlists:enriched,scanWarnings:errors.slice(0,50)
  };
  const indexPath="media/my-teachers/"+slug(name)+"/index.json";
  await writeFile(resolve(ROOT,indexPath),JSON.stringify(index)+"\n","utf8");
  console.log("[media] "+name+": "+index.videoCount+" video, "+enriched.length+
    " playlist, "+enriched.filter(p=>p.contentComplete).length+" complete, "+errors.length+" warnings");
  return {name,channelName:name,channelHandle:channel.handle,channelId:channel.id,
    channelUrl,subjects:channel.subjects,archiveIndex:indexPath,videoCount:index.videoCount,
    playlistCount:index.playlistCount,archiveComplete:index.archiveComplete,
    // The uploader playlist remains accessible regardless of scraping gaps.
    playlists:enriched.slice(0,8),videos:allVideos.slice(0,12),refreshedAt:index.refreshedAt};
}
const previous=await readJson(OUT)||{teachers:{}};
const teachers={...previous.teachers};let refreshed=0;
for(const channel of CHANNELS){
  const result=await snapshot(channel,previous);
  if(result){teachers[channel.name]=result;refreshed++;}
}
if(!refreshed){
  console.error("[media] No channels yielded fresh metadata. Keeping previous catalog.");
  process.exitCode=1;
}else{
  await mkdir(dirname(OUT),{recursive:true});
  await writeFile(OUT,JSON.stringify({version:1,source:"user-selected-official-channels",
    generatedAt:new Date().toISOString(),teacherCount:Object.keys(teachers).length,
    refreshedCount:refreshed,teachers},null,2)+"\n","utf8");
  console.log("[media] Refreshed "+refreshed+"/"+CHANNELS.length+" user-selected channels.");
}
