import {FACES,COLORS,COLOR_NAMES,NORMALS,CORNERS,EDGES,FB_CORNERS,FB_EDGES,MOVE_NAMES,FACE_SPEC,solvedCube,parseAlg,formatAlg,applyAlg,moveCube,rotateCube,orientations,centers,extractCoordinates,faceCell,same,locatePiece,positionName,isPieceSolved,isFBSolved} from './cube.mjs';
const $=id=>document.getElementById(id);
const orientationList=orientations();
orientationList.forEach((o,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${COLOR_NAMES[o.centers.D]}下・${COLOR_NAMES[o.centers.L]}左`; $('orientation').append(option);});
$('orientation').value=orientationList.findIndex(o=>o.centers.D==='U'&&o.centers.L==='B');
let cubeStart=solvedCube(),currentCube=cubeStart,cs=centers(cubeStart),solutions=[],selected=0,step=0,minimum=null;
let worker,ready=false,failed=false,requestId=0,playing=null,inspection=null,inspectionFrame=null,answerHidden=false,dirty=false;
function startWorker(){
  if(worker)worker.terminate();
  ready=false;failed=false;
  try{worker=new Worker(new URL('./solver.worker.mjs',import.meta.url),{type:'module'});}
  catch{setFailure('この環境では探索を開始できません。新しいブラウザで開き直してください。');return;}
  worker.onmessage=({data})=>{
    if(data.type==='status')$('solver-status').textContent=data.text;
    if(data.type==='ready'){
      ready=true;failed=false;$('solver-status').classList.remove('failure');
      $('solver-status').textContent='距離表の読み込みが完了しました。';
      if(!inspection&&!dirty&&minimum===null)solve();
    }
    if(data.type==='error'){
      if(data.requestId!==undefined&&data.requestId!==requestId)return;
      setFailure(data.message);
    }
    if(data.type==='result'&&data.requestId===requestId){
      minimum=data.distance;solutions=data.solutions.map(moves=>({moves,own:false}));selected=0;step=0;
      $('solve').disabled=false;$('solve').innerHTML='最短手順を求める <span aria-hidden="true">→</span>';
      if(!answerHidden){$('solver-status').textContent=`${solutions.length}通りを表示${solutions.length===6?'（最大6通り）':''} · 固定配色で最短確定`;$('solver-status').classList.remove('failure');}
      renderResult();renderCube();renderPlayback();
    }
  };
  worker.onerror=()=>setFailure('探索を読み込めませんでした。「最短手順を求める」で再試行できます。');
  worker.postMessage({type:'init'});
}
function setFailure(message){
  ready=false;failed=true;$('solver-status').textContent=message;$('solver-status').classList.add('failure');
  $('solve').disabled=false;$('solve').textContent='もう一度探索する';
}
function stopPlay(){if(playing)clearInterval(playing);playing=null;$('play').textContent='▶';$('play').setAttribute('aria-label','自動再生');}
function stopInspection(){
  if(inspectionFrame)cancelAnimationFrame(inspectionFrame);inspectionFrame=null;inspection=null;
  $('inspection-overlay').hidden=true;$('cube-stage').classList.remove('inspection-active');
}
function clearResult(){
  requestId++;stopPlay();solutions=[];selected=0;step=0;minimum=null;
  $('own-result').textContent='選択中のFBの向きから始める手順を入力。';$('own-result').className='';
  $('solve').disabled=false;$('solve').innerHTML='最短手順を求める <span aria-hidden="true">→</span>';
  renderResult();renderPlayback();
}
function syncInput(){
  try{
    const moves=parseAlg($('scramble').value),orientation=orientationList[Number($('orientation').value)];
    cubeStart=rotateCube(applyAlg(solvedCube(),moves),orientation.rotations);currentCube=cubeStart;cs=orientation.centers;
    $('input-error').hidden=true;
    $('orientation-note').textContent=orientation.label?`スクランブル後：${orientation.label}`:'持ち替えなし（白上・緑前）';
    renderCube();return true;
  }catch(error){$('input-error').textContent=error.message;$('input-error').hidden=false;return false;}
}
function solve(){
  if(inspection)return;
  clearResult();answerHidden=false;
  if(!syncInput()){renderResult();return;}
  dirty=false;
  if(failed){startWorker();return;}
  if(!ready){$('solver-status').textContent='距離表の読み込み後、自動で探索します。';return;}
  const [cp,ep]=extractCoordinates(cubeStart,cs);
  $('solve').disabled=true;$('solve').textContent='探索中…';$('solver-status').textContent='最短手順を確認しています…';
  worker.postMessage({type:'solve',cp,ep,requestId});
}
function renderResult(){
  const visible=minimum!==null&&!answerHidden;
  $('distance').textContent=visible?minimum:'—';$('optimal-badge').hidden=!visible;
  $('result-caption').textContent=answerHidden?'まず自分でFBの手順を読みましょう。':visible?(minimum===0?'この配色のFirst Blockは完成しています。':'選択した配色のFBを完成させる最少手数です。'):'スクランブルを入力して探索してください。';
  $('solutions').replaceChildren();
  if(!visible)return;
  solutions.forEach((solution,i)=>{
    const button=document.createElement('button');button.type='button';button.className='solution-card'+(i===selected?' active':'');
    button.setAttribute('aria-pressed',String(i===selected));
    button.setAttribute('aria-label',`${solution.own?'自分の手順':`最短手順 ${i+1}`}：${formatAlg(solution.moves)||'0手、完成済み'}`);
    const top=document.createElement('div');top.className='solution-card-top';
    top.innerHTML=`<span>${solution.own?'自分の手順':`SOLUTION ${String(i+1).padStart(2,'0')}`}</span><span>${i===selected?'再生対象 · ':''}${solution.moves.length}手</span>`;
    const alg=document.createElement('div');alg.className='algorithm';
    if(!solution.moves.length)alg.textContent='完成済み';
    solution.moves.forEach((m,j)=>{const token=document.createElement('span');token.className='move-token'+(i===selected&&j<step?' executed':'')+(i===selected&&j===step-1?' current':'');token.textContent=MOVE_NAMES[m];alg.append(token);});
    button.append(top,alg);button.addEventListener('click',()=>{stopPlay();selected=i;setStep(0);});$('solutions').append(button);
  });
}
function trackedPieces(){
  const back=$('highlight').value==='back';
  return [{p:EDGES[4],name:'DR エッジ'},{p:EDGES[back?11:8],name:back?'BR エッジ':'FR エッジ'},{p:CORNERS[back?7:4],name:back?'DBR コーナー':'DFR コーナー'}].map(item=>({...item,...locatePiece(currentCube,item.p,cs),goal:item.p}));
}
function renderCube(){
  const mode=$('highlight').value,fb=[...FB_CORNERS.map(i=>CORNERS[i]),...FB_EDGES.map(i=>EDGES[i])].map(p=>locatePiece(currentCube,p,cs));
  const tracked=trackedPieces();
  const faceLayout={U:[1,0],L:[0,1],F:[1,1],R:[2,1],B:[3,1],D:[1,2]};
  const size=22,gap=2,faceSize=70,spacingX=97,spacingY=83,offsetX=14,offsetY=17;
  let svg='<svg viewBox="0 0 395 272" role="img" aria-label="Uが上、L F R Bが中央、Dが下のキューブ展開図"><title>現在のキューブ。FBは左側下段、SBは右側下段。</title>';
  for(const f of ['U','L','F','R','B','D']){
    const [fx,fy]=faceLayout[f],x0=offsetX+fx*spacingX,y0=offsetY+fy*spacingY;
    if(f==='L')svg+=`<rect x="${x0-4}" y="${y0+20}" width="${faceSize+8}" height="54" rx="5" fill="#a6efcb" opacity=".7"/>`;
    svg+=`<text class="face-label" x="${x0+faceSize/2}" y="${y0-5}" text-anchor="middle">${f}</text>`;
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const p=faceCell(f,row,col),s=currentCube.find(t=>same(t.p,p)&&same(t.n,NORMALS[f]));
      const isFB=fb.some(piece=>same(piece.p,s.p))||(f==='L'&&row===1&&col===1);
      const isTracked=tracked.some(piece=>same(piece.p,s.p));
      const dim=mode==='fb'?!isFB:(mode==='front'||mode==='back')?!isTracked:false;
      svg+=`<rect class="sticker${dim?' dim':''}${mode==='fb'&&isFB?' target':''}${(mode==='front'||mode==='back')&&isTracked?' tracked':''}" x="${x0+col*(size+gap)}" y="${y0+row*(size+gap)}" width="${size}" height="${size}" rx="3" fill="${COLORS[s.c]}"><title>${f}${row*3+col+1}：${COLOR_NAMES[s.c]}</title></rect>`;
    }
  }
  svg+='</svg>';$('cube').innerHTML=svg;
  $('tracking-pieces').replaceChildren();
  for(const item of tracked){
    const row=document.createElement('div');row.className='track-row';
    const white=item.stickers.find(s=>s.c===cs.D),ref=white?FACES.find(f=>same(NORMALS[f],white.n)):null;
    const solved=isPieceSolved(item,cs);
    row.innerHTML=`<span class="piece-name"><span class="swatches" aria-hidden="true">${item.colors.map(c=>`<i style="background:${COLORS[c]}"></i>`).join('')}</span>${item.name}</span><span class="piece-position${solved?' solved':''}">${positionName(item.p)}${ref?' · '+COLOR_NAMES[cs.D]+'→'+ref:''}${solved?' ✓':''}</span>`;
    $('tracking-pieces').append(row);
  }
}
function renderPlayback(){
  const length=answerHidden?0:(solutions[selected]?.moves.length||0);
  $('step-counter').textContent=`${step} / ${length}`;$('step-slider').max=length;$('step-slider').value=step;$('step-slider').disabled=!length;
  $('step-label').textContent=step?`STEP ${String(step).padStart(2,'0')} / ${MOVE_NAMES[solutions[selected].moves[step-1]]}`:'SCRAMBLE';
  for(const id of ['reset-step','prev-step'])$(id).disabled=!step;
  for(const id of ['next-step','last-step'])$(id).disabled=step>=length;
  $('play').disabled=!length;
}
function setStep(next){
  const moves=solutions[selected]?.moves||[];step=Math.max(0,Math.min(next,moves.length));
  currentCube=applyAlg(cubeStart,moves.slice(0,step));renderCube();renderPlayback();renderResult();
}
$('solve').addEventListener('click',solve);
$('scramble').addEventListener('input',()=>{
  stopInspection();answerHidden=false;dirty=true;clearResult();syncInput();
  $('solver-status').textContent='入力を変更しました。「最短手順を求める」で更新してください。';
});
$('scramble').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();solve();}});
$('orientation').addEventListener('change',()=>{stopInspection();answerHidden=false;solve();});
$('highlight').addEventListener('change',renderCube);
$('random').addEventListener('click',()=>{
  stopInspection();answerHidden=false;
  const moves=[];let previousAxis=-1;
  for(let i=0;i<20;i++){
    const valid=FACES.map((f,j)=>[FACE_SPEC[f][0],j]).filter(([axis])=>axis!==previousAxis);
    const bytes=new Uint32Array(2);crypto.getRandomValues(bytes);
    const [axis,face]=valid[bytes[0]%valid.length];previousAxis=axis;moves.push(face*3+bytes[1]%3);
  }
  $('scramble').value=formatAlg(moves);dirty=true;clearResult();syncInput();
  $('solver-status').textContent='新しい配置です。インスペクション、または最短探索を開始できます。';
});
$('start-inspection').addEventListener('click',()=>{
  stopInspection();clearResult();if(!syncInput())return;
  answerHidden=true;dirty=true;inspection={start:performance.now(),expired:false};renderResult();renderPlayback();
  $('solver-status').textContent='インスペクション中は答えを非表示にしています。';
  $('inspection-overlay').hidden=false;$('cube-stage').classList.add('inspection-active');
  $('timer-caption').textContent='FBの手順を読み、SBのパーツを追いましょう。';
  function tick(now){
    if(!inspection)return;
    const remaining=Math.max(0,15-(now-inspection.start)/1000);$('timer').textContent=remaining.toFixed(1);
    if(remaining>0){inspectionFrame=requestAnimationFrame(tick);}
    else{inspection.expired=true;$('cube-stage').classList.remove('inspection-active');$('timer-caption').textContent='15秒です。読んだ手順を確認しましょう。';}
  }
  inspectionFrame=requestAnimationFrame(tick);
});
$('end-inspection').addEventListener('click',()=>{stopInspection();answerHidden=false;solve();});
$('reset-step').addEventListener('click',()=>{stopPlay();setStep(0);});
$('prev-step').addEventListener('click',()=>{stopPlay();setStep(step-1);});
$('next-step').addEventListener('click',()=>{stopPlay();setStep(step+1);});
$('last-step').addEventListener('click',()=>{stopPlay();setStep(solutions[selected]?.moves.length||0);});
$('step-slider').addEventListener('input',event=>{stopPlay();setStep(Number(event.target.value));});
$('play').addEventListener('click',()=>{
  if(playing){stopPlay();return;}
  const length=solutions[selected]?.moves.length||0;if(!length)return;
  if(step===length)setStep(0);
  $('play').textContent='Ⅱ';$('play').setAttribute('aria-label','再生を停止');
  playing=setInterval(()=>{setStep(step+1);if(step>=length)stopPlay();},900);
});
function checkOwn(){
  const result=$('own-result');result.className='';
  if(inspection||answerHidden){result.textContent='インスペクションを終了してから判定してください。';return;}
  if(minimum===null||dirty){result.textContent='先に「最短手順を求める」を押してください。';return;}
  try{
    const moves=parseAlg($('own-alg').value),cube=applyAlg(cubeStart,moves);
    if(isFBSolved(cube,cs)){
      const diff=moves.length-minimum;result.className='good';
      result.textContent=diff===0?`${moves.length}手でFB完成。最短手数と一致しています。`:`${moves.length}手でFB完成。最短より${diff}手多い手順です。`;
      const existing=solutions.findIndex(s=>formatAlg(s.moves)===formatAlg(moves));
      if(existing>=0){selected=existing;}else{solutions=solutions.filter(s=>!s.own);solutions.push({moves,own:true});selected=solutions.length-1;}
      stopPlay();setStep(0);
    }else{
      const goals=[...FB_CORNERS.map(i=>CORNERS[i]),...FB_EDGES.map(i=>EDGES[i])];
      const solved=goals.filter(p=>isPieceSolved(locatePiece(cube,p,cs),cs)).length;
      result.className='bad';result.textContent=`${moves.length}手ではFBが未完成です。${solved} / 5パーツが完成しています。開始前の持ち替えも確認してください。`;
    }
  }catch(error){result.className='bad';result.textContent=error.message;}
}
$('check-own').addEventListener('click',checkOwn);
$('own-alg').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();checkOwn();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlay();});
syncInput();renderResult();renderPlayback();startWorker();
