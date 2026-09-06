import {makeMoveTables,optimalSolutions,STATE_COUNT,GOAL_INDEX} from './cube.mjs';
let dist,tables,initializing;
async function init(){
  if(dist)return;
  if(initializing)return initializing;
  initializing=(async()=>{
    postMessage({type:'status',text:'最短距離表を読み込んでいます…'});
    let buffer;
    if(typeof DecompressionStream!=='undefined'){
      try{
        const response=await fetch(new URL('./fb-distance.bin.gz',import.meta.url));
        if(!response.ok)throw new Error('Distance download failed');
        buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }catch{buffer=null;}
    }
    if(!buffer){
      const response=await fetch(new URL('./fb-distance.bin',import.meta.url));
      if(!response.ok)throw new Error('距離表を取得できません。通信を確認して、もう一度探索してください。');
      buffer=await response.arrayBuffer();
    }
    const bytes=new Uint8Array(buffer);
    if(bytes.length!==STATE_COUNT||bytes[GOAL_INDEX]!==0)throw new Error('距離表を読み取れません。ページを再読み込みしてください。');
    tables=makeMoveTables();dist=bytes;
    postMessage({type:'ready'});
  })();
  try{await initializing;}finally{initializing=null;}
}
self.onmessage=async({data})=>{
  try{
    await init();
    if(data.type==='solve'){
      const result=optimalSolutions(data.cp,data.ep,dist,tables,6);
      postMessage({type:'result',requestId:data.requestId,...result});
    }
  }catch(error){postMessage({type:'error',requestId:data.requestId,message:error.message||'探索中にエラーが発生しました。'});}
};
