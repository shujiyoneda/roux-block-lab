// A sticker geometry model is also used to check the independent coordinate solver.
export const FACES = ['U','R','F','D','L','B'];
export const COLORS = {U:'#f8fafc',R:'#ef5358',F:'#26b77b',D:'#f3d449',L:'#fa9947',B:'#4d89ed'};
export const COLOR_NAMES = {U:'白',R:'赤',F:'緑',D:'黄',L:'橙',B:'青'};
export const NORMALS = {U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
export const FACE_SPEC = {U:[1,1],R:[0,1],F:[2,1],D:[1,-1],L:[0,-1],B:[2,-1]};
export const MOVE_NAMES = FACES.flatMap(f=>[f,f+'2',f+"'"]);
export const CORNERS = [[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1],[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]];
export const EDGES = [[1,1,0],[0,1,1],[-1,1,0],[0,1,-1],[1,-1,0],[0,-1,1],[-1,-1,0],[0,-1,-1],[1,0,1],[-1,0,1],[-1,0,-1],[1,0,-1]];
export const FB_CORNERS = [5,6], FB_EDGES = [6,9,10];
export const CP_COUNT=504, EP_COUNT=10560, STATE_COUNT=CP_COUNT*EP_COUNT;
export const same = (a,b)=>a.every((v,i)=>v===b[i]);
export function rotateVector(v,axis,turns=1){
  let [x,y,z]=v;
  for(let i=0;i<((turns%4)+4)%4;i++){
    if(axis===0)[y,z]=[-z,y];
    else if(axis===1)[x,z]=[z,-x];
    else [x,y]=[-y,x];
  }
  return [x,y,z];
}
export function faceCell(face,row,col){
  const a=col-1,b=1-row;
  switch(face){
    case 'U': return [a,1,row-1];
    case 'D': return [a,-1,1-row];
    case 'F': return [a,b,1];
    case 'B': return [-a,b,-1];
    case 'R': return [1,b,-a];
    case 'L': return [-1,b,a];
  }
}
export function solvedCube(){return FACES.flatMap(c=>Array.from({length:9},(_,i)=>({p:faceCell(c,Math.floor(i/3),i%3),n:[...NORMALS[c]],c})));}
export function moveCube(cube,move){
  const [axis,sign]=FACE_SPEC[FACES[Math.floor(move/3)]];
  const q=-sign*(move%3+1);
  return cube.map(s=>s.p[axis]===sign?{p:rotateVector(s.p,axis,q),n:rotateVector(s.n,axis,q),c:s.c}:s);
}
export function applyAlg(cube,moves){return moves.reduce(moveCube,cube);}
export function rotateCube(cube,rotations){
  for(const {axis,q} of rotations)cube=cube.map(s=>({p:rotateVector(s.p,axis,q),n:rotateVector(s.n,axis,q),c:s.c}));
  return cube;
}
export function parseAlg(input){
  const source=input.replace(/[’′‘]/g,"'").trim();
  const moves=[];let i=0;
  while(i<source.length){
    if(/\s/.test(source[i])){i++;continue;}
    const match=/^([URFDLB])(2'?|')?/.exec(source.slice(i));
    if(!match)throw new Error(`「${source.slice(i,i+10)}」を読み取れません。U R F D L B と '・2 で入力してください。`);
    const power=match[2]?.startsWith('2')?1:match[2]?2:0;
    moves.push(FACES.indexOf(match[1])*3+power);i+=match[0].length;
    if(moves.length>200)throw new Error('手順は200手以内で入力してください。');
  }
  return moves;
}
export function formatAlg(moves){return moves.map(m=>MOVE_NAMES[m]).join(' ');}
export const inverseAlg=moves=>moves.toReversed?moves.toReversed().map(m=>Math.floor(m/3)*3+2-m%3):[...moves].reverse().map(m=>Math.floor(m/3)*3+2-m%3);
export function centers(cube){return Object.fromEntries(FACES.map(f=>[f,cube.find(s=>same(s.p,NORMALS[f])&&same(s.n,NORMALS[f])).c]));}
export function orientations(){
  const base=solvedCube(),queue=[{rotations:[],label:''}],seen=new Set(),out=[];
  for(let k=0;k<queue.length;k++){
    const item=queue[k],cube=rotateCube(base,item.rotations),cs=centers(cube),key=FACES.map(f=>cs[f]).join('');
    if(seen.has(key))continue;seen.add(key);out.push({...item,centers:cs});
    if(out.length===24)break;
    for(const [axis,name] of [[0,'x'],[1,'y'],[2,'z']])for(const [q,suffix] of [[-1,''],[-2,'2'],[-3,"'"]])queue.push({rotations:[...item.rotations,{axis,q}],label:(item.label+' '+name+suffix).trim()});
  }
  return out;
}
export const axesOf=p=>[0,1,2].filter(a=>p[a]!==0);
const cornerAxis=[1,0,2];
export function pieceColors(p,cs){return axesOf(p).map(a=>cs[FACES.find(f=>NORMALS[f][a]===p[a])]);}
export function locatePiece(cube,goalPosition,cs){
  const colors=pieceColors(goalPosition,cs),key=[...colors].sort().join('');
  for(const s of cube){
    if(!colors.includes(s.c))continue;
    const stickers=cube.filter(t=>same(t.p,s.p));
    if(stickers.map(t=>t.c).sort().join('')===key)return {p:s.p,stickers,colors};
  }
  throw new Error('パーツの配置を取得できません。');
}
export function extractCoordinates(cube,cs){
  const cornerStates=FB_CORNERS.map(id=>{
    const goal=CORNERS[id],piece=locatePiece(cube,goal,cs),reference=cs[goal[1]>0?'U':'D'];
    const normal=piece.stickers.find(s=>s.c===reference).n;
    const axis=normal.findIndex(v=>v!==0);
    return CORNERS.findIndex(p=>same(p,piece.p))*3+cornerAxis.indexOf(axis);
  });
  const edgeStates=FB_EDGES.map(id=>{
    const goal=EDGES[id],axis=axesOf(goal)[0],piece=locatePiece(cube,goal,cs);
    const reference=cs[FACES.find(f=>NORMALS[f][axis]===goal[axis])];
    const normal=piece.stickers.find(s=>s.c===reference).n;
    return EDGES.findIndex(p=>same(p,piece.p))*2+axesOf(piece.p).indexOf(normal.findIndex(v=>v!==0));
  });
  return [rankCorners(...cornerStates),rankEdges(...edgeStates)];
}
export function rankCorners(s0,s1){
  const a=Math.floor(s0/3),b=Math.floor(s1/3);
  return (a*7+b-(b>a?1:0))*9+(s0%3)*3+s1%3;
}
export function unrankCorners(rank){
  const ori=rank%9,perm=Math.floor(rank/9),a=Math.floor(perm/7),bc=perm%7,b=bc+(bc>=a?1:0);
  return [a*3+Math.floor(ori/3),b*3+ori%3];
}
export function rankEdges(s0,s1,s2){
  const a=s0>>1,b=s1>>1,c=s2>>1;
  return ((a*11+b-(b>a?1:0))*10+c-(c>a?1:0)-(c>b?1:0))*8+((s0&1)*4+(s1&1)*2+(s2&1));
}
export function unrankEdges(rank){
  const ori=rank%8,perm=Math.floor(rank/8),a=Math.floor(perm/110),bc=Math.floor(perm/10)%11,cc=perm%10;
  const b=bc+(bc>=a?1:0);let c=-1,count=-1;
  do{c++;if(c!==a&&c!==b)count++;}while(count<cc);
  return [a*2+(ori>>2),b*2+((ori>>1)&1),c*2+(ori&1)];
}
export const GOAL_CP=rankCorners(15,18),GOAL_EP=rankEdges(12,18,20),GOAL_INDEX=GOAL_CP*EP_COUNT+GOAL_EP;
export function makeMoveTables(){
  const corner=new Uint8Array(24*18),edge=new Uint8Array(24*18);
  for(let state=0;state<24;state++)for(let move=0;move<18;move++){
    const [axis,sign]=FACE_SPEC[FACES[Math.floor(move/3)]],q=-sign*(move%3+1);
    let p=CORNERS[Math.floor(state/3)],refAxis=cornerAxis[state%3],n=[0,0,0];n[refAxis]=p[refAxis];
    if(p[axis]===sign){p=rotateVector(p,axis,q);n=rotateVector(n,axis,q);}
    corner[state*18+move]=CORNERS.findIndex(t=>same(t,p))*3+cornerAxis.indexOf(n.findIndex(v=>v!==0));
    p=EDGES[state>>1];refAxis=axesOf(p)[state&1];n=[0,0,0];n[refAxis]=p[refAxis];
    if(p[axis]===sign){p=rotateVector(p,axis,q);n=rotateVector(n,axis,q);}
    edge[state*18+move]=EDGES.findIndex(t=>same(t,p))*2+axesOf(p).indexOf(n.findIndex(v=>v!==0));
  }
  const cp=new Uint16Array(CP_COUNT*18),ep=new Uint16Array(EP_COUNT*18);
  for(let i=0;i<CP_COUNT;i++){
    const [a,b]=unrankCorners(i);
    for(let m=0;m<18;m++)cp[i*18+m]=rankCorners(corner[a*18+m],corner[b*18+m]);
  }
  for(let i=0;i<EP_COUNT;i++){
    const [a,b,c]=unrankEdges(i);
    for(let m=0;m<18;m++)ep[i*18+m]=rankEdges(edge[a*18+m],edge[b*18+m],edge[c*18+m]);
  }
  return {cp,ep};
}
export function positionName(p){return ['U','D','F','B','R','L'].filter(f=>{const [a,s]=FACE_SPEC[f];return p[a]===s;}).join('');}
export function isPieceSolved(piece,cs){return piece.stickers.every(s=>s.c===cs[FACES.find(f=>same(s.n,NORMALS[f]))]);}
export function isFBSolved(cube,cs){return [...FB_CORNERS.map(i=>CORNERS[i]),...FB_EDGES.map(i=>EDGES[i])].every(p=>cube.filter(s=>same(s.p,p)).every(s=>s.c===cs[FACES.find(f=>same(s.n,NORMALS[f]))]));}
export function optimalSolutions(cp,ep,dist,tables,limit=6){
  const startDistance=dist[cp*EP_COUNT+ep];
  if(startDistance===255)throw new Error('距離表に配置が見つかりません。');
  const results=[],path=[],seen=new Set();
  const record=alg=>{const key=alg.join(',');if(!seen.has(key)){seen.add(key);results.push([...alg]);}};
  // Prefer different opening moves before filling the remaining alternatives.
  if(startDistance>0)for(let m=0;m<18&&results.length<limit;m++){
    let c=tables.cp[cp*18+m],e=tables.ep[ep*18+m],d=startDistance-1;
    if(dist[c*EP_COUNT+e]!==d)continue;
    const alg=[m];
    while(d>0){
      for(let next=0;next<18;next++){
        const nc=tables.cp[c*18+next],ne=tables.ep[e*18+next];
        if(dist[nc*EP_COUNT+ne]===d-1){alg.push(next);c=nc;e=ne;d--;break;}
      }
    }
    record(alg);
  }
  function visit(c,e,d){
    if(results.length>=limit)return;
    if(d===0){record(path);return;}
    for(let m=0;m<18;m++){
      const nc=tables.cp[c*18+m],ne=tables.ep[e*18+m];
      if(dist[nc*EP_COUNT+ne]===d-1){path.push(m);visit(nc,ne,d-1);path.pop();}
      if(results.length>=limit)break;
    }
  }
  visit(cp,ep,startDistance);
  return {distance:startDistance,solutions:results};
}
