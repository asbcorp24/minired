import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x050510);
scene.fog=new THREE.FogExp2(0x050510,.0035);

const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,3000);
camera.position.set(120,90,120);

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.body.appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.08;

const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.5,.7,.08);
composer.addPass(bloomPass);
const bokehPass=new BokehPass(scene,camera,{focus:160,aperture:.00012,maxblur:.01});
composer.addPass(bokehPass);
composer.addPass(new OutputPass());

scene.add(new THREE.AmbientLight(0xffffff,.42));
const keyLight=new THREE.DirectionalLight(0xffffff,1.4);keyLight.position.set(1,2,1);scene.add(keyLight);
const rim1=new THREE.PointLight(0xff006e,4,400);rim1.position.set(-80,40,-80);scene.add(rim1);
const rim2=new THREE.PointLight(0x00ffff,4,400);rim2.position.set(80,-30,80);scene.add(rim2);
const innerLight=new THREE.PointLight(0xffffff,2,200);scene.add(innerLight);

const grid=new THREE.GridHelper(400,40,0x3366ff,0x112244);
grid.material.transparent=true;grid.material.opacity=.3;grid.material.depthWrite=false;scene.add(grid);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x0a0a20,metalness:.95,roughness:.15,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));
floor.rotation.x=-Math.PI/2;floor.position.y=-35;scene.add(floor);

const state={wire:false,doubleSide:true,autoRotate:true,axis:'y',speed:1,rotPaused:false,transition:1.5,env:true,particles:true,rings:true,envReact:true,envSpeed:1,audioReact:true,audioSens:1};

const baseUniforms={
 color:new THREE.Color(0x0088ff),
 fresnel:new THREE.Color(0x00ffff),
 opacity:.35,power:2.5,intensity:1.5,enabled:1,audio:0
};

const vs=[
'varying vec3 vNormal;','varying vec3 vView;',
'void main(){','vec4 mv=modelViewMatrix*vec4(position,1.0);','vView=-mv.xyz;',
'vNormal=normalize(normalMatrix*normal);','gl_Position=projectionMatrix*mv;','}'
].join('\n');

const fs=[
'uniform vec3 uColor;','uniform vec3 uFresnelColor;','uniform float uOpacity;','uniform float uPower;',
'uniform float uIntensity;','uniform float uEnabled;','uniform float uAudio;','uniform float uAlpha;',
'varying vec3 vNormal;','varying vec3 vView;','void main(){',
'vec3 N=normalize(vNormal);vec3 V=normalize(vView);',
'float fr=pow(1.0-abs(dot(N,V)),uPower);',
'vec3 base=uColor*.4;vec3 rim=uFresnelColor*fr*uIntensity*uEnabled;',
'float pulse=1.0+uAudio*1.5;',
'vec3 col=min((base+rim)*pulse,vec3(2.0));',
'float a=clamp(uOpacity+fr*.6*uEnabled+uAudio*.25,0.0,1.0)*uAlpha;',
'gl_FragColor=vec4(col,a);','}'
].join('\n');

function makeMaterial(){
 return new THREE.ShaderMaterial({
  uniforms:{uColor:{value:baseUniforms.color.clone()},uFresnelColor:{value:baseUniforms.fresnel.clone()},uOpacity:{value:baseUniforms.opacity},uPower:{value:baseUniforms.power},uIntensity:{value:baseUniforms.intensity},uEnabled:{value:baseUniforms.enabled},uAudio:{value:0},uAlpha:{value:0}},
  vertexShader:vs,fragmentShader:fs,transparent:true,depthWrite:false,side:state.doubleSide?THREE.DoubleSide:THREE.FrontSide,blending:THREE.AdditiveBlending
 });
}
function addWire(mesh){
 const m=new THREE.MeshBasicMaterial({color:baseUniforms.fresnel.clone(),wireframe:true,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});
 const w=new THREE.Mesh(mesh.geometry,m);w.name='wire';w.scale.setScalar(1.0015);w.visible=state.wire;mesh.add(w);
}
function disposeModel(mesh){
 if(!mesh)return;
 const w=mesh.getObjectByName('wire');if(w&&w.material)w.material.dispose();
 scene.remove(mesh);mesh.geometry&&mesh.geometry.dispose();mesh.material&&mesh.material.dispose();
}
function syncMaterials(){
 [currentMesh,oldMesh].forEach(mesh=>{
  if(!mesh)return;
  const u=mesh.material.uniforms;
  u.uColor.value.copy(baseUniforms.color);u.uFresnelColor.value.copy(baseUniforms.fresnel);
  u.uOpacity.value=baseUniforms.opacity;u.uPower.value=baseUniforms.power;u.uIntensity.value=baseUniforms.intensity;
  u.uEnabled.value=baseUniforms.enabled;u.uAudio.value=baseUniforms.audio;
  mesh.material.side=state.doubleSide?THREE.DoubleSide:THREE.FrontSide;mesh.material.needsUpdate=true;
  const w=mesh.getObjectByName('wire');if(w){w.visible=state.wire;w.material.color.copy(baseUniforms.fresnel);}
 });
}

const envGroup=new THREE.Group(),particleGroup=new THREE.Group(),ringGroup=new THREE.Group();
scene.add(envGroup,particleGroup,ringGroup);
const crystals=[];
for(let i=0;i<12;i++){
 const G=[THREE.IcosahedronGeometry,THREE.OctahedronGeometry,THREE.TetrahedronGeometry][i%3];
 const mesh=new THREE.Mesh(new G(3+Math.random()*5,0),new THREE.MeshBasicMaterial({color:[0xff006e,0x00ffff,0xffaa00,0xaa00ff][i%4],wireframe:true,transparent:true,opacity:.7}));
 const a=i/12*Math.PI*2,r=90+Math.random()*40,y=(Math.random()-.5)*100;
 mesh.position.set(Math.cos(a)*r,y,Math.sin(a)*r);
 mesh.userData={a,r,y,rs:(Math.random()-.5)*.02,os:.05+Math.random()*.1,b:.5+Math.random()*1.5,ba:5+Math.random()*15,op:.5+Math.random()*.4};
 envGroup.add(mesh);crystals.push(mesh);
}

let particles=null,vel=null,particleCount=1000;
const pc=document.createElement('canvas');pc.width=pc.height=64;
const pctx=pc.getContext('2d'),pg=pctx.createRadialGradient(32,32,0,32,32,32);
pg.addColorStop(0,'rgba(255,255,255,1)');pg.addColorStop(.3,'rgba(255,255,255,.8)');pg.addColorStop(1,'rgba(255,255,255,0)');
pctx.fillStyle=pg;pctx.fillRect(0,0,64,64);const ptex=new THREE.CanvasTexture(pc);
function createParticles(n){
 if(particles){particleGroup.remove(particles);particles.geometry.dispose();particles.material.dispose();}
 particleCount=n;const g=new THREE.BufferGeometry(),p=new Float32Array(n*3);vel=new Float32Array(n*3);
 for(let i=0;i<n;i++){const j=i*3,r=50+Math.random()*200,t=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
 p[j]=r*Math.sin(ph)*Math.cos(t);p[j+1]=r*Math.cos(ph);p[j+2]=r*Math.sin(ph)*Math.sin(t);vel[j]=(Math.random()-.5)*.3;vel[j+1]=(Math.random()-.5)*.3;vel[j+2]=(Math.random()-.5)*.3;}
 g.setAttribute('position',new THREE.BufferAttribute(p,3));
 particles=new THREE.Points(g,new THREE.PointsMaterial({size:1.5,map:ptex,color:0x00ffff,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));
 particleGroup.add(particles);
}
createParticles(1000);

const rings=[];
[[130,0xff006e,.3,.15],[160,0x00ffff,-.5,-.1],[190,0xaa00ff,.8,.08]].forEach(([r,c,tilt,speed])=>{
 const pts=[];for(let i=0;i<240;i++){const a=i/240*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));}
 const g=new THREE.BufferGeometry().setFromPoints(pts),m=new THREE.PointsMaterial({size:1.2,map:ptex,color:c,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false});
 const ring=new THREE.Points(g,m);ring.rotation.x=tilt;ring.rotation.z=tilt*.5;ring.userData={base:ring.rotation.z,speed};ringGroup.add(ring);rings.push(ring);
});

let currentMesh=null,oldMesh=null,transitionState='idle',transitionTime=0,pending=null;
const loader=new STLLoader();
function geometryFromBuffer(buf){
 const g=loader.parse(buf);g.computeBoundingBox();
 const box=g.boundingBox,c=new THREE.Vector3(),s=new THREE.Vector3();box.getCenter(c);box.getSize(s);
 g.translate(-c.x,-c.y,-c.z);const max=Math.max(s.x,s.y,s.z)||1;g.scale(100/max,100/max,100/max);g.computeVertexNormals();return g;
}
function meshFromBuffer(buf){const mesh=new THREE.Mesh(geometryFromBuffer(buf),makeMaterial());addWire(mesh);return mesh;}
function loadSTL(file){
 if(!file)return;
 if(transitionState!=='idle'){pending=file;return;}
 $('loading').classList.add('active');$('info').textContent='⏳ '+file.name;
 const r=new FileReader();
 r.onload=e=>{
  try{
   const next=meshFromBuffer(e.target.result);scene.add(next);
   if(currentMesh){oldMesh=currentMesh;currentMesh=next;transitionState='cross';}
   else{currentMesh=next;transitionState='in';}
   transitionTime=0;showLabel(file.name);
   $('info').textContent='✅ '+file.name+' | '+Math.round(next.geometry.attributes.position.count/3).toLocaleString()+' треуг.';
   syncMaterials();
  }catch(err){console.error(err);$('info').textContent='❌ '+err.message;transitionState='idle';}
  $('loading').classList.remove('active');
 };
 r.onerror=()=>{$('loading').classList.remove('active');transitionState='idle';$('info').textContent='❌ Ошибка чтения STL';};
 r.readAsArrayBuffer(file);
}

const playlist=[];let playlistIndex=0,playlistPlaying=true,playlistTimer=0,playlistInterval=30;
function renderPlaylist(){
 $('plCount').textContent=playlist.length;$('plList').innerHTML='';$('playlist').style.display=playlist.length?'block':'none';
 playlist.forEach((x,i)=>{
  const d=document.createElement('div');d.className='pl-item'+(i===playlistIndex?' active':'');
  const name=x.name.replace(/\.stl$/i,'');d.innerHTML='<span>'+(i+1)+'</span><span class="pl-name"></span><span class="remove">✕</span>';
  d.querySelector('.pl-name').textContent=name;
  d.onclick=e=>{if(e.target.classList.contains('remove'))return;playlistIndex=i;playlistTimer=0;renderPlaylist();loadSTL(x.file);};
  d.querySelector('.remove').onclick=e=>{e.stopPropagation();playlist.splice(i,1);if(playlistIndex>=playlist.length)playlistIndex=0;renderPlaylist();if(playlist.length)loadSTL(playlist[playlistIndex].file);else clearModels();};
  $('plList').appendChild(d);
 });
}
function addFiles(files){for(const f of files)if(f.name.toLowerCase().endsWith('.stl'))playlist.push({name:f.name,file:f});renderPlaylist();if(!currentMesh&&playlist.length)loadSTL(playlist[0].file);}
function nextModel(){if(!playlist.length)return;playlistIndex=(playlistIndex+1)%playlist.length;playlistTimer=0;renderPlaylist();loadSTL(playlist[playlistIndex].file);}
function clearModels(){disposeModel(currentMesh);disposeModel(oldMesh);currentMesh=oldMesh=null;transitionState='idle';hideLabel();}

let label=null,labelAlpha=0,labelHold=0;
function showLabel(name){
 if(label){scene.remove(label);label.material.map.dispose();label.material.dispose();}
 const c=document.createElement('canvas');c.width=1024;c.height=220;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
 x.font='700 78px Segoe UI,Arial';x.textAlign='center';x.textBaseline='middle';x.strokeStyle='rgba(233,69,96,.9)';x.lineWidth=6;x.strokeText(name.replace(/\.stl$/i,''),512,95);
 x.strokeStyle='#fff';x.lineWidth=1.5;x.strokeText(name.replace(/\.stl$/i,''),512,95);x.fillStyle='rgba(255,255,255,.08)';x.fillText(name.replace(/\.stl$/i,''),512,95);
 x.font='600 30px Segoe UI';x.fillStyle='#e94560';x.fillText((playlistIndex+1)+' / '+Math.max(playlist.length,1),512,175);
 const m=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0,depthTest:false});label=new THREE.Sprite(m);label.scale.set(160,34,1);label.position.set(0,-58,0);scene.add(label);labelAlpha=0;labelHold=0;
}
function hideLabel(){if(label)label.material.opacity=0;labelAlpha=0;}

let fly=false,flyTime=0,flyPath=null;
function makePath(){const p=[];for(let i=0;i<=200;i++){const t=i/200,a=t*Math.PI*3-Math.PI/2,r=170*(.5+.7*Math.sin(t*Math.PI));p.push(new THREE.Vector3(Math.cos(a)*r,-60+200*t,Math.sin(a)*r));}return new THREE.CatmullRomCurve3(p);}
function resetCamera(){fly=false;controls.enabled=true;camera.position.set(120,90,120);controls.target.set(0,0,0);controls.update();$('playBtn').textContent='▶️ Пролёт камеры';$('playBtn').classList.remove('active');}
function toggleFly(){if(!currentMesh)return;$('playBtn').classList.toggle('active');if(fly){resetCamera();return;}fly=true;flyTime=0;flyPath=makePath();controls.enabled=false;$('playBtn').textContent='⏸ Остановить';}

let audioContext=null,analyser=null,audioSource=null,audioBuffer=null,audioData=null,audioPlaying=false,audioStart=0,audioPause=0,bass=0,recordDest=null;
async function loadAudio(file){
 if(!file)return;
 try{
  if(!audioContext)audioContext=new (AudioContext||webkitAudioContext)();
  if(analyser)try{analyser.disconnect();}catch(e){}
  audioBuffer=await audioContext.decodeAudioData(await file.arrayBuffer());
  analyser=audioContext.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.8;analyser.connect(audioContext.destination);
  audioData=new Uint8Array(analyser.frequencyBinCount);audioPause=0;$('audioStatus').textContent='🎵 '+file.name+' ('+audioBuffer.duration.toFixed(1)+'с)';
 }catch(e){console.error(e);$('audioStatus').textContent='❌ Ошибка аудио';}
}
function playAudio(){
 if(!audioBuffer||!audioContext)return;if(audioContext.state==='suspended')audioContext.resume();
 if(audioSource)try{audioSource.stop();}catch(e){}
 audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffer;audioSource.loop=true;audioSource.connect(analyser);
 audioPause=audioBuffer.duration?audioPause%audioBuffer.duration:0;audioSource.start(0,audioPause);audioStart=audioContext.currentTime-audioPause;audioPlaying=true;$('audioStatus').classList.add('playing');$('playAudioBtn').textContent='⏸ Пауза';
}
function pauseAudio(){if(!audioPlaying)return;audioPause=audioContext.currentTime-audioStart;if(audioBuffer.duration)audioPause%=audioBuffer.duration;try{audioSource.stop();}catch(e){}audioSource=null;audioPlaying=false;$('audioStatus').classList.remove('playing');$('playAudioBtn').textContent='▶️ Играть';}
function stopAudio(){if(audioSource)try{audioSource.stop();}catch(e){}audioSource=null;audioPlaying=false;audioPause=0;bass=0;baseUniforms.audio=0;$('audioStatus').classList.remove('playing');$('playAudioBtn').textContent='▶️ Играть';}
function updateAudio(){
 if(!analyser||!audioPlaying||!state.audioReact){bass*=.9;baseUniforms.audio=bass;return;}
 analyser.getByteFrequencyData(audioData);const n=Math.max(1,Math.floor(audioData.length*.1));let sum=0;for(let i=0;i<n;i++)sum+=audioData[i];
 const target=Math.min(sum/n/255*state.audioSens,1);bass+=(target-bass)*.3;baseUniforms.audio=bass;innerLight.intensity=2+bass*5;syncMaterials();
}

let recorder=null,chunks=[],recStart=0,recTimer=null;
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');}
function startRecording(){
 const stream=renderer.domElement.captureStream(60);
 if(analyser&&audioPlaying&&audioContext){try{if(recordDest)analyser.disconnect(recordDest);}catch(e){}recordDest=audioContext.createMediaStreamDestination();analyser.connect(recordDest);const t=recordDest.stream.getAudioTracks()[0];if(t)stream.addTrack(t);}
 const list=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 const mime=list.find(x=>MediaRecorder.isTypeSupported(x))||'video/webm';chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const b=new Blob(chunks,{type:'video/webm'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='stl-clip-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);if(recordDest&&analyser)try{analyser.disconnect(recordDest);}catch(e){}recordDest=null;stream.getTracks().forEach(t=>t.stop());};
 recorder.start(100);recStart=Date.now();$('recordBtn').classList.add('recording');$('recordBtn').textContent='⏹ Остановить запись';$('rec').classList.add('active');recTimer=setInterval(()=>{$('recTime').textContent=fmt((Date.now()-recStart)/1000);},200);
}
function stopRecording(){if(recorder&&recorder.state!=='inactive')recorder.stop();$('recordBtn').classList.remove('recording');$('recordBtn').textContent='⏺ Запись клипа';$('rec').classList.remove('active');clearInterval(recTimer);}

function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
const clock=new THREE.Clock(),look=new THREE.Vector3();
function animate(){
 requestAnimationFrame(animate);const dt=clock.getDelta(),t=clock.elapsedTime;
 if(transitionState==='cross'){
  transitionTime+=dt;const p=Math.min(transitionTime/Math.max(state.transition,.05),1),e=ease(p);
  if(oldMesh){oldMesh.material.uniforms.uAlpha.value=1-e;const w=oldMesh.getObjectByName('wire');if(w)w.material.opacity=.72*(1-e);}
  if(currentMesh){currentMesh.material.uniforms.uAlpha.value=e;const w=currentMesh.getObjectByName('wire');if(w)w.material.opacity=.72*e;}
  if(p>=1){disposeModel(oldMesh);oldMesh=null;transitionState='idle';if(pending){const f=pending;pending=null;setTimeout(()=>loadSTL(f),0);}}
 }else if(transitionState==='in'){
  transitionTime+=dt;const p=Math.min(transitionTime/Math.max(state.transition/2,.05),1),e=ease(p);if(currentMesh)currentMesh.material.uniforms.uAlpha.value=e;
  if(p>=1){transitionState='idle';if(pending){const f=pending;pending=null;setTimeout(()=>loadSTL(f),0);}}
 }
 if(label){labelHold+=dt;if(labelHold<5)labelAlpha+=(1-labelAlpha)*Math.min(dt*3,1);else labelAlpha+=(0-labelAlpha)*Math.min(dt*2,1);label.material.opacity=labelAlpha;label.position.y=-58+Math.sin(t*1.5)*2;}
 if(playlist.length>1&&playlistPlaying&&currentMesh&&transitionState==='idle'){playlistTimer+=dt;$('plTimer').textContent=Math.max(0,playlistInterval-playlistTimer).toFixed(1)+'с';if(playlistTimer>=playlistInterval)nextModel();}else $('plTimer').textContent='—';
 if(fly&&flyPath){flyTime+=dt;const q=(flyTime/14)%1;camera.position.copy(flyPath.getPointAt(q));look.y=Math.sin(q*Math.PI*4)*15;camera.lookAt(look);bokehPass.uniforms.focus.value=camera.position.distanceTo(look);}else controls.update();
 if(currentMesh&&state.autoRotate&&!state.rotPaused){const a=dt*.15*state.speed;[currentMesh,oldMesh].filter(Boolean).forEach(m=>m.rotation[state.axis]+=a);}
 rim1.intensity=4+Math.sin(t*1.5)*1.5;rim2.intensity=4+Math.cos(t*1.8)*1.5;
 const mult=1+(state.audioReact&&state.envReact?bass*3:0),de=dt*state.envSpeed;
 if(state.env)crystals.forEach((c,i)=>{const u=c.userData;c.rotation.x+=u.rs*de*60;c.rotation.y+=u.rs*de*45;u.a+=u.os*de;c.position.set(Math.cos(u.a)*u.r,u.y+Math.sin(t*u.b+i)*u.ba,Math.sin(u.a)*u.r);c.scale.setScalar(1+(state.audioReact&&state.envReact?bass*.8:0));c.material.opacity=Math.min(u.op*mult,1);});
 if(state.particles&&particles){const p=particles.geometry.attributes.position.array;for(let i=0;i<particleCount;i++){const j=i*3;p[j]+=vel[j]*de*60;p[j+1]+=vel[j+1]*de*60;p[j+2]+=vel[j+2]*de*60;const x=p[j],z=p[j+2],a=de*.05,c=Math.cos(a),s=Math.sin(a);p[j]=x*c-z*s;p[j+2]=x*s+z*c;if(Math.hypot(p[j],p[j+1],p[j+2])>300){p[j]=(Math.random()-.5)*180;p[j+1]=(Math.random()-.5)*180;p[j+2]=(Math.random()-.5)*180;}}particles.geometry.attributes.position.needsUpdate=true;particles.material.size=1.5*mult;}
 if(state.rings)rings.forEach(r=>r.rotation.z=r.userData.base+t*r.userData.speed*state.envSpeed);
 updateAudio();composer.render();
}
animate();

function setText(id,v){$(id).textContent=v;}
$('fileInput').onchange=e=>addFiles(e.target.files);$('playBtn').onclick=toggleFly;$('resetBtn').onclick=resetCamera;
$('plNextBtn').onclick=nextModel;$('plPlayBtn').onclick=()=>{playlistPlaying=!playlistPlaying;$('plPlayBtn').textContent=playlistPlaying?'⏸ Пауза':'▶️ Пуск';};
$('plClearBtn').onclick=()=>{playlist.length=0;playlistIndex=0;renderPlaylist();clearModels();};
$('plInterval').oninput=e=>{playlistInterval=+e.target.value;setText('plIntervalValue',playlistInterval+'с');saveSoon();};

$('opacitySlider').oninput=e=>{baseUniforms.opacity=+e.target.value;setText('opacityValue',(+e.target.value).toFixed(2));syncMaterials();saveSoon();};
$('fresnelToggle').onchange=e=>{baseUniforms.enabled=e.target.checked?1:0;syncMaterials();saveSoon();};
$('fresnelPower').oninput=e=>{baseUniforms.power=+e.target.value;setText('fresnelPowerValue',(+e.target.value).toFixed(1));syncMaterials();saveSoon();};
$('fresnelIntensity').oninput=e=>{baseUniforms.intensity=+e.target.value;setText('fresnelIntensityValue',(+e.target.value).toFixed(1));syncMaterials();saveSoon();};
$('fresnelColorPicker').oninput=e=>{baseUniforms.fresnel.set(e.target.value);syncMaterials();saveSoon();};
$('colorPicker').oninput=e=>{baseUniforms.color.set(e.target.value);syncMaterials();saveSoon();};
$('bgColorPicker').oninput=e=>{scene.background.set(e.target.value);scene.fog.color.set(e.target.value);saveSoon();};
$('autoRotateToggle').onchange=e=>{state.autoRotate=e.target.checked;saveSoon();};
document.querySelectorAll('.axis').forEach(b=>b.onclick=()=>{document.querySelectorAll('.axis').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.axis=b.dataset.axis;saveSoon();});
$('speedSlider').oninput=e=>{state.speed=+e.target.value;setText('speedValue',Math.abs(state.speed).toFixed(1));$('directionLabel').textContent=state.speed<0?'↺':state.speed>0?'↻':'⏸';saveSoon();};
$('reverseBtn').onclick=()=>{$('speedSlider').value=-state.speed;$('speedSlider').dispatchEvent(new Event('input'));};
$('pauseRotBtn').onclick=()=>{state.rotPaused=!state.rotPaused;$('pauseRotBtn').textContent=state.rotPaused?'▶️':'⏸';};
document.querySelectorAll('.orient').forEach(b=>b.onclick=()=>{if(currentMesh)currentMesh.rotation[b.dataset.axis]+=THREE.MathUtils.degToRad(+b.dataset.deg);});
$('orientationResetBtn').onclick=()=>{if(currentMesh)currentMesh.rotation.set(0,0,0);};

$('wireframeToggle').onchange=e=>{state.wire=e.target.checked;syncMaterials();saveSoon();};
$('doubleSided').onchange=e=>{state.doubleSide=e.target.checked;syncMaterials();saveSoon();};
$('bloomToggle').onchange=e=>{bloomPass.enabled=e.target.checked;saveSoon();};$('dofToggle').onchange=e=>{bokehPass.enabled=e.target.checked;saveSoon();};
$('gridToggle').onchange=e=>{grid.visible=e.target.checked;saveSoon();};$('showFloor').onchange=e=>{floor.visible=e.target.checked;saveSoon();};
$('bloomStrength').oninput=e=>{bloomPass.strength=+e.target.value;saveSoon();};$('transitionDuration').oninput=e=>{state.transition=+e.target.value;setText('transitionDurationValue',state.transition.toFixed(1));saveSoon();};

$('envToggle').onchange=e=>{state.env=e.target.checked;envGroup.visible=state.env;saveSoon();};
$('particlesToggle').onchange=e=>{state.particles=e.target.checked;particleGroup.visible=state.particles;saveSoon();};
$('ringsToggle').onchange=e=>{state.rings=e.target.checked;ringGroup.visible=state.rings;saveSoon();};
$('envReactToggle').onchange=e=>{state.envReact=e.target.checked;saveSoon();};$('envSpeed').oninput=e=>{state.envSpeed=+e.target.value;setText('envSpeedValue',state.envSpeed.toFixed(1));saveSoon();};
let pt; $('particleDensity').oninput=e=>{const n=+e.target.value;setText('particleDensityValue',n);clearTimeout(pt);pt=setTimeout(()=>createParticles(n),160);saveSoon();};
$('envColorPicker').oninput=e=>{const c=new THREE.Color(e.target.value);crystals.forEach((x,i)=>x.material.color.copy(c).multiplyScalar(.65+(i%3)*.15));if(particles)particles.material.color.copy(c);rings.forEach((r,i)=>r.material.color.copy(c).offsetHSL(i*.1,0,0));saveSoon();};

$('audioInput').onchange=e=>loadAudio(e.target.files[0]);$('playAudioBtn').onclick=()=>audioPlaying?pauseAudio():playAudio();$('stopAudioBtn').onclick=stopAudio;
$('audioReactToggle').onchange=e=>{state.audioReact=e.target.checked;saveSoon();};$('audioSens').oninput=e=>{state.audioSens=+e.target.value;setText('audioSensValue',state.audioSens.toFixed(1));saveSoon();};
$('recordBtn').onclick=()=>recorder&&recorder.state==='recording'?stopRecording():startRecording();

$('settingsToggle').onclick=()=>$('controls').classList.toggle('open');
const drag=$('drag');window.addEventListener('dragover',e=>{e.preventDefault();drag.classList.add('active');});
window.addEventListener('dragleave',e=>{if(e.relatedTarget===null)drag.classList.remove('active');});
window.addEventListener('drop',e=>{e.preventDefault();drag.classList.remove('active');const f=[...e.dataTransfer.files],s=f.filter(x=>x.name.toLowerCase().endsWith('.stl')),a=f.find(x=>x.type.startsWith('audio/'));if(s.length)addFiles(s);if(a)loadAudio(a);});

const KEY='stl-cinematic-settings-v2';let saveTimer;
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveSettings,100);}
function saveSettings(){
 const ids=['opacitySlider','fresnelToggle','fresnelPower','fresnelIntensity','fresnelColorPicker','autoRotateToggle','speedSlider','audioReactToggle','audioSens','envToggle','particlesToggle','ringsToggle','envReactToggle','envSpeed','particleDensity','envColorPicker','wireframeToggle','bloomToggle','dofToggle','gridToggle','showFloor','doubleSided','bloomStrength','colorPicker','bgColorPicker','transitionDuration','plInterval'];
 const d={axis:state.axis};ids.forEach(id=>{const e=$(id);d[id]=e.type==='checkbox'?e.checked:e.value;});try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){}
}
function restoreSettings(){
 let d;try{d=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}if(!d)return;
 Object.keys(d).forEach(id=>{if(id==='axis'||!$(id))return;const e=$(id);if(e.type==='checkbox'){e.checked=!!d[id];e.dispatchEvent(new Event('change'));}else{e.value=d[id];e.dispatchEvent(new Event('input'));}});
 if(['x','y','z'].includes(d.axis)){state.axis=d.axis;document.querySelectorAll('.axis').forEach(b=>b.classList.toggle('active',b.dataset.axis===state.axis));}
}
restoreSettings();

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);bloomPass.resolution.set(innerWidth,innerHeight);});
