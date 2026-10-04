import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {GlitchPass} from 'three/addons/postprocessing/GlitchPass.js';
import {AfterimagePass} from 'three/addons/postprocessing/AfterimagePass.js';
import {RGBShiftShader} from 'three/addons/shaders/RGBShiftShader.js';
import {FilmShader} from 'three/addons/shaders/FilmShader.js';
import {VignetteShader} from 'three/addons/shaders/VignetteShader.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
const fontLoader=new FontLoader();
const fontUrls={
 helvetiker:'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
 optimer:'https://unpkg.com/three@0.160.0/examples/fonts/optimer_regular.typeface.json',
 gentilis:'https://unpkg.com/three@0.160.0/examples/fonts/gentilis_regular.typeface.json'
};
const fontCache=new Map();
const textObjects=[];
let activeTextId=null,textIdSeq=1;
scene.background=new THREE.Color(0x050510);
scene.fog=new THREE.FogExp2(0x050510,.0035);

const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,3000);
camera.position.set(120,90,120);

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.body.appendChild(renderer.domElement);
scene.add(camera);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.08;

const composer=new EffectComposer(renderer);
const renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.5,.7,.08);composer.addPass(bloomPass);
const bokehPass=new BokehPass(scene,camera,{focus:160,aperture:.00012,maxblur:.01});composer.addPass(bokehPass);

const afterimagePass=new AfterimagePass();afterimagePass.enabled=false;afterimagePass.uniforms.damp.value=.88;composer.addPass(afterimagePass);
const rgbShiftPass=new ShaderPass(RGBShiftShader);rgbShiftPass.enabled=false;rgbShiftPass.uniforms.amount.value=.004;composer.addPass(rgbShiftPass);
const chromaPass=new ShaderPass({
 uniforms:{tDiffuse:{value:null},amount:{value:.0025}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float amount;varying vec2 vUv;void main(){vec2 d=vUv-.5;float r=length(d);vec2 o=normalize(d+1e-6)*amount*r;float R=texture2D(tDiffuse,vUv+o).r;float G=texture2D(tDiffuse,vUv).g;float B=texture2D(tDiffuse,vUv-o).b;gl_FragColor=vec4(R,G,B,1.0);}`
});chromaPass.enabled=false;composer.addPass(chromaPass);
const filmPass=new ShaderPass(FilmShader);filmPass.enabled=false;filmPass.uniforms.intensity.value=.18;composer.addPass(filmPass);
const scanlinePass=new ShaderPass({
 uniforms:{tDiffuse:{value:null},amount:{value:.2},time:{value:0}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float amount;uniform float time;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float s=.5+.5*sin(vUv.y*1200.0+time*18.0);c.rgb*=1.0-amount*.35*s;gl_FragColor=c;}`
});scanlinePass.enabled=false;composer.addPass(scanlinePass);
const glitchPass=new GlitchPass();glitchPass.enabled=false;glitchPass.goWild=false;composer.addPass(glitchPass);
const vignettePass=new ShaderPass(VignetteShader);vignettePass.enabled=false;vignettePass.uniforms.offset.value=1.0;vignettePass.uniforms.darkness.value=1.2;composer.addPass(vignettePass);
const gradingPass=new ShaderPass({
 uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1},temperature:{value:0},tint:{value:0}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float contrast;uniform float saturation;uniform float temperature;uniform float tint;varying vec2 vUv;
 void main(){vec4 c=texture2D(tDiffuse,vUv);vec3 col=(c.rgb-.5)*contrast+.5;float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,saturation);col.r+=temperature*.10;col.b-=temperature*.10;col.g+=tint*.08;col.r-=tint*.03;col.b-=tint*.03;gl_FragColor=vec4(clamp(col,0.0,1.0),c.a);}`
});gradingPass.enabled=true;composer.addPass(gradingPass);
const outputPass=new OutputPass();composer.addPass(outputPass);

scene.add(new THREE.AmbientLight(0xffffff,.42));
const keyLight=new THREE.DirectionalLight(0xffffff,1.4);keyLight.position.set(1,2,1);scene.add(keyLight);
const rim1=new THREE.PointLight(0xff006e,4,400);rim1.position.set(-80,40,-80);scene.add(rim1);
const rim2=new THREE.PointLight(0x00ffff,4,400);rim2.position.set(80,-30,80);scene.add(rim2);
const innerLight=new THREE.PointLight(0xffffff,2,200);scene.add(innerLight);

const grid=new THREE.GridHelper(400,40,0x3366ff,0x112244);
grid.material.transparent=true;grid.material.opacity=.3;grid.material.depthWrite=false;scene.add(grid);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x0a0a20,metalness:.95,roughness:.15,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));
floor.rotation.x=-Math.PI/2;floor.position.y=-35;scene.add(floor);

const imageCubeGroup=new THREE.Group();
scene.add(imageCubeGroup);
imageCubeGroup.visible=false;
const cubeGlow=new THREE.Mesh(
 new THREE.CircleGeometry(58,64),
 new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide})
);
cubeGlow.rotation.x=-Math.PI/2;cubeGlow.position.y=-34.7;cubeGlow.visible=false;scene.add(cubeGlow);
const cubeSize=92,halfCube=cubeSize/2;
const glassMaterial=new THREE.MeshPhysicalMaterial({
 color:0x66ccff,transparent:true,opacity:.13,transmission:.88,thickness:.35,
 roughness:.08,metalness:.04,clearcoat:1,clearcoatRoughness:.05,ior:1.25,side:THREE.DoubleSide
});
const studioFaces=[
 ['#0a1630','#2dd4ff'],['#180a28','#ff3da7'],['#18243a','#ffffff'],
 ['#050814','#1d4ed8'],['#071426','#22d3ee'],['#16091f','#a855f7']
].map(([a,b])=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,128,128);g.addColorStop(0,a);g.addColorStop(1,b);x.fillStyle=g;x.fillRect(0,0,128,128);return c;});
const studioEnv=new THREE.CubeTexture(studioFaces);studioEnv.colorSpace=THREE.SRGBColorSpace;studioEnv.needsUpdate=true;
glassMaterial.envMap=studioEnv;glassMaterial.envMapIntensity=1.25;
const imageCube=new THREE.Mesh(new THREE.BoxGeometry(cubeSize,cubeSize,cubeSize),glassMaterial);
imageCubeGroup.add(imageCube);
const cubeEdges=new THREE.LineSegments(
 new THREE.EdgesGeometry(imageCube.geometry),
 new THREE.LineBasicMaterial({color:0x00ffff,transparent:true,opacity:.9})
);
imageCube.add(cubeEdges);
const imageFacePlanes=[];
const facePlaneGeo=new THREE.PlaneGeometry(cubeSize*.92,cubeSize*.92);
for(let i=0;i<6;i++){
 const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,side:THREE.DoubleSide,toneMapped:false});
 const plane=new THREE.Mesh(facePlaneGeo,mat);plane.visible=false;imageCube.add(plane);imageFacePlanes.push(plane);
}
imageFacePlanes[0].position.set( halfCube+.25,0,0);imageFacePlanes[0].rotation.y=-Math.PI/2;
imageFacePlanes[1].position.set(-halfCube-.25,0,0);imageFacePlanes[1].rotation.y= Math.PI/2;
imageFacePlanes[2].position.set(0, halfCube+.25,0);imageFacePlanes[2].rotation.x= Math.PI/2;
imageFacePlanes[3].position.set(0,-halfCube-.25,0);imageFacePlanes[3].rotation.x=-Math.PI/2;
imageFacePlanes[4].position.set(0,0, halfCube+.25);
imageFacePlanes[5].position.set(0,0,-halfCube-.25);imageFacePlanes[5].rotation.y=Math.PI;
let cubeFaceIndex=4,cubeStep=0,cubeTransition=null,currentContentType=null,lastCubeTurn=1,imageAdvancePreparing=false,typeTransition=null;
const preloadCache=new Map();
let activeImageAverage=new THREE.Color(0x00ffff);
let cameraDollyBase=null;
const cubeTargetQ=new THREE.Quaternion(),cubeStartQ=new THREE.Quaternion(),cubeFacingQ=new THREE.Quaternion(),cubeSwayQ=new THREE.Quaternion();
function faceQuaternionForStep(step){
 const q=new THREE.Quaternion();
 q.setFromAxisAngle(new THREE.Vector3(0,1,0),-step*Math.PI/2);
 return q;
}

const state={wire:false,doubleSide:true,autoRotate:true,axis:'y',speed:1,rotPaused:false,transition:1.5,transitionMode:'crossfade',env:true,particles:true,rings:true,envReact:true,envSpeed:1,audioReact:true,audioSens:1,cubeSpinSpeed:.3,cubeTurnDuration:2.2,objectScale:1,imageFitMode:'contain',cubeTransitionStyle:'fly-turn',cubeHoldPercent:60,cubeNearDistance:58,cubeFarDistance:280,cubeSway:.4,cubeGlassOpacity:.13,cubeEdgeIntensity:1,cubeBassEdges:true,cubeEdgeSweep:true,cameraDolly:true,autoPalette:true,typeTransitionStyle:'fly-dissolve',preload:true,parallax:true,gradePreset:'none',scenePreset:'custom',autoCameraEach:false,technicalMode:false,corridorAudioReact:true,corridorLength:320,corridorRadius:22,corridorSpeed:28,corridorBend:24,corridorTwist:.9,corridorSegments:96,corridorColor:'#00ffff',corridorStyle:'neon',corridorShape:'circle',corridorDensity:1,corridorLineWidth:1,corridorShapeWave:.18,corridorSectionSpin:.45,corridorPulse:true,corridorParticles:true};

const gradePresets={
 none:{contrast:1,saturation:1,temperature:0,tint:0,exposure:1.05},
 'cyberpunk':{contrast:1.28,saturation:1.32,temperature:-.12,tint:.24,exposure:1.08},
 'cold-tech':{contrast:1.16,saturation:.88,temperature:-.28,tint:.04,exposure:1.02},
 'warm-cinema':{contrast:1.18,saturation:1.08,temperature:.20,tint:.03,exposure:1.06},
 neon:{contrast:1.32,saturation:1.42,temperature:-.05,tint:.18,exposure:1.12},
 blueprint:{contrast:1.12,saturation:.34,temperature:-.32,tint:-.06,exposure:.98},
 'clean-product':{contrast:1.06,saturation:.96,temperature:.02,tint:0,exposure:1.12}
};
const scenePresets={
 'hi-tech':{bg:'#050510',fog:'#050510',bloom:1.6,model:'#0088ff',edge:'#00ffff',env:'#ff006e',floor:true,grid:true,particles:true,rings:true,grade:'cold-tech',glass:'#66ccff',glassOpacity:.13},
 cyberpunk:{bg:'#08040f',fog:'#12081a',bloom:2.0,model:'#6a5cff',edge:'#ff00aa',env:'#00e5ff',floor:true,grid:true,particles:true,rings:true,grade:'cyberpunk',glass:'#4a1b66',glassOpacity:.16},
 space:{bg:'#000005',fog:'#02020a',bloom:1.45,model:'#88aaff',edge:'#88ccff',env:'#4466ff',floor:false,grid:false,particles:true,rings:true,grade:'neon',glass:'#334477',glassOpacity:.10},
 industrial:{bg:'#121212',fog:'#1f1f1f',bloom:.8,model:'#999999',edge:'#ffaa00',env:'#ff6600',floor:true,grid:true,particles:false,rings:false,grade:'warm-cinema',glass:'#777777',glassOpacity:.08},
 minimal:{bg:'#f4f4f4',fog:'#f4f4f4',bloom:.25,model:'#d7d7d7',edge:'#555555',env:'#aaaaaa',floor:false,grid:false,particles:false,rings:false,grade:'clean-product',glass:'#ffffff',glassOpacity:.06},
 glass:{bg:'#071018',fog:'#071018',bloom:1.55,model:'#88ccff',edge:'#b8f5ff',env:'#88ccff',floor:true,grid:false,particles:true,rings:true,grade:'cold-tech',glass:'#8fdcff',glassOpacity:.20},
 blueprint:{bg:'#0a1b3c',fog:'#0a1b3c',bloom:.9,model:'#8fd3ff',edge:'#d8f3ff',env:'#4aa3ff',floor:false,grid:true,particles:false,rings:false,grade:'blueprint',glass:'#4a80aa',glassOpacity:.06},
 'dark-showroom':{bg:'#030303',fog:'#080808',bloom:1.2,model:'#ffffff',edge:'#ffffff',env:'#444444',floor:true,grid:false,particles:false,rings:false,grade:'clean-product',glass:'#333333',glassOpacity:.10}
};
let customScenePreset=null;
function applyGradePreset(name){
 const p=gradePresets[name]||gradePresets.none;state.gradePreset=name;
 gradingPass.uniforms.contrast.value=p.contrast;gradingPass.uniforms.saturation.value=p.saturation;
 gradingPass.uniforms.temperature.value=p.temperature;gradingPass.uniforms.tint.value=p.tint;renderer.toneMappingExposure=p.exposure;
 if($('gradeContrast')){$('gradeContrast').value=p.contrast;setText('gradeContrastValue',p.contrast.toFixed(2));}
 if($('gradeSaturation')){$('gradeSaturation').value=p.saturation;setText('gradeSaturationValue',p.saturation.toFixed(2));}
 if($('gradeTemperature')){$('gradeTemperature').value=p.temperature;setText('gradeTemperatureValue',p.temperature.toFixed(2));}
 if($('gradeTint')){$('gradeTint').value=p.tint;setText('gradeTintValue',p.tint.toFixed(2));}
 if($('gradePreset'))$('gradePreset').value=name;saveSoon();
}
function applyScenePresetByName(name){
 const p=name==='custom'?customScenePreset:scenePresets[name];if(!p)return;
 state.scenePreset=name;scene.background.set(p.bg);scene.fog.color.set(p.fog);bloomPass.strength=p.bloom;
 baseUniforms.color.set(p.model);baseUniforms.fresnel.set(p.edge);syncMaterials();
 cubeEdges.material.color.set(p.edge);glassMaterial.color.set(p.glass);state.cubeGlassOpacity=p.glassOpacity;glassMaterial.opacity=p.glassOpacity;
 const ec=new THREE.Color(p.env);crystals.forEach((x,i)=>x.material.color.copy(ec).multiplyScalar(.65+(i%3)*.15));if(particles)particles.material.color.copy(ec);rings.forEach((x,i)=>x.material.color.copy(ec).offsetHSL(i*.1,0,0));
 floor.visible=p.floor;grid.visible=p.grid;particleGroup.visible=p.particles;ringGroup.visible=p.rings;state.particles=p.particles;state.rings=p.rings;
 if($('bgColorPicker'))$('bgColorPicker').value=p.bg;if($('colorPicker'))$('colorPicker').value=p.model;if($('cubeEdgeColor'))$('cubeEdgeColor').value=p.edge;if($('cubeGlassColor'))$('cubeGlassColor').value=p.glass;if($('envColorPicker'))$('envColorPicker').value=p.env;
 if($('cubeGlassOpacity')){$('cubeGlassOpacity').value=p.glassOpacity;setText('cubeGlassValue',p.glassOpacity.toFixed(2));}
 if($('showFloor'))$('showFloor').checked=p.floor;if($('gridToggle'))$('gridToggle').checked=p.grid;if($('particlesToggle'))$('particlesToggle').checked=p.particles;if($('ringsToggle'))$('ringsToggle').checked=p.rings;
 if($('bloomStrength'))$('bloomStrength').value=p.bloom;if($('scenePreset'))$('scenePreset').value=name;
 applyGradePreset(p.grade||'none');saveSoon();
}
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

async function getFont(name){
 if(fontCache.has(name))return fontCache.get(name);
 const font=await new Promise((resolve,reject)=>fontLoader.load(fontUrls[name]||fontUrls.helvetiker,resolve,undefined,reject));
 fontCache.set(name,font);return font;
}
function activeText(){return textObjects.find(x=>x.id===activeTextId)||null;}
function playlistTextItem(obj){return playlist.find(x=>x.type==='text'&&x.textId===obj?.id)||null;}
function hideAllText(exceptId=null){textObjects.forEach(o=>o.group.visible=o.id===exceptId);}
function defaultTextDuration(obj){
 const p=obj.params,letters=Math.max(1,obj.letters?.length||[...(p.text||'')].filter(c=>c!==' ').length);
 const anim=p.animation==='letter-burst'?p.animDuration+Math.max(0,letters-1)*(p.letterDelay??.08):p.animDuration;
 return Math.max(5,Math.ceil(anim+2));
}
function textParamsFromUI(){
 return {
  text:$('textValue')?.value||'Текст',
  font:$('textFont')?.value||'helvetiker',
  size:+($('textSize')?.value||12),
  depth:+($('textDepth')?.value||2),
  glow:+($('textGlow')?.value||1.2),
  color:$('textColor')?.value||'#00ffff',
  animation:$('textAnimation')?.value||'fade',
  animDuration:+($('textAnimDuration')?.value||1.2),
  letterDelay:+($('textLetterDelay')?.value||.08),
  letterDepth:+($('textLetterDepth')?.value||70),
  letterSpin:+($('textLetterSpin')?.value||35),
  letterFlash:+($('textLetterFlash')?.value||1.5),
  x:+($('textX')?.value||0),y:+($('textY')?.value||35),z:+($('textZ')?.value||0),
  faceCamera:$('textFaceCamera')?.checked!==false
 };
}
function disposeTextObject(obj){
 if(!obj)return;
 scene.remove(obj.group);
 obj.mesh?.geometry?.dispose();obj.mesh?.material?.dispose();
 obj.glowMesh?.geometry?.dispose();obj.glowMesh?.material?.dispose();
 obj.letters?.forEach(l=>{l.mesh?.geometry?.dispose();l.mesh?.material?.dispose();l.glow?.geometry?.dispose();l.glow?.material?.dispose();});
 const i=textObjects.indexOf(obj);if(i>=0)textObjects.splice(i,1);
 for(let p=playlist.length-1;p>=0;p--)if(playlist[p].type==='text'&&playlist[p].textId===obj.id)playlist.splice(p,1);
 if(playlistIndex>=playlist.length)playlistIndex=Math.max(0,playlist.length-1);
}
function refreshTextSelect(){
 const s=$('textObjectSelect');if(!s)return;
 s.innerHTML='';
 if(!textObjects.length){const o=document.createElement('option');o.value='';o.textContent='Нет текстовых объектов';s.appendChild(o);activeTextId=null;return;}
 textObjects.forEach(o=>{const op=document.createElement('option');op.value=o.id;op.textContent=o.params.text||('Текст '+o.id);s.appendChild(op);});
 if(!activeTextId||!textObjects.some(o=>o.id===activeTextId))activeTextId=textObjects[0].id;
 s.value=activeTextId;
}
function loadTextUI(obj){
 if(!obj)return;const p=obj.params;
 const vals={textValue:p.text,textFont:p.font,textSize:p.size,textDepth:p.depth,textGlow:p.glow,textColor:p.color,textAnimation:p.animation,textAnimDuration:p.animDuration,textLetterDelay:p.letterDelay??.08,textLetterDepth:p.letterDepth??70,textLetterSpin:p.letterSpin??35,textLetterFlash:p.letterFlash??1.5,textX:p.x,textY:p.y,textZ:p.z};
 Object.entries(vals).forEach(([id,v])=>{if($(id))$(id).value=v;});
 if($('textFaceCamera'))$('textFaceCamera').checked=!!p.faceCamera;
 if($('textSizeValue'))$('textSizeValue').textContent=(+p.size).toFixed(1);
 if($('textDepthValue'))$('textDepthValue').textContent=(+p.depth).toFixed(1);
 if($('textGlowValue'))$('textGlowValue').textContent=(+p.glow).toFixed(2);
 if($('textAnimDurationValue'))$('textAnimDurationValue').textContent=(+p.animDuration).toFixed(1);
 if($('textLetterDelayValue'))$('textLetterDelayValue').textContent=(+(p.letterDelay??.08)).toFixed(2);
 if($('textLetterDepthValue'))$('textLetterDepthValue').textContent=Math.round(p.letterDepth??70);
 if($('textLetterSpinValue'))$('textLetterSpinValue').textContent=Math.round(p.letterSpin??35);
 if($('textLetterFlashValue'))$('textLetterFlashValue').textContent=(+(p.letterFlash??1.5)).toFixed(2);
 ['x','y','z'].forEach(k=>{if($('text'+k.toUpperCase()+'Value'))$('text'+k.toUpperCase()+'Value').textContent=Math.round(p[k]);});
}
async function rebuildTextObject(obj,play=false){
 if(!obj)return;
 const p=obj.params,font=await getFont(p.font);
 if(obj.mesh){obj.group.remove(obj.mesh);obj.mesh.geometry.dispose();obj.mesh.material.dispose();obj.mesh=null;}
 if(obj.glowMesh){obj.group.remove(obj.glowMesh);obj.glowMesh.geometry.dispose();obj.glowMesh.material.dispose();obj.glowMesh=null;}
 if(obj.letters){obj.letters.forEach(l=>{obj.group.remove(l.group);l.mesh.geometry.dispose();l.mesh.material.dispose();l.glow.geometry.dispose();l.glow.material.dispose();});}
 obj.letters=[];
 if(p.animation==='letter-burst'){
  const chars=[...(p.text||'Текст')];
  let cursor=0;
  const letterData=[];
  for(let i=0;i<chars.length;i++){
   const ch=chars[i];
   if(ch===' '){cursor+=p.size*.38;continue;}
   const geo=new TextGeometry(ch,{font,size:p.size,depth:p.depth,curveSegments:8,bevelEnabled:p.depth>0,bevelThickness:Math.min(.35,p.depth*.12),bevelSize:Math.min(.22,p.size*.025),bevelSegments:2});
   geo.computeBoundingBox();
   const box=geo.boundingBox,w=box?box.max.x-box.min.x:p.size*.6;
   if(box)geo.translate(-box.min.x,0,0);
   letterData.push({ch,geo,x:cursor,index:i});
   cursor+=w+p.size*.08;
  }
  const total=cursor;
  letterData.forEach((d,k)=>{
   const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(p.color),emissive:new THREE.Color(p.color),emissiveIntensity:.35+p.glow*.4,metalness:.18,roughness:.28,transparent:true,opacity:1});
   const gm=new THREE.MeshBasicMaterial({color:new THREE.Color(p.color),transparent:true,opacity:.08+p.glow*.08,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide});
   const mesh=new THREE.Mesh(d.geo,mat),glow=new THREE.Mesh(d.geo.clone(),gm);glow.scale.setScalar(1.035+p.glow*.008);
   const g=new THREE.Group();g.add(mesh,glow);g.position.set(d.x-total/2,0,0);
   obj.group.add(g);
   obj.letters.push({group:g,mesh,glow,index:k,baseX:d.x-total/2,baseY:0,baseZ:0,seed:(k%2?1:-1)});
  });
 }else{
  const geo=new TextGeometry(p.text||'Текст',{font,size:p.size,depth:p.depth,curveSegments:8,bevelEnabled:p.depth>0,bevelThickness:Math.min(.35,p.depth*.12),bevelSize:Math.min(.22,p.size*.025),bevelSegments:2});
  geo.computeBoundingBox();const box=geo.boundingBox;
  if(box){const cx=(box.max.x-box.min.x)/2;geo.translate(-cx,0,0);}
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(p.color),emissive:new THREE.Color(p.color),emissiveIntensity:.35+p.glow*.4,metalness:.18,roughness:.28,transparent:true,opacity:1});
  const glowMat=new THREE.MeshBasicMaterial({color:new THREE.Color(p.color),transparent:true,opacity:.08+p.glow*.08,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide});
  const mesh=new THREE.Mesh(geo,mat),glow=new THREE.Mesh(geo.clone(),glowMat);glow.scale.setScalar(1.035+p.glow*.008);
  obj.mesh=mesh;obj.glowMesh=glow;obj.group.add(mesh,glow);
 }
 obj.group.position.set(p.x,p.y,p.z);
 obj.baseY=p.y;obj.animTime=play?0:999;obj.playing=!!play;
}
async function addTextObject(params=textParamsFromUI(),addToPlaylist=true){
 const obj={id:'text-'+textIdSeq++,params:{letterDelay:.08,letterDepth:70,letterSpin:35,letterFlash:1.5,...params},group:new THREE.Group(),mesh:null,glowMesh:null,letters:[],animTime:0,playing:true,baseY:params.y};
 scene.add(obj.group);textObjects.push(obj);activeTextId=obj.id;
 await rebuildTextObject(obj,true);
 if(addToPlaylist){
  playlist.push({name:'✦ '+obj.params.text,type:'text',textId:obj.id,duration:defaultTextDuration(obj),transition:obj.params.animation,appearance:captureAppearance()});
  playlistIndex=playlist.length-1;playlistTimer=0;renderPlaylist();
  showPlaylistItem(playlist[playlistIndex]);
 }
 refreshTextSelect();loadTextUI(obj);return obj;
}
function replayText(obj=activeText()){if(obj){obj.animTime=0;obj.playing=true;if(obj.letters)obj.letters.forEach(l=>{l.group.visible=false;l.group.position.set(l.baseX,l.baseY,l.baseZ-(obj.params.letterDepth||70));l.group.rotation.set(0,0,0);l.group.scale.setScalar(.05);});}}
async function updateActiveText(rebuild=true){
 const obj=activeText();if(!obj)return;
 Object.assign(obj.params,textParamsFromUI());obj.group.position.set(obj.params.x,obj.params.y,obj.params.z);obj.baseY=obj.params.y;
 if(rebuild)await rebuildTextObject(obj,false);
 const pi=playlistTextItem(obj);
 if(pi){pi.name='✦ '+obj.params.text;pi.transition=obj.params.animation;pi.duration=Math.max(pi.duration||0,defaultTextDuration(obj));renderPlaylist();}
 refreshTextSelect();
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

const technicalGroup=new THREE.Group();technicalGroup.visible=false;scene.add(technicalGroup);
let technicalAxesHelper=null,technicalGridHelper=null;
function clearTechnicalOverlay(){
 while(technicalGroup.children.length){
  const o=technicalGroup.children.pop();
  o.geometry?.dispose?.();o.material?.dispose?.();
  if(o.material?.map)o.material.map.dispose();
 }
 technicalAxesHelper=null;technicalGridHelper=null;
}
function unitScale(){
 const u=$('technicalUnits')?.value||'mm';
 return u==='m'?.001:u==='cm'?.1:1;
}
function unitLabel(){
 const u=$('technicalUnits')?.value||'mm';
 return u==='raw'?'ед.':u;
}
function makeTechLabel(text,pos,color=0xbfefff){
 const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
 x.clearRect(0,0,512,128);x.font='700 46px Segoe UI,Arial';x.textAlign='center';x.textBaseline='middle';
 x.strokeStyle='rgba(0,0,0,.85)';x.lineWidth=8;x.strokeText(text,256,64);x.fillStyle='#dff8ff';x.fillText(text,256,64);
 const t=new THREE.CanvasTexture(c),m=new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}),sp=new THREE.Sprite(m);
 sp.position.copy(pos);sp.scale.set(45,11,1);technicalGroup.add(sp);return sp;
}
function lineBetween(a,b,color=0x7dd3fc){
 const g=new THREE.BufferGeometry().setFromPoints([a,b]);
 const m=new THREE.LineBasicMaterial({color,transparent:true,opacity:.9,depthTest:false});
 const l=new THREE.Line(g,m);technicalGroup.add(l);return l;
}
function addDimLine(a,b,axisText,valueText,offsetDir){
 const off=offsetDir.clone();
 const a2=a.clone().add(off),b2=b.clone().add(off);
 lineBetween(a,a2,0x4aa3ff);lineBetween(b,b2,0x4aa3ff);lineBetween(a2,b2,0xbfefff);
 const tick=2.8;
 const dir=new THREE.Vector3().subVectors(b2,a2).normalize();
 const n=new THREE.Vector3(-dir.y,dir.x,dir.z).normalize().multiplyScalar(tick);
 lineBetween(a2.clone().sub(n),a2.clone().add(n),0xffffff);lineBetween(b2.clone().sub(n),b2.clone().add(n),0xffffff);
 if($('technicalLabels')?.checked)makeTechLabel(axisText+' '+valueText,a2.clone().lerp(b2,.5).add(new THREE.Vector3(0,4,0)));
}
function updateTechnicalOverlay(mesh=currentMesh){
 clearTechnicalOverlay();
 if(!mesh||!state.technicalMode){technicalGroup.visible=false;return;}
 technicalGroup.visible=true;
 mesh.geometry.computeBoundingBox();
 const bb=mesh.geometry.boundingBox.clone();
 const sc=mesh.scale.clone();
 const min=bb.min.clone().multiply(sc),max=bb.max.clone().multiply(sc),size=new THREE.Vector3().subVectors(max,min);
 const original=mesh.geometry.userData?.originalSize||{x:size.x,y:size.y,z:size.z};
 const offset=Math.max(size.x,size.y,size.z)*.12+6;
 if($('technicalDimensions')?.checked){
  const mul=unitScale(),ul=unitLabel();
  addDimLine(new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(max.x,min.y,min.z),'X',(original.x*mul).toFixed(1)+' '+ul,new THREE.Vector3(0,-offset,0));
  addDimLine(new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(min.x,max.y,min.z),'Y',(original.y*mul).toFixed(1)+' '+ul,new THREE.Vector3(-offset,0,0));
  addDimLine(new THREE.Vector3(min.x,min.y,min.z),new THREE.Vector3(min.x,min.y,max.z),'Z',(original.z*mul).toFixed(1)+' '+ul,new THREE.Vector3(-offset*.65,-offset*.65,0));
 }
 if($('technicalAxes')?.checked){
  technicalAxesHelper=new THREE.AxesHelper(Math.max(size.x,size.y,size.z)*.7);technicalAxesHelper.position.set(min.x,min.y,min.z);technicalGroup.add(technicalAxesHelper);
 }
 if($('technicalGrid')?.checked){
  const gs=Math.max(size.x,size.z)*1.8,div=20;
  technicalGridHelper=new THREE.GridHelper(gs,div,0x55aaff,0x224466);technicalGridHelper.position.y=min.y-offset*.15;
  technicalGridHelper.material.transparent=true;technicalGridHelper.material.opacity=.55;technicalGroup.add(technicalGridHelper);
 }
 if($('technicalWireframe')?.checked){
  state.wire=true;if($('wireframeToggle'))$('wireframeToggle').checked=true;syncMaterials();
 }
}
function modelBounds(mesh=currentMesh){
 if(!mesh)return null;mesh.geometry.computeBoundingBox();
 const bb=mesh.geometry.boundingBox.clone(),min=bb.min.clone().multiply(mesh.scale),max=bb.max.clone().multiply(mesh.scale);
 const size=new THREE.Vector3().subVectors(max,min),center=new THREE.Vector3().addVectors(min,max).multiplyScalar(.5);
 return {min,max,size,center,maxDim:Math.max(size.x,size.y,size.z)};
}
function chooseAutoView(size){
 const dims=[['x',size.x],['y',size.y],['z',size.z]].sort((a,b)=>b[1]-a[1]);
 if(dims[0][0]==='y')return 'hero';
 if(Math.abs(size.x-size.z)/Math.max(size.x,size.z)<.18)return 'isometric';
 return size.x>=size.z?'hero':'isometric';
}
function applyCameraView(mode='auto',mesh=currentMesh){
 const b=modelBounds(mesh);if(!b)return;
 if(mode==='auto')mode=chooseAutoView(b.size);
 const d=Math.max(80,b.maxDim*2.15),c=b.center;
 let pos;
 if(mode==='front')pos=new THREE.Vector3(c.x,c.y,c.z+d);
 else if(mode==='top')pos=new THREE.Vector3(c.x,c.y+d,c.z+.001);
 else if(mode==='technical')pos=new THREE.Vector3(c.x+d*.95,c.y+d*.72,c.z+d*.95);
 else if(mode==='isometric')pos=new THREE.Vector3(c.x+d*.78,c.y+d*.62,c.z+d*.78);
 else pos=new THREE.Vector3(c.x+d*.92,c.y+d*.55,c.z+d*.68);
 fly=false;controls.enabled=true;camera.position.copy(pos);controls.target.copy(c);camera.lookAt(c);controls.update();
 bokehPass.uniforms.focus.value=camera.position.distanceTo(c);
}
let currentMesh=null,oldMesh=null,transitionState='idle',transitionTime=0,pending=null,transitionFX=null;
const loader=new STLLoader();
function geometryFromBuffer(buf){
 const g=loader.parse(buf);g.computeBoundingBox();
 const box=g.boundingBox,c=new THREE.Vector3(),s=new THREE.Vector3();box.getCenter(c);box.getSize(s);
 g.userData.originalSize={x:s.x,y:s.y,z:s.z};
 g.userData.originalCenter={x:c.x,y:c.y,z:c.z};
 g.translate(-c.x,-c.y,-c.z);const max=Math.max(s.x,s.y,s.z)||1;g.userData.normalizedScale=100/max;g.scale(100/max,100/max,100/max);g.computeVertexNormals();return g;
}
function meshFromBuffer(buf){const mesh=new THREE.Mesh(geometryFromBuffer(buf),makeMaterial());addWire(mesh);mesh.scale.setScalar(state.objectScale);return mesh;}
function applyObjectScale(){
 if(currentMesh)currentMesh.scale.setScalar(state.objectScale);
 if(oldMesh)oldMesh.scale.setScalar(state.objectScale);
 imageCubeGroup.scale.setScalar(state.objectScale);
}
function setObjectScale(value){
 state.objectScale=Math.max(.2,Math.min(3,+value||1));
 if($('objectScale'))$('objectScale').value=state.objectScale;
 if($('objectScaleValue'))$('objectScaleValue').textContent=state.objectScale.toFixed(2);
 applyObjectScale();if(state.technicalMode)updateTechnicalOverlay(currentMesh);
 saveSoon();
}

function disposeTransitionFX(){
 if(!transitionFX)return;
 scene.remove(transitionFX);
 transitionFX.geometry&&transitionFX.geometry.dispose();
 transitionFX.material&&transitionFX.material.dispose();
 transitionFX=null;
}
function sampledPositions(geometry,maxPoints=4500){
 const src=geometry.attributes.position.array,count=Math.min(maxPoints,Math.floor(src.length/3));
 const out=new Float32Array(count*3),step=Math.max(1,Math.floor(src.length/3/count));
 let k=0;
 for(let i=0;i<src.length/3&&k<count;i+=step,k++){
  out[k*3]=src[i*3];out[k*3+1]=src[i*3+1];out[k*3+2]=src[i*3+2];
 }
 return out;
}
function beginTransitionFX(mode){
 disposeTransitionFX();
 if(!oldMesh||!currentMesh)return;
 if(mode==='particles'){
  const base=sampledPositions(oldMesh.geometry),dirs=new Float32Array(base.length);
  for(let i=0;i<base.length;i+=3){
   const v=new THREE.Vector3(base[i],base[i+1],base[i+2]).normalize();
   dirs[i]=v.x*(18+Math.random()*55)+(Math.random()-.5)*18;
   dirs[i+1]=v.y*(18+Math.random()*55)+(Math.random()-.5)*18;
   dirs[i+2]=v.z*(18+Math.random()*55)+(Math.random()-.5)*18;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(base.slice(),3));
  const m=new THREE.PointsMaterial({size:1.5,map:ptex,color:baseUniforms.fresnel.clone(),transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
  transitionFX=new THREE.Points(g,m);transitionFX.userData={mode,base,dirs};transitionFX.rotation.copy(oldMesh.rotation);scene.add(transitionFX);
 }else if(mode==='assemble'){
  const target=sampledPositions(currentMesh.geometry),start=new Float32Array(target.length);
  for(let i=0;i<target.length;i+=3){
   const r=90+Math.random()*120,a=Math.random()*Math.PI*2,z=(Math.random()-.5)*140;
   start[i]=Math.cos(a)*r;start[i+1]=z;start[i+2]=Math.sin(a)*r;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(start.slice(),3));
  const m=new THREE.PointsMaterial({size:1.5,map:ptex,color:baseUniforms.fresnel.clone(),transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
  transitionFX=new THREE.Points(g,m);transitionFX.userData={mode,start,target};transitionFX.rotation.copy(currentMesh.rotation);scene.add(transitionFX);
 }
}
function updateTransitionFX(p,e){
 if(!transitionFX)return;
 const pos=transitionFX.geometry.attributes.position.array,u=transitionFX.userData;
 if(u.mode==='particles'){
  for(let i=0;i<pos.length;i++)pos[i]=u.base[i]+u.dirs[i]*e;
  transitionFX.material.opacity=1-e;
 }else if(u.mode==='assemble'){
  for(let i=0;i<pos.length;i++)pos[i]=THREE.MathUtils.lerp(u.start[i],u.target[i],e);
  transitionFX.material.opacity=1-p*.65;
 }
 transitionFX.geometry.attributes.position.needsUpdate=true;
}
function hideImageCube(){imageCubeGroup.visible=false;cubeTransition=null;imageAdvancePreparing=false;imageCubeGroup.position.set(0,0,0);imageCubeGroup.rotation.set(0,0,0);}
function showSTLItem(file){currentContentType='stl';loadSTL(file,{silent:true,fromCube:imageCubeGroup.visible});}
function cubeNearPosition(){
 const dir=new THREE.Vector3().subVectors(camera.position,controls.target).normalize();
 return dir.multiplyScalar(state.cubeNearDistance);
}
function faceCubeGroupToCamera(){
 imageCubeGroup.rotation.set(0,0,0);
 imageCubeGroup.lookAt(camera.position);
 cubeFacingQ.copy(imageCubeGroup.quaternion);
}
function startCubeApproach(preserveVisible=false){
 faceCubeGroupToCamera();
 if(preserveVisible)setCubeVisualAlpha(1);
 cubeTransition={phase:'approach',time:0,duration:Math.max(.35,Math.min(1.2,playlistInterval*.10)),
  from:imageCubeGroup.position.clone(),to:cubeNearPosition(),preserveVisible};
}
function setFaceTexture(faceIndex,texture){
 const face=imageFacePlanes[faceIndex],mat=face.material;
 if(mat.map)mat.map.dispose();
 mat.map=texture;mat.color.set(0xffffff);mat.needsUpdate=true;face.visible=true;
}
function setCubeVisualAlpha(a){
 const alpha=THREE.MathUtils.clamp(a,0,1);
 glassMaterial.opacity=state.cubeGlassOpacity*alpha;
 cubeEdges.material.opacity=.9*alpha;
 imageFacePlanes.forEach(face=>{if(face.visible)face.material.opacity=alpha;});
}
function sceneBackPosition(distance=state.cubeFarDistance){
 const dir=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
 return dir.multiplyScalar(distance);
}
function sceneFrontPosition(distance=state.cubeNearDistance){
 const dir=new THREE.Vector3().subVectors(camera.position,controls.target).normalize();
 return dir.multiplyScalar(distance);
}
async function prepareNextImageTurn(nextIndex){
 if(imageAdvancePreparing||cubeTransition)return false;
 const item=playlist[nextIndex];
 if(!item||item.type!=='image')return false;
 imageAdvancePreparing=true;
 try{
  const texture=await createFittedImageTexture(item.file,state.imageFitMode);
  let dir=Math.random()<.5?-1:1;
  // Avoid long same-direction streaks, but keep the choice genuinely variable.
  if(dir===lastCubeTurn&&Math.random()<.65)dir=-dir;
  lastCubeTurn=dir;
  const nextStep=(cubeStep+dir+4)%4,sideFaces=[4,0,5,1],nextFace=sideFaces[nextStep];
  setFaceTexture(nextFace,texture);
  const itemDuration=playlist[playlistIndex]?.duration||playlistInterval;
  const available=Math.max(.8,itemDuration-playlistTimer);
  const turnDuration=Math.min(Math.max(.8,state.cubeTurnDuration||2.2),Math.max(.8,available));
  const startQ=imageCube.quaternion.clone(),targetQ=faceQuaternionForStep(nextStep);
  const sourceFace=cubeFaceIndex;
  if(sourceFace!=null&&imageFacePlanes[sourceFace])imageFacePlanes[sourceFace].visible=true;
  if(imageFacePlanes[nextFace])imageFacePlanes[nextFace].visible=true;
  cubeTransition={phase:'exitTurn',time:0,duration:turnDuration,
   from:imageCubeGroup.position.clone(),far:new THREE.Vector3(0,0,0),
   startQ,targetQ,targetIndex:nextIndex,targetStep:nextStep,targetFace:nextFace,sourceFace};
  return true;
 }catch(err){console.error(err);return false;}
 finally{imageAdvancePreparing=false;}
}
function createFittedImageTexture(file,mode='contain',size=2048){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
   ctx.clearRect(0,0,size,size);ctx.fillStyle='rgba(0,0,0,0)';ctx.fillRect(0,0,size,size);
   const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,ir=iw/ih;
   let dw,dh;
   if(mode==='cover'){if(ir>1){dh=size;dw=dh*ir;}else{dw=size;dh=dw/ir;}}
   else{if(ir>1){dw=size;dh=dw/ir;}else{dh=size;dw=dh*ir;}}
   const dx=(size-dw)/2,dy=(size-dh)/2;
   ctx.drawImage(img,dx,dy,dw,dh);
   let rr=0,gg=0,bb=0,samples=0;
   try{
    const sm=document.createElement('canvas');sm.width=sm.height=16;
    const sx=sm.getContext('2d');sx.drawImage(c,0,0,16,16);
    const data=sx.getImageData(0,0,16,16).data;
    for(let i=0;i<data.length;i+=16){if(data[i+3]>32){rr+=data[i];gg+=data[i+1];bb+=data[i+2];samples++;}}
   }catch(e){}
   const avg=samples?new THREE.Color(rr/samples/255,gg/samples/255,bb/samples/255):new THREE.Color(0x00ffff);
   const t=new THREE.CanvasTexture(c);t.userData.averageColor=avg;t.colorSpace=THREE.SRGBColorSpace;
   t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;
   URL.revokeObjectURL(url);resolve(t);
  };
  img.onerror=e=>{URL.revokeObjectURL(url);reject(e);};
  img.src=url;
 });
}
async function preloadItem(index){
 if(!state.preload||!playlist.length)return;
 const item=playlist[index%playlist.length];if(!item||item.type==='text'||item.type==='corridor')return;
 const key=item.type+':'+item.name;
 if(preloadCache.has(key))return;
 try{
  if(item.type==='image'){
   preloadCache.set(key,await createFittedImageTexture(item.file,state.imageFitMode));
  }else{
   const buf=await item.file.arrayBuffer();
   preloadCache.set(key,geometryFromBuffer(buf));
  }
 }catch(e){console.warn('preload',e);}
}
function consumePreloaded(item){
 const key=item.type+':'+item.name,v=preloadCache.get(key);
 if(v)preloadCache.delete(key);
 return v||null;
}
function applyImagePalette(texture){
 if(!state.autoPalette||!texture?.userData?.averageColor)return;
 activeImageAverage.copy(texture.userData.averageColor);
 const c=activeImageAverage.clone();
 cubeEdges.material.color.copy(c.clone().offsetHSL(.08,.15,.2));
 cubeGlow.material.color.copy(c);
 rim2.color.copy(c);
 if(particles)particles.material.color.copy(c);
}
async function showImageItem(file,{silent=true}={}){
 const hadSTL=!!currentMesh;
 if(!silent){$('loading').classList.add('active');$('info').textContent='⏳ Загрузка STL';}
 try{
  const playlistItem=playlist.find(x=>x.file===file);const cached=playlistItem?consumePreloaded(playlistItem):null;const texture=cached||await createFittedImageTexture(file,state.imageFitMode),sideFaces=[4,0,5,1];applyImagePalette(texture);
  if(hadSTL){
   const preparedFace=sideFaces[0];
   cubeStep=0;cubeFaceIndex=preparedFace;setFaceTexture(preparedFace,texture);
   imageCube.rotation.set(0,0,0);imageCubeGroup.rotation.set(0,0,0);
   imageCubeGroup.position.copy(sceneBackPosition(state.cubeFarDistance));
   faceCubeGroupToCamera();
   imageCubeGroup.scale.setScalar(state.objectScale*.82);
   setCubeVisualAlpha(0);imageCubeGroup.visible=true;
   typeTransition={
    kind:'stl-to-cube',time:0,duration:Math.max(.8,state.transition),
    stl:currentMesh,
    stlStartPos:currentMesh.position.clone(),
    stlStartScale:currentMesh.scale.clone(),
    cubeFrom:imageCubeGroup.position.clone(),
    cubeTo:sceneFrontPosition(58),
    fileName:file.name
   };
   currentContentType='transition';
  }else if(!imageCubeGroup.visible){
   currentContentType='image';
   cubeStep=0;cubeFaceIndex=sideFaces[0];setFaceTexture(cubeFaceIndex,texture);
   imageCube.rotation.set(0,0,0);imageCubeGroup.position.set(0,0,0);imageCubeGroup.rotation.set(0,0,0);
   imageCubeGroup.scale.setScalar(state.objectScale);setCubeVisualAlpha(1);imageCubeGroup.visible=true;startCubeApproach();
   hideLabel();$('info').textContent='🖼 '+file.name;
  }else{
   currentContentType='image';
   let dir=Math.random()<.5?-1:1;
   if(dir===lastCubeTurn&&Math.random()<.65)dir=-dir;
   lastCubeTurn=dir;
   const nextStep=(cubeStep+dir+4)%4,nextFace=sideFaces[nextStep];setFaceTexture(nextFace,texture);
   const startQ=imageCube.quaternion.clone(),targetQ=faceQuaternionForStep(nextStep);
   cubeTransition={phase:'manualTurn',time:0,duration:Math.max(.5,state.transition),
    from:imageCubeGroup.position.clone(),far:new THREE.Vector3(0,0,0),
    startQ,targetQ,targetStep:nextStep,targetFace:nextFace};
   hideLabel();$('info').textContent='🖼 '+file.name;
  }
 }catch(err){
  console.error(err);$('info').textContent='❌ Ошибка изображения';
 }
 if(!silent)$('loading').classList.remove('active');
}
let corridorGroup=null,corridorRings=[],corridorParticlesObj=null,corridorTravel=0,corridorPhase=0,corridorActive=false,corridorLastQuality=0,corridorCameraState=null;
function corridorSettingsFromUI(){
 return {
  audioReact:$('corridorAudioReact')?.checked!==false,
  length:+($('corridorLength')?.value||320),
  radius:+($('corridorRadius')?.value||22),
  speed:+($('corridorSpeed')?.value||28),
  bend:+($('corridorBend')?.value||24),
  twist:+($('corridorTwist')?.value||.9),
  segments:+($('corridorSegments')?.value||96),
  color:$('corridorColor')?.value||'#00ffff',
  style:$('corridorStyle')?.value||'neon',
  shape:$('corridorShape')?.value||'circle',
  density:+($('corridorDensity')?.value||1),
  lineWidth:+($('corridorLineWidth')?.value||1),
  shapeWave:+($('corridorShapeWave')?.value||.18),
  sectionSpin:+($('corridorSectionSpin')?.value||.45),
  pulse:$('corridorPulse')?.checked!==false,
  particles:$('corridorParticles')?.checked!==false
 };
}
function syncCorridorState(){
 const p=corridorSettingsFromUI();
 Object.assign(state,{corridorAudioReact:p.audioReact,corridorLength:p.length,corridorRadius:p.radius,corridorSpeed:p.speed,corridorBend:p.bend,corridorTwist:p.twist,corridorSegments:p.segments,corridorColor:p.color,corridorStyle:p.style,corridorShape:p.shape,corridorDensity:p.density,corridorLineWidth:p.lineWidth,corridorShapeWave:p.shapeWave,corridorSectionSpin:p.sectionSpin,corridorPulse:p.pulse,corridorParticles:p.particles});
 return p;
}
function disposeCorridor(restoreCamera=true){
 corridorActive=false;
 if(restoreCamera&&corridorCameraState){camera.position.copy(corridorCameraState.position);camera.quaternion.copy(corridorCameraState.quaternion);controls.target.copy(corridorCameraState.target);controls.enabled=corridorCameraState.controlsEnabled;controls.update();corridorCameraState=null;}
 if(!corridorGroup)return;
 corridorGroup.traverse(o=>{
  o.geometry?.dispose?.();
  if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();
 });
 scene.remove(corridorGroup);corridorGroup=null;corridorRings=[];corridorParticlesObj=null;corridorLastQuality=0;
}
function corridorShapePoints(shape,sides=16){
 const pts=[];
 const add=(x,y)=>pts.push(new THREE.Vector3(x,y,0));
 if(shape==='square'){
  [[1,1],[-1,1],[-1,-1],[1,-1],[1,1]].forEach(p=>add(p[0],p[1]));
 }else if(shape==='diamond'){
  [[0,1],[1,0],[0,-1],[-1,0],[0,1]].forEach(p=>add(p[0],p[1]));
 }else if(shape==='hex'||shape==='oct'){
  const n=shape==='hex'?6:8;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;add(Math.cos(a),Math.sin(a));}
 }else if(shape==='star'){
  const n=10;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2-Math.PI/2,r=i%2===0?1:.48;add(Math.cos(a)*r,Math.sin(a)*r);}
 }else if(shape==='rounded-square'){
  const n=Math.max(16,sides),pow=4;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,c=Math.cos(a),d=Math.sin(a);const x=Math.sign(c)*Math.pow(Math.abs(c),2/pow),y=Math.sign(d)*Math.pow(Math.abs(d),2/pow);add(x,y);}
 }else{
  const n=Math.max(12,sides);for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;add(Math.cos(a),Math.sin(a));}
 }
 return pts;
}
function buildCorridor(force=false){
 const p=syncCorridorState(),recording=normalRecording||stereoRecording;
 const ringCount=Math.max(18,Math.min(recording?42:96,Math.round(p.segments*.58*p.density)));
 const sides=recording?12:18,quality=ringCount*100+sides+Math.round(p.density*10);
 if(!force&&corridorGroup&&corridorLastQuality===quality)return;
 disposeCorridor(false);corridorLastQuality=quality;corridorGroup=new THREE.Group();corridorGroup.name='corridor';
 const baseColor=new THREE.Color(p.color);
 const pts=corridorShapePoints(p.shape,sides);
 for(let i=0;i<ringCount;i++){
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({color:baseColor,transparent:true,opacity:p.style==='blueprint'?.62:.82,depthWrite:false,blending:p.style==='neon'?THREE.AdditiveBlending:THREE.NormalBlending,linewidth:p.lineWidth});
  const line=new THREE.Line(g,mat),holder=new THREE.Group();holder.add(line);holder.userData.index=i;holder.userData.line=line;corridorGroup.add(holder);corridorRings.push(holder);
 }
 const particleCount=recording?140:300,pa=new Float32Array(particleCount*3);
 for(let i=0;i<particleCount;i++){pa[i*3]=(Math.random()-.5)*p.radius*1.6;pa[i*3+1]=(Math.random()-.5)*p.radius*1.6;pa[i*3+2]=-Math.random()*p.length;}
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pa,3));
 const pm=new THREE.PointsMaterial({color:baseColor,size:p.style==='neon'?1.35:.85,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending});
 corridorParticlesObj=new THREE.Points(pg,pm);corridorParticlesObj.visible=p.particles;corridorGroup.add(corridorParticlesObj);
 scene.add(corridorGroup);corridorActive=true;
}
function corridorCenterAt(d,p){
 const q=d/Math.max(1,p.length),w=q*Math.PI*2;
 return new THREE.Vector3(
  Math.sin(w*1.15+corridorPhase*.7)*p.bend+Math.sin(w*2.65+corridorPhase*1.15)*p.bend*.24,
  Math.cos(w*1.45+corridorPhase*.52)*p.bend*.48+Math.sin(w*3.1+corridorPhase*.85)*p.bend*.14,
  -d
 );
}
function showCorridorItem(item){
 if(!corridorCameraState)corridorCameraState={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),controlsEnabled:controls.enabled};
 technicalGroup.visible=false;hideAllText();hideImageCube();disposeTransitionFX();disposeModel(currentMesh);disposeModel(oldMesh);
 currentMesh=oldMesh=null;transitionState='idle';hideLabel();currentContentType='corridor';corridorTravel=0;corridorPhase=0;
 buildCorridor(true);camera.position.set(0,0,24);controls.target.set(0,0,-120);controls.update();$('info').textContent='🌀 Музыкальный коридор';
}
function updateCorridor(dt,t){
 if(!corridorActive||!corridorGroup)return;
 const p=syncCorridorState(),recording=normalRecording||stereoRecording;
 const desired=Math.max(18,Math.min(recording?42:96,Math.round(p.segments*.58*p.density)))*100+(recording?12:18)+Math.round(p.density*10);
 if(desired!==corridorLastQuality)buildCorridor(true);
 const react=p.audioReact&&state.audioReact,bb=react?bass:0,mm=react?mid:0,hh=react?high:0;
 corridorTravel=(corridorTravel+dt*p.speed*(1+bb*.85))%Math.max(1,p.length);
 corridorPhase+=dt*(.42+p.twist*.32+mm*.85);
 const spacing=p.length/Math.max(1,corridorRings.length),zAxis=new THREE.Vector3(0,0,-1),tmpQ=new THREE.Quaternion();
 corridorRings.forEach((holder,i)=>{
  let d=(i*spacing-corridorTravel)%p.length;if(d<0)d+=p.length;
  const c=corridorCenterAt(d,p),n=corridorCenterAt(Math.min(p.length,d+1.2),p),dir=n.sub(c).normalize();
  holder.position.copy(c);tmpQ.setFromUnitVectors(zAxis,dir);holder.quaternion.copy(tmpQ);
  const pulse=p.pulse?(Math.sin(d*.16-corridorPhase*5)*.5+.5):0;
  const wave=1+p.shapeWave*Math.sin(d*.055+corridorPhase*2.1)+bb*.12+mm*.04;
  const radius=p.radius*wave+pulse*(1.2+bb*3.2);
  holder.scale.set(radius,radius,1);
  holder.rotateZ((d/Math.max(1,p.length))*Math.PI*2*p.sectionSpin+Math.sin(corridorPhase+d*.01)*p.twist*.08);
  const line=holder.userData.line,fade=THREE.MathUtils.clamp(1-d/p.length,.12,1);
  line.material.opacity=(p.style==='blueprint'?.45:.62)+fade*.25+bb*.16+pulse*(p.style==='neon'?.18:.06);
  line.material.color.set(p.color);
  if(p.style==='neon')line.material.color.offsetHSL(hh*.08+Math.sin(corridorPhase+d*.01)*.015,0,Math.min(.18,hh*.12+pulse*.06));
 });
 if(corridorParticlesObj){
  corridorParticlesObj.visible=p.particles;corridorParticlesObj.material.color.set(p.color);corridorParticlesObj.material.opacity=.42+bb*.36;
  const arr=corridorParticlesObj.geometry.attributes.position.array;
  for(let i=0;i<arr.length;i+=3){arr[i+2]+=dt*p.speed*(1.2+bb);if(arr[i+2]>8)arr[i+2]-=p.length;arr[i]+=Math.sin(t*1.4+i)*dt*mm*.32;arr[i+1]+=Math.cos(t*1.1+i)*dt*hh*.28;}
  corridorParticlesObj.geometry.attributes.position.needsUpdate=true;
 }
 if(currentContentType==='corridor'){
  camera.position.x=Math.sin(corridorPhase*.36)*2.8+mm*1.8;camera.position.y=Math.cos(corridorPhase*.29)*1.7+hh*.8;camera.position.z=24;
  controls.target.set(Math.sin(corridorPhase*.55)*p.bend*.28,Math.cos(corridorPhase*.42)*p.bend*.16,-120);controls.update();
 }
}
const appearanceIds=['wireframeToggle','bloomToggle','dofToggle','gridToggle','showFloor','doubleSided','bloomStrength','colorPicker','bgColorPicker'];
function captureAppearance(){
 const o={};appearanceIds.forEach(id=>{const e=$(id);if(e)o[id]=e.type==='checkbox'?e.checked:e.value;});return o;
}
function defaultAppearance(){
 return {wireframeToggle:false,bloomToggle:true,dofToggle:true,gridToggle:true,showFloor:true,doubleSided:true,bloomStrength:'1.5',colorPicker:'#0088ff',bgColorPicker:'#050510'};
}
function applyAppearance(o){
 const a={...defaultAppearance(),...(o||{})};
 if($('wireframeToggle'))$('wireframeToggle').checked=!!a.wireframeToggle;
 if($('bloomToggle'))$('bloomToggle').checked=!!a.bloomToggle;
 if($('dofToggle'))$('dofToggle').checked=!!a.dofToggle;
 if($('gridToggle'))$('gridToggle').checked=!!a.gridToggle;
 if($('showFloor'))$('showFloor').checked=!!a.showFloor;
 if($('doubleSided'))$('doubleSided').checked=!!a.doubleSided;
 if($('bloomStrength'))$('bloomStrength').value=a.bloomStrength;
 if($('colorPicker'))$('colorPicker').value=a.colorPicker;
 if($('bgColorPicker'))$('bgColorPicker').value=a.bgColorPicker;
 state.wire=!!a.wireframeToggle;state.doubleSide=!!a.doubleSided;
 bloomPass.enabled=!!a.bloomToggle;bokehPass.enabled=!!a.dofToggle&&!imageCubeGroup.visible;
 grid.visible=!!a.gridToggle;floor.visible=!!a.showFloor;bloomPass.strength=+a.bloomStrength||1.5;
 baseUniforms.color.set(a.colorPicker||'#0088ff');scene.background.set(a.bgColorPicker||'#050510');scene.fog.color.set(a.bgColorPicker||'#050510');
 syncMaterials();
}
function currentPlaylistItem(){return playlist[playlistIndex]||null;}
function ensureAppearance(item){if(item&&!item.appearance)item.appearance=captureAppearance();return item?.appearance||null;}
function saveAppearanceForCurrent(){const item=currentPlaylistItem();if(!item)return;item.appearance=captureAppearance();}
function resetCurrentAppearance(){const item=currentPlaylistItem();if(!item)return;item.appearance=defaultAppearance();applyAppearance(item.appearance);saveSoon();}
function startCubeExitToItem(item){
 if(!item||!imageCubeGroup.visible)return false;
 cubeTransition=null;imageAdvancePreparing=false;
 typeTransition={
  kind:'cube-to-other',time:0,duration:Math.max(1.0,state.transition*1.15),
  cubeFrom:imageCubeGroup.position.clone(),
  cubeTo:sceneBackPosition(Math.max(360,state.cubeFarDistance*1.35)),
  cubeScaleFrom:imageCubeGroup.scale.clone(),
  targetItem:item
 };
 currentContentType='transition';
 return true;
}
function showPlaylistItem(item,{skipCubeExit=false}={}){
 if(!item)return;
 ensureAppearance(item);applyAppearance(item.appearance);
 if(!skipCubeExit&&item.type!=='image'&&item.type!=='stl'&&imageCubeGroup.visible){startCubeExitToItem(item);return;}
 if(item.type==='corridor'){showCorridorItem(item);return;}
 disposeCorridor();
 if(item.type==='text'){
  technicalGroup.visible=false;hideImageCube();disposeTransitionFX();disposeModel(currentMesh);disposeModel(oldMesh);currentMesh=oldMesh=null;transitionState='idle';
  currentContentType='text';hideLabel();
  const obj=textObjects.find(o=>o.id===item.textId);
  if(obj){
   activeTextId=obj.id;hideAllText(obj.id);obj.group.visible=true;replayText(obj);loadTextUI(obj);refreshTextSelect();
   $('info').textContent='✦ 3D-текст: '+obj.params.text;
  }
 }else if(item.type==='image'){
  technicalGroup.visible=false;hideAllText();state.cubeTransitionStyle=item.transition||state.cubeTransitionStyle;showImageItem(item.file,{silent:true});
 }else{
  hideAllText();state.transitionMode=item.transition||state.transitionMode;showSTLItem(item.file);
 }
}
function loadSTL(file,{silent=false,fromCube=false}={}){
 if(!file)return;
 if(transitionState!=='idle'){pending=file;return;}
 if(!silent){$('loading').classList.add('active');$('info').textContent='⏳ Загрузка STL';}
 const item=playlist.find(x=>x.file===file),cachedGeom=item?consumePreloaded(item):null;
 const r=new FileReader();
 r.onload=e=>{
  try{
   const next=cachedGeom?(()=>{const m=new THREE.Mesh(cachedGeom,makeMaterial());addWire(m);m.scale.setScalar(state.objectScale);return m;})():meshFromBuffer(e.target.result);
   if(fromCube&&imageCubeGroup.visible){
    next.material.uniforms.uAlpha.value=0;
    next.position.copy(sceneBackPosition(260));
    next.scale.multiplyScalar(.82);
    scene.add(next);
    typeTransition={
     kind:'cube-to-stl',time:0,duration:Math.max(.8,state.transition),
     stl:next,
     stlFrom:next.position.clone(),
     stlTo:new THREE.Vector3(0,0,0),
     stlTargetScale:new THREE.Vector3(state.objectScale,state.objectScale,state.objectScale),
     cubeFrom:imageCubeGroup.position.clone(),
     cubeTo:sceneBackPosition(Math.max(360,state.cubeFarDistance*1.35)),
     fileName:file.name
    };
    currentContentType='transition';
   }else{
    scene.add(next);
    if(currentMesh){oldMesh=currentMesh;currentMesh=next;transitionState='cross';beginTransitionFX(state.transitionMode);}
    else{currentMesh=next;transitionState='in';}
    currentContentType='stl';
    transitionTime=0;if(state.autoCameraEach)setTimeout(()=>applyCameraView($('cameraPreset')?.value||'auto',next),0);if(state.technicalMode)setTimeout(()=>updateTechnicalOverlay(next),0);hideLabel();
    $('info').textContent='✅ STL | '+Math.round(next.geometry.attributes.position.count/3).toLocaleString()+' треуг.';
    syncMaterials();
   }
  }catch(err){
   console.error(err);$('info').textContent='❌ '+err.message;transitionState='idle';
  }
  if(!silent)$('loading').classList.remove('active');
 };
 r.onerror=()=>{
  if(!silent)$('loading').classList.remove('active');
  transitionState='idle';$('info').textContent='❌ Ошибка чтения STL';
 };
 if(cachedGeom)r.onload({target:{result:null}});else r.readAsArrayBuffer(file);
}
const playlist=[];let playlistIndex=0,playlistPlaying=true,playlistTimer=0,playlistInterval=30;
function renderPlaylist(){
 $('plCount').textContent=playlist.length;$('plList').innerHTML='';$('playlist').style.display=playlist.length?'block':'none';
 playlist.forEach((x,i)=>{
  const d=document.createElement('div');d.className='pl-item'+(i===playlistIndex?' active':'');d.draggable=true;d.dataset.index=i;
  const name=(x.name||'Без названия').replace(/\.stl$/i,'');d.innerHTML='<span>'+(i+1)+'</span><span class="pl-name"></span><span class="remove">✕</span>';
  d.querySelector('.pl-name').textContent=name;
  const meta=document.createElement('span');meta.className='pl-meta';meta.textContent=(x.duration||playlistInterval)+'с';meta.title='Клик — изменить длительность';d.insertBefore(meta,d.querySelector('.remove'));
  meta.onclick=e=>{e.stopPropagation();const v=+prompt('Длительность элемента, секунд',x.duration||playlistInterval);if(Number.isFinite(v)&&v>=1){x.duration=Math.min(600,v);renderPlaylist();}};
  d.oncontextmenu=e=>{e.preventDefault();const modes=x.type==='image'?['fly-turn','dissolve','particles','holo']:x.type==='text'?['fade','scale','rise','type-on','letter-burst']:x.type==='corridor'?['flow','pulse','neon']:['crossfade','particles','wire-scan','assemble'];const pos=Math.max(0,modes.indexOf(x.transition));x.transition=modes[(pos+1)%modes.length];if(x.type==='text'){const o=textObjects.find(o=>o.id===x.textId);if(o){o.params.animation=x.transition;if(o.id===activeTextId){$('textAnimation').value=x.transition;}rebuildTextObject(o,false);}}$('info').textContent='Переход: '+x.transition;};
  d.ondragstart=()=>{d.classList.add('dragging');window.__plDrag=i;};
  d.ondragend=()=>d.classList.remove('dragging');
  d.ondragover=e=>e.preventDefault();
  d.ondrop=e=>{e.preventDefault();const from=window.__plDrag;if(from==null||from===i)return;const [m]=playlist.splice(from,1);playlist.splice(i,0,m);playlistIndex=playlist.indexOf(m);renderPlaylist();};
  d.onclick=e=>{if(e.target.classList.contains('remove'))return;playlistIndex=i;playlistTimer=0;renderPlaylist();showPlaylistItem(x);};
  d.querySelector('.remove').onclick=e=>{e.stopPropagation();const removed=playlist[i];if(removed?.type==='corridor'&&currentContentType==='corridor')disposeCorridor();if(removed?.type==='text'){const o=textObjects.find(o=>o.id===removed.textId);if(o){scene.remove(o.group);o.mesh?.geometry?.dispose();o.mesh?.material?.dispose();o.glowMesh?.geometry?.dispose();o.glowMesh?.material?.dispose();o.letters?.forEach(l=>{l.mesh?.geometry?.dispose();l.mesh?.material?.dispose();l.glow?.geometry?.dispose();l.glow?.material?.dispose();});const ti=textObjects.indexOf(o);if(ti>=0)textObjects.splice(ti,1);}}playlist.splice(i,1);if(playlistIndex>=playlist.length)playlistIndex=Math.max(0,playlist.length-1);refreshTextSelect();renderPlaylist();if(playlist.length)showPlaylistItem(playlist[playlistIndex]);else clearModels();};
  $('plList').appendChild(d);
 });
}
function addFiles(files){
 for(const f of files){
  const n=f.name.toLowerCase();
  if(n.endsWith('.stl'))playlist.push({name:f.name,file:f,type:'stl',duration:playlistInterval,transition:state.transitionMode,appearance:captureAppearance()});
  else if(f.type.startsWith('image/')||/\.(jpg|jpeg|png|webp|gif)$/i.test(n))playlist.push({name:f.name,file:f,type:'image',duration:playlistInterval,transition:state.cubeTransitionStyle,appearance:captureAppearance()});
 }
 renderPlaylist();
 if(!currentMesh&&!imageCubeGroup.visible&&playlist.length)showPlaylistItem(playlist[0]);
}
const directorStyles={
 'hi-tech':{scene:'hi-tech',grade:'cold-tech',stl:['wire-scan','assemble','crossfade'],image:['fly-turn','holo','dissolve'],type:'fly-dissolve',camera:'hero',fx:{vignette:true,film:false,scan:true,rgb:false,chroma:true,glitch:false,motion:false}},
 cyberpunk:{scene:'cyberpunk',grade:'cyberpunk',stl:['particles','wire-scan','assemble'],image:['holo','particles','fly-turn'],type:'holo',camera:'hero',fx:{vignette:true,film:true,scan:true,rgb:true,chroma:true,glitch:true,motion:true}},
 space:{scene:'space',grade:'neon',stl:['assemble','particles','crossfade'],image:['dissolve','holo','fly-turn'],type:'dissolve',camera:'isometric',fx:{vignette:true,film:false,scan:false,rgb:false,chroma:true,glitch:false,motion:true}},
 industrial:{scene:'industrial',grade:'warm-cinema',stl:['wire-scan','crossfade','assemble'],image:['dissolve','fly-turn'],type:'fly-dissolve',camera:'technical',fx:{vignette:true,film:true,scan:false,rgb:false,chroma:false,glitch:false,motion:false}},
 minimal:{scene:'minimal',grade:'clean-product',stl:['crossfade'],image:['dissolve'],type:'dissolve',camera:'isometric',fx:{vignette:false,film:false,scan:false,rgb:false,chroma:false,glitch:false,motion:false}},
 blueprint:{scene:'blueprint',grade:'blueprint',stl:['wire-scan','crossfade'],image:['holo','dissolve'],type:'holo',camera:'technical',fx:{vignette:false,film:false,scan:true,rgb:false,chroma:false,glitch:false,motion:false}},
 'dark-showroom':{scene:'dark-showroom',grade:'clean-product',stl:['crossfade','assemble'],image:['dissolve','fly-turn'],type:'fly-dissolve',camera:'hero',fx:{vignette:true,film:false,scan:false,rgb:false,chroma:false,glitch:false,motion:true}}
};
async function directorAnalyzeItem(item){
 if(item.type==='text')return {item,score:100,kind:'text'};
 if(item.type==='corridor')return {item,score:92,kind:'corridor'};
 if(item.type==='stl'&&item.file){
  try{
   const g=loader.parse(await item.file.arrayBuffer());g.computeBoundingBox();
   const sz=new THREE.Vector3();g.boundingBox.getSize(sz);
   const tris=(g.attributes.position?.count||0)/3,shape=Math.max(sz.x,sz.y,sz.z)/(Math.max(.0001,Math.min(sz.x||1,sz.y||1,sz.z||1)));
   return {item,kind:'stl',score:Math.log10(Math.max(10,tris))*18+Math.min(30,shape*3),tris,size:sz};
  }catch(e){return {item,kind:'stl',score:20};}
 }
 if(item.type==='image'&&item.file){
  try{
   const bmp=await createImageBitmap(item.file),px=bmp.width*bmp.height,aspect=bmp.width/Math.max(1,bmp.height);
   bmp.close?.();return {item,kind:'image',score:Math.log10(Math.max(1000,px))*12+Math.min(15,Math.abs(aspect-1)*4),aspect};
  }catch(e){return {item,kind:'image',score:15};}
 }
 return {item,kind:item.type,score:10};
}
function directorInterleaveItems(analyzed){
 const texts=analyzed.filter(x=>x.kind==='text').sort((a,b)=>b.score-a.score),corridors=analyzed.filter(x=>x.kind==='corridor').sort((a,b)=>b.score-a.score);
 const stls=analyzed.filter(x=>x.kind==='stl').sort((a,b)=>b.score-a.score);
 const imgs=analyzed.filter(x=>x.kind==='image').sort((a,b)=>b.score-a.score);
 const out=[];if(texts.length)out.push(texts.shift());if(corridors.length)out.push(corridors.shift());
 let a=0,b=0,useStl=(stls[0]?.score||0)>=(imgs[0]?.score||0);
 while(a<stls.length||b<imgs.length){
  if(useStl&&a<stls.length)out.push(stls[a++]);else if(!useStl&&b<imgs.length)out.push(imgs[b++]);
  else if(a<stls.length)out.push(stls[a++]);else if(b<imgs.length)out.push(imgs[b++]);
  useStl=!useStl;
 }
 while(corridors.length){const pos=Math.max(1,Math.floor(out.length*.52));out.splice(pos,0,corridors.shift());}while(texts.length){const pos=Math.max(1,Math.floor(out.length*.66));out.splice(pos,0,texts.shift());}
 return out;
}
function applyDirectorFx(style,energy){
 const f=style.fx||{},e=energy/100;
 const setCheck=(id,v)=>{if($(id)){ $(id).checked=!!v; $(id).dispatchEvent(new Event('change')); }};
 setCheck('fxVignette',f.vignette);setCheck('fxFilm',f.film);setCheck('fxScanlines',f.scan);setCheck('fxRgb',f.rgb);setCheck('fxChromatic',f.chroma);setCheck('fxGlitch',f.glitch&&e>.55);setCheck('fxMotion',f.motion&&e>.35);
 if($('fxGlitchAmount')){$('fxGlitchAmount').value=(.18+.55*e).toFixed(2);$('fxGlitchAmount').dispatchEvent(new Event('input'));}
 if($('fxFilmAmount')){$('fxFilmAmount').value=(.08+.22*e).toFixed(2);$('fxFilmAmount').dispatchEvent(new Event('input'));}
 if($('fxChromaticAmount')){$('fxChromaticAmount').value=(.001+.004*e).toFixed(4);$('fxChromaticAmount').dispatchEvent(new Event('input'));}
 if($('fxRgbAmount')){$('fxRgbAmount').value=(.0015+.006*e).toFixed(4);$('fxRgbAmount').dispatchEvent(new Event('input'));}
}
async function runAutoDirector(){
 if(!playlist.length){$('directorStatus').textContent='Сначала добавьте STL, изображения или 3D-текст.';return;}
 const btn=$('directorBuildBtn');btn.textContent='⏳ Анализ...';btn.style.pointerEvents='none';
 try{
  const analyzed=await Promise.all(playlist.map(directorAnalyzeItem));
  const styleName=$('directorStyle').value,style=directorStyles[styleName]||directorStyles['hi-tech'],energy=+$('directorEnergy').value||70;
  const ordered=$('directorInterleave').checked?directorInterleaveItems(analyzed):analyzed.sort((a,b)=>b.score-a.score);
  playlist.splice(0,playlist.length,...ordered.map(x=>x.item));
  const total=($('directorUseMusic').checked&&audioBuffer?.duration)?audioBuffer.duration:(+$('directorDuration').value||60);
  const weights=playlist.map((x,i)=>x.type==='text'?.72:x.type==='corridor'?.82:x.type==='stl'?1.18:1.0);
  const sum=weights.reduce((a,b)=>a+b,0)||1;
  playlist.forEach((item,i)=>{
   item.duration=Math.max(2.5,total*weights[i]/sum);
   if(item.type==='stl')item.transition=style.stl[i%style.stl.length];
   else if(item.type==='image')item.transition=style.image[i%style.image.length];
   else if(item.type==='corridor')item.transition='flow';
   else if(item.type==='text'){const o=textObjects.find(o=>o.id===item.textId);if(o){o.params.animation=energy>65?'letter-burst':'rise';item.transition=o.params.animation;}}
  });
  state.typeTransitionStyle=style.type;if($('typeTransitionStyle'))$('typeTransitionStyle').value=style.type;
  state.autoCameraEach=$('directorAutoCamera').checked;
  if($('cameraPreset'))$('cameraPreset').value=style.camera;
  if($('autoCameraEach')){$('autoCameraEach').classList.toggle('active',state.autoCameraEach);$('autoCameraEach').textContent=state.autoCameraEach?'✓ Auto для каждой STL':'Auto для каждой STL';}
  applyScenePresetByName(style.scene);applyGradePreset(style.grade);
  if($('directorPostFx').checked)applyDirectorFx(style,energy);
  state.transition=Math.max(.65,2.0-energy*.012);if($('transitionDuration')){$('transitionDuration').value=state.transition;setText('transitionDurationValue',state.transition.toFixed(1));}
  state.cubeHoldPercent=Math.round(72-energy*.22);if($('cubeHoldPercent')){$('cubeHoldPercent').value=state.cubeHoldPercent;setText('cubeHoldValue',state.cubeHoldPercent);}
  state.cubeSway=.15+energy*.009;if($('cubeSway')){$('cubeSway').value=state.cubeSway;setText('cubeSwayValue',state.cubeSway.toFixed(2));}
  state.speed=.55+energy*.018;if($('speedSlider')){$('speedSlider').value=state.speed;$('speedSlider').dispatchEvent(new Event('input'));}
  playlistIndex=0;playlistTimer=0;playlistPlaying=false;renderPlaylist();showPlaylistItem(playlist[0]);preloadItem(playlist.length>1?1:0);
  const counts={stl:playlist.filter(x=>x.type==='stl').length,image:playlist.filter(x=>x.type==='image').length,text:playlist.filter(x=>x.type==='text').length,corridor:playlist.filter(x=>x.type==='corridor').length};
  $('directorStatus').textContent=`Готово: ${counts.stl} STL, ${counts.image} фото, ${counts.text} текст, ${counts.corridor} коридор. План ≈ ${total.toFixed(1)}с, стиль ${styleName}.`;
  saveSoon();
 }catch(e){console.error(e);$('directorStatus').textContent='Ошибка Auto Director: '+e.message;}
 finally{btn.textContent='✨ Собрать ролик';btn.style.pointerEvents='';}
}
function nextModel(){if(!playlist.length)return;playlistIndex=(playlistIndex+1)%playlist.length;playlistTimer=0;renderPlaylist();showPlaylistItem(playlist[playlistIndex]);preloadItem((playlistIndex+1)%playlist.length);}
function clearModels(){
 disposeCorridor();disposeTransitionFX();disposeModel(currentMesh);disposeModel(oldMesh);currentMesh=oldMesh=null;transitionState='idle';hideLabel();
 hideImageCube();cubeStep=0;cubeFaceIndex=4;imageCube.rotation.set(0,0,0);imageCubeGroup.position.set(0,0,0);
 imageFacePlanes.forEach(face=>{const m=face.material;if(m.map){m.map.dispose();m.map=null;}face.visible=false;m.needsUpdate=true;});
 currentContentType=null;
}

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

let audioContext=null,analyser=null,audioSource=null,audioBuffer=null,audioData=null,audioPlaying=false,audioStart=0,audioPause=0,bass=0,mid=0,high=0,recordDest=null;
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
 if(!analyser||!audioPlaying||!state.audioReact){bass*=.9;mid*=.9;high*=.9;baseUniforms.audio=bass;return;}
 analyser.getByteFrequencyData(audioData);
 const len=audioData.length,bn=Math.max(1,Math.floor(len*.12)),m0=Math.floor(len*.18),m1=Math.floor(len*.48),h0=Math.floor(len*.58);
 let bs=0,ms=0,hs=0;
 for(let i=0;i<bn;i++)bs+=audioData[i];
 for(let i=m0;i<m1;i++)ms+=audioData[i];
 for(let i=h0;i<len;i++)hs+=audioData[i];
 const bt=Math.min(bs/bn/255*state.audioSens,1),mt=Math.min(ms/Math.max(1,m1-m0)/255*state.audioSens,1),ht=Math.min(hs/Math.max(1,len-h0)/255*state.audioSens,1);
 bass+=(bt-bass)*.3;mid+=(mt-mid)*.22;high+=(ht-high)*.18;
 baseUniforms.audio=bass;innerLight.intensity=2+bass*5+mid*1.5;syncMaterials();
}

const stereoCamera=new THREE.StereoCamera();
let stereoRenderer=null,stereoRecording=false,recordStream=null,stereoRenderCfg=null,stereoNextFrameAt=0,recordPreviewFrame=0,recordRenderer=null,recordRenderCfg=null,recordNextFrameAt=0,normalRecording=false;
function stereoSettings(){
 const res=($('stereoResolution')?.value||'3840x1080').split('x').map(Number);
 return {w:res[0]||3840,h:res[1]||1080,fps:+($('stereoFps')?.value||60),bitrate:+($('stereoBitrate')?.value||24)*1000000,eyeSep:+($('stereoEyeSep')?.value||6.4),focus:+($('stereoFocus')?.value||160),swap:$('stereoSwapEyes')?.checked||false};
}
function ensureStereoRenderer(){
 if(stereoRenderer)return stereoRenderer;
 stereoRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
 stereoRenderer.setPixelRatio(1);stereoRenderer.toneMapping=renderer.toneMapping;stereoRenderer.toneMappingExposure=renderer.toneMappingExposure;
 stereoRenderer.outputColorSpace=renderer.outputColorSpace;
 stereoRenderer.domElement.style.position='fixed';stereoRenderer.domElement.style.left='-10000px';stereoRenderer.domElement.style.top='0';stereoRenderer.domElement.style.width='1px';stereoRenderer.domElement.style.height='1px';stereoRenderer.domElement.style.opacity='0';stereoRenderer.domElement.style.pointerEvents='none';
 document.body.appendChild(stereoRenderer.domElement);return stereoRenderer;
}
function normalRecordSettings(){
 const res=($('recordResolution')?.value||'1920x1080').split('x').map(Number);
 return {w:res[0]||1920,h:res[1]||1080,fps:+($('recordFps')?.value||30),bitrate:+($('recordBitrate')?.value||12)*1000000};
}
function ensureRecordRenderer(){
 if(recordRenderer)return recordRenderer;
 recordRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false,alpha:false});
 recordRenderer.setPixelRatio(1);recordRenderer.toneMapping=renderer.toneMapping;recordRenderer.toneMappingExposure=renderer.toneMappingExposure;recordRenderer.outputColorSpace=renderer.outputColorSpace;
 recordRenderer.domElement.style.position='fixed';recordRenderer.domElement.style.left='-10000px';recordRenderer.domElement.style.top='0';recordRenderer.domElement.style.width='1px';recordRenderer.domElement.style.height='1px';recordRenderer.domElement.style.opacity='0';recordRenderer.domElement.style.pointerEvents='none';
 document.body.appendChild(recordRenderer.domElement);return recordRenderer;
}
function configureRecordRenderer(cfg){
 const rr=ensureRecordRenderer();
 if(!recordRenderCfg||recordRenderCfg.w!==cfg.w||recordRenderCfg.h!==cfg.h)rr.setSize(cfg.w,cfg.h,false);
 recordRenderCfg={...cfg};recordNextFrameAt=0;
}
function renderNormalRecordFrame(now=performance.now()){
 if(!normalRecording||!recordRenderer||!recordRenderCfg)return;
 const cfg=recordRenderCfg,frameMs=1000/Math.max(1,cfg.fps);if(now<recordNextFrameAt)return;recordNextFrameAt=now+frameMs;
 const prevAspect=camera.aspect;camera.aspect=cfg.w/cfg.h;camera.updateProjectionMatrix();
 recordRenderer.render(scene,camera);
 camera.aspect=prevAspect;camera.updateProjectionMatrix();
}
function configureStereoRenderer(cfg){
 const r=ensureStereoRenderer();
 if(!stereoRenderCfg||stereoRenderCfg.w!==cfg.w||stereoRenderCfg.h!==cfg.h){
  r.setSize(cfg.w,cfg.h,false);
 }
 stereoRenderCfg={...cfg};
}
function renderStereoFrame(now=performance.now()){
 if(!stereoRecording||!stereoRenderer||!stereoRenderCfg)return;
 const cfg=stereoRenderCfg,frameMs=1000/Math.max(1,cfg.fps);
 if(now<stereoNextFrameAt)return;
 stereoNextFrameAt=now+frameMs;
 const half=Math.floor(cfg.w/2);
 stereoRenderer.setScissorTest(true);stereoRenderer.autoClear=false;stereoRenderer.clear();
 const prevAspect=camera.aspect,prevFocus=camera.focus;
 camera.aspect=half/cfg.h;camera.focus=cfg.focus;camera.updateProjectionMatrix();
 stereoCamera.eyeSep=cfg.eyeSep;stereoCamera.update(camera);
 const left=cfg.swap?stereoCamera.cameraR:stereoCamera.cameraL,right=cfg.swap?stereoCamera.cameraL:stereoCamera.cameraR;
 stereoRenderer.setViewport(0,0,half,cfg.h);stereoRenderer.setScissor(0,0,half,cfg.h);stereoRenderer.render(scene,left);
 stereoRenderer.setViewport(half,0,cfg.w-half,cfg.h);stereoRenderer.setScissor(half,0,cfg.w-half,cfg.h);stereoRenderer.render(scene,right);
 stereoRenderer.setScissorTest(false);stereoRenderer.autoClear=true;
 camera.aspect=prevAspect;camera.focus=prevFocus;camera.updateProjectionMatrix();
}
let recorder=null,chunks=[],recStart=0,recTimer=null;
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');}
function startRecording(){
 const useStereo=$('stereoRecord')?.checked===true,cfg=stereoSettings(),normalCfg=normalRecordSettings();
 let sourceCanvas,fps,bitrate;
 stereoRecording=useStereo;normalRecording=!useStereo;
 if(useStereo){configureStereoRenderer(cfg);renderStereoFrame(performance.now());sourceCanvas=ensureStereoRenderer().domElement;fps=cfg.fps;bitrate=cfg.bitrate;}
 else{configureRecordRenderer(normalCfg);renderNormalRecordFrame(performance.now());sourceCanvas=ensureRecordRenderer().domElement;fps=normalCfg.fps;bitrate=normalCfg.bitrate;}
 const stream=sourceCanvas.captureStream(fps);recordStream=stream;
 if(analyser&&audioPlaying&&audioContext){try{if(recordDest)analyser.disconnect(recordDest);}catch(e){}recordDest=audioContext.createMediaStreamDestination();analyser.connect(recordDest);const t=recordDest.stream.getAudioTracks()[0];if(t)stream.addTrack(t);}
 const list=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 const mime=list.find(x=>MediaRecorder.isTypeSupported(x))||'video/webm';chunks=[];
 recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{
  const b=new Blob(chunks,{type:'video/webm'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=(useStereo?'minired-stereo-sbs-':'stl-clip-')+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  if(recordDest&&analyser)try{analyser.disconnect(recordDest);}catch(e){}recordDest=null;
  stream.getTracks().forEach(t=>t.stop());recordStream=null;stereoRecording=false;normalRecording=false;stereoNextFrameAt=0;recordNextFrameAt=0;
 };
 recorder.start(100);recStart=Date.now();$('recordBtn').classList.add('recording');$('recordBtn').textContent=useStereo?'⏹ Остановить Stereo запись':'⏹ Остановить запись';$('rec').classList.add('active');
 recTimer=setInterval(()=>{$('recTime').textContent=fmt((Date.now()-recStart)/1000);},200);
}
function stopRecording(){if(recorder&&recorder.state!=='inactive')recorder.stop();$('recordBtn').classList.remove('recording');$('recordBtn').textContent='⏺ Запись клипа';$('rec').classList.remove('active');clearInterval(recTimer);stereoRecording=false;normalRecording=false;}

function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
const clock=new THREE.Clock(),look=new THREE.Vector3();
function animate(){
 const dt=clock.getDelta(),t=clock.elapsedTime;scanlinePass.uniforms.time.value=t;filmPass.uniforms.time.value=t;
 if(transitionState==='cross'){
  transitionTime+=dt;const p=Math.min(transitionTime/Math.max(state.transition,.05),1),e=ease(p);
  const mode=state.transitionMode;
  if(mode==='crossfade'){
   if(oldMesh){oldMesh.material.uniforms.uAlpha.value=1-e;const w=oldMesh.getObjectByName('wire');if(w)w.material.opacity=.72*(1-e);}
   if(currentMesh){currentMesh.material.uniforms.uAlpha.value=e;const w=currentMesh.getObjectByName('wire');if(w)w.material.opacity=.72*e;}
  }else if(mode==='particles'){
   if(oldMesh){oldMesh.material.uniforms.uAlpha.value=Math.max(0,1-p*1.8);const w=oldMesh.getObjectByName('wire');if(w)w.material.opacity=.72*Math.max(0,1-p*1.6);}
   if(currentMesh){currentMesh.material.uniforms.uAlpha.value=Math.max(0,(p-.25)/.75);currentMesh.scale.setScalar(.92+.08*e);}
   updateTransitionFX(p,e);
  }else if(mode==='wire-scan'){
   if(oldMesh){oldMesh.material.uniforms.uAlpha.value=1-e;const w=oldMesh.getObjectByName('wire');if(w){w.visible=true;w.material.opacity=(1-p)*1.2;w.material.color.set(0xffffff);}}
   if(currentMesh){currentMesh.material.uniforms.uAlpha.value=Math.min(1,p*1.25);const w=currentMesh.getObjectByName('wire');if(w){w.visible=true;w.material.opacity=Math.sin(Math.PI*p)*1.35+.18;w.material.color.copy(baseUniforms.fresnel);}currentMesh.scale.set(1,.82+.18*e,1);}
  }else if(mode==='assemble'){
   if(oldMesh)oldMesh.material.uniforms.uAlpha.value=Math.max(0,1-p*2.2);
   if(currentMesh){currentMesh.material.uniforms.uAlpha.value=Math.max(0,(p-.55)/.45);currentMesh.scale.setScalar(.72+.28*e);}
   updateTransitionFX(p,e);
  }
  if(p>=1){
   disposeTransitionFX();
   if(currentMesh){currentMesh.scale.set(1,1,1);currentMesh.material.uniforms.uAlpha.value=1;}
   disposeModel(oldMesh);oldMesh=null;transitionState='idle';syncMaterials();
   if(pending){const f=pending;pending=null;setTimeout(()=>loadSTL(f,{silent:true}),0);}
  }
 }else if(transitionState==='in'){
  transitionTime+=dt;const p=Math.min(transitionTime/Math.max(state.transition/2,.05),1),e=ease(p);if(currentMesh)currentMesh.material.uniforms.uAlpha.value=e;
  if(p>=1){transitionState='idle';if(pending){const f=pending;pending=null;setTimeout(()=>loadSTL(f,{silent:true}),0);}}
 }
 if(typeTransition){
  typeTransition.time+=dt;
  const p=Math.min(typeTransition.time/Math.max(.05,typeTransition.duration),1),e=ease(p);
  if(typeTransition.kind==='cube-to-other'){
   const outP=Math.min(1,p/.9),fadeP=Math.min(1,p/.72);
   imageCubeGroup.position.lerpVectors(typeTransition.cubeFrom,typeTransition.cubeTo,ease(outP));
   const shrink=1-.28*ease(outP);
   imageCubeGroup.scale.copy(typeTransition.cubeScaleFrom).multiplyScalar(shrink);
   setCubeVisualAlpha(1-ease(fadeP));
   imageCube.rotation.y+=dt*.28;
   if(p>=1){
    const target=typeTransition.targetItem;
    hideImageCube();setCubeVisualAlpha(1);imageCubeGroup.scale.setScalar(state.objectScale);imageCubeGroup.scale.setScalar(state.objectScale);
    typeTransition=null;currentContentType=null;
    showPlaylistItem(target,{skipCubeExit:true});
   }
  }else if(typeTransition.kind==='cube-to-stl'){
   const outP=Math.min(1,p/.48),inP=p<.32?0:Math.min(1,(p-.32)/.68),style=state.typeTransitionStyle;
   imageCubeGroup.position.lerpVectors(typeTransition.cubeFrom,typeTransition.cubeTo,ease(outP));
   imageCubeGroup.scale.setScalar(state.objectScale*(1-.24*ease(outP)));
   setCubeVisualAlpha(style==='dissolve'?1-ease(Math.min(1,p/.72)):style==='holo'?Math.max(0,1-ease(outP))*(.55+.45*Math.abs(Math.cos(p*Math.PI*8))):1-ease(outP));
   const m=typeTransition.stl;
   m.position.lerpVectors(typeTransition.stlFrom,typeTransition.stlTo,ease(inP));
   const s=.82+(1-.82)*ease(inP);m.scale.copy(typeTransition.stlTargetScale).multiplyScalar(s);
   m.material.uniforms.uAlpha.value=style==='holo'?ease(inP)*(.65+.35*Math.abs(Math.cos(p*Math.PI*7))):ease(inP);
   if(p>=1){
    hideImageCube();setCubeVisualAlpha(1);
    currentMesh=m;oldMesh=null;transitionState='idle';currentContentType='stl';if(state.autoCameraEach)setTimeout(()=>applyCameraView($('cameraPreset')?.value||'auto',m),0);if(state.technicalMode)setTimeout(()=>updateTechnicalOverlay(m),0);
    m.position.set(0,0,0);m.scale.copy(typeTransition.stlTargetScale);m.material.uniforms.uAlpha.value=1;
    hideLabel();$('info').textContent='✅ '+typeTransition.fileName;
    typeTransition=null;syncMaterials();
   }
  }else if(typeTransition.kind==='stl-to-cube'){
   const outP=Math.min(1,p/.48),inP=p<.32?0:Math.min(1,(p-.32)/.68);
   const m=typeTransition.stl,style=state.typeTransitionStyle;
   const stlBack=sceneBackPosition(state.cubeFarDistance);
   m.position.lerpVectors(typeTransition.stlStartPos,stlBack,ease(outP));
   const ss=1-.18*ease(outP);m.scale.copy(typeTransition.stlStartScale).multiplyScalar(ss);
   m.material.uniforms.uAlpha.value=1-ease(outP);
   imageCubeGroup.position.lerpVectors(typeTransition.cubeFrom,typeTransition.cubeTo,ease(inP));
   imageCubeGroup.scale.setScalar(state.objectScale*(.82+.18*ease(inP)));
   imageCubeGroup.lookAt(camera.position);
   cubeFacingQ.copy(imageCubeGroup.quaternion);
   imageCube.quaternion.set(0,0,0,1);
   setCubeVisualAlpha(ease(inP));
   if(p>=1){
    disposeModel(m);currentMesh=null;oldMesh=null;transitionState='idle';currentContentType='image';
    imageCubeGroup.position.copy(typeTransition.cubeTo);imageCubeGroup.scale.setScalar(state.objectScale);imageCube.quaternion.set(0,0,0,1);faceCubeGroupToCamera();setCubeVisualAlpha(1);
    hideLabel();$('info').textContent='🖼 Изображение';
    typeTransition=null;
   }
  }
 }
 if(cubeTransition){
  cubeTransition.time+=dt;
  const p=Math.min(cubeTransition.time/Math.max(.05,cubeTransition.duration),1),e=ease(p);
  if(cubeTransition.phase==='approach'){
   imageCubeGroup.position.lerpVectors(cubeTransition.from,cubeTransition.to,e);
   if(cubeTransition.preserveVisible)setCubeVisualAlpha(1);else setCubeVisualAlpha(e);
   if(p>=1){imageCubeGroup.position.copy(cubeTransition.to);setCubeVisualAlpha(1);cubeTransition=null;}
  }else if(cubeTransition.phase==='exitTurn'||cubeTransition.phase==='manualTurn'){
   const style=state.cubeTransitionStyle;
   // Keep image faces visible during a 90-degree turn. Fading the whole cube caused
   // a visible black/empty frame while the edge was facing the camera.
   imageFacePlanes.forEach(face=>{if(face.visible)face.material.opacity=1;});
   glassMaterial.opacity=state.cubeGlassOpacity;
   if(style==='dissolve'){
    cubeEdges.material.opacity=.72+.18*Math.sin(Math.PI*p);
   }else if(style==='particles'){
    cubeEdges.material.opacity=.62+.28*Math.sin(Math.PI*p);
   }else if(style==='holo'){
    cubeEdges.material.opacity=Math.min(1,.72+.22*Math.sin(p*Math.PI*10));
    glassMaterial.opacity=state.cubeGlassOpacity*(.82+.18*Math.abs(Math.cos(Math.PI*p*4)));
   }else{
    cubeEdges.material.opacity=.9;
   }

   const retreatP=Math.min(1,p/.55),turnP=THREE.MathUtils.smoothstep(p,.08,.96);
   imageCubeGroup.position.lerpVectors(cubeTransition.from,cubeTransition.far,ease(retreatP));
   imageCube.quaternion.copy(cubeTransition.startQ).slerp(cubeTransition.targetQ,turnP);
   if(p>=1){
    imageCube.quaternion.copy(cubeTransition.targetQ);setCubeVisualAlpha(1);cubeStep=cubeTransition.targetStep;cubeFaceIndex=cubeTransition.targetFace;
    const automatic=cubeTransition.phase==='exitTurn',targetIndex=cubeTransition.targetIndex;
    imageCubeGroup.position.set(0,0,0);imageCube.rotation.x=0;imageCube.rotation.z=0;cubeTransition=null;
    if(automatic){
     playlistIndex=targetIndex;playlistTimer=0;renderPlaylist();preloadItem((playlistIndex+1)%playlist.length);hideLabel();
     $('info').textContent='🖼 Изображение';
    }
    startCubeApproach(true);
   }
  }
 }
 if(label){
  labelHold+=dt;
  if(labelHold<5)labelAlpha+=(1-labelAlpha)*Math.min(dt*3,1);else labelAlpha+=(0-labelAlpha)*Math.min(dt*2,1);
  label.material.opacity=labelAlpha;
  if(currentContentType==='image'&&imageCubeGroup.visible){
   const toCam=new THREE.Vector3().subVectors(camera.position,imageCubeGroup.position).normalize();
   const camRight=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();
   const camUp=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();
   label.position.copy(imageCubeGroup.position)
    .addScaledVector(toCam,6)
    .addScaledVector(camUp,-58+Math.sin(t*1.5)*2);
   label.quaternion.copy(camera.quaternion);
   label.scale.set(135,29,1);
  }else{
   label.position.set(0,-58+Math.sin(t*1.5)*2,0);
   label.quaternion.copy(camera.quaternion);
   label.scale.set(160,34,1);
  }
 }
 if(playlist.length>1&&playlistPlaying&&(currentMesh||imageCubeGroup.visible||currentContentType==='text'||currentContentType==='corridor')&&transitionState==='idle'&&!typeTransition){
  if(currentContentType==='image'&&imageCubeGroup.visible){
   const itemDuration=playlist[playlistIndex]?.duration||playlistInterval;playlistTimer+=dt;$('plTimer').textContent=Math.max(0,itemDuration-playlistTimer).toFixed(1)+'с';
   const nextIndex=(playlistIndex+1)%playlist.length,nextItem=playlist[nextIndex];
   if(playlistTimer>=(playlist[playlistIndex]?.duration||playlistInterval)*(state.cubeHoldPercent/100)&&!cubeTransition&&!imageAdvancePreparing&&nextItem&&nextItem.type==='image'){
    prepareNextImageTurn(nextIndex);
   }else if(playlistTimer>=(playlist[playlistIndex]?.duration||playlistInterval)&&!cubeTransition&&!imageAdvancePreparing){
    nextModel();
   }
  }else if(!cubeTransition){
   const itemDuration=playlist[playlistIndex]?.duration||playlistInterval;
   playlistTimer+=dt;$('plTimer').textContent=Math.max(0,itemDuration-playlistTimer).toFixed(1)+'с';
   if(playlistTimer>=itemDuration)nextModel();
  }
 }else $('plTimer').textContent='—';
 if(fly&&flyPath){flyTime+=dt;const q=(flyTime/14)%1;camera.position.copy(flyPath.getPointAt(q));look.y=Math.sin(q*Math.PI*4)*15;camera.lookAt(look);bokehPass.uniforms.focus.value=camera.position.distanceTo(look);}else controls.update();
 if(currentMesh&&state.autoRotate&&!state.rotPaused){const a=dt*.15*state.speed;[currentMesh,oldMesh].filter(Boolean).forEach(m=>m.rotation[state.axis]+=a);}
 if(imageCubeGroup.visible){
  const sway=state.cubeSway*.01;
  if(!cubeTransition&&!typeTransition){
   const eul=new THREE.Euler(Math.sin(t*.65)*sway,0,Math.cos(t*.52)*sway*.85,'XYZ');
   cubeSwayQ.setFromEuler(eul);
   imageCubeGroup.quaternion.copy(cubeFacingQ).multiply(cubeSwayQ);
  }
  cubeGlow.visible=true;
  const dist=imageCubeGroup.position.length();
  cubeGlow.material.opacity=.05+Math.max(0,1-dist/180)*.14;
  cubeGlow.scale.setScalar(1+dist/300);
 }else cubeGlow.visible=false;
 textObjects.forEach(obj=>{
  const p=obj.params;
  if(p.faceCamera)obj.group.quaternion.copy(camera.quaternion);
  if(obj.playing){
   obj.animTime+=dt;const q=Math.min(1,obj.animTime/Math.max(.05,p.animDuration)),e=ease(q);
   if(p.animation==='fade'){
    if(obj.mesh)obj.mesh.material.opacity=e;if(obj.glowMesh)obj.glowMesh.material.opacity=(.08+p.glow*.08)*e;
    obj.group.scale.setScalar(1);
   }else if(p.animation==='scale'){
    obj.group.scale.setScalar(.05+.95*e);if(obj.mesh)obj.mesh.material.opacity=e;if(obj.glowMesh)obj.glowMesh.material.opacity=(.08+p.glow*.08)*e;
   }else if(p.animation==='rise'){
    obj.group.position.y=obj.baseY-22*(1-e);if(obj.mesh)obj.mesh.material.opacity=e;if(obj.glowMesh)obj.glowMesh.material.opacity=(.08+p.glow*.08)*e;
   }else if(p.animation==='type-on'){
    obj.group.scale.set(e,1,1);if(obj.mesh)obj.mesh.material.opacity=Math.min(1,q*2);if(obj.glowMesh)obj.glowMesh.material.opacity=(.08+p.glow*.08)*Math.min(1,q*2);
   }else if(p.animation==='letter-burst'){
    const delay=p.letterDelay??.08,fly=Math.max(.15,p.animDuration);
    obj.letters.forEach((l,i)=>{
     const lp=THREE.MathUtils.clamp((obj.animTime-i*delay)/fly,0,1),le=ease(lp);
     l.group.visible=lp>0;
     l.group.position.set(l.baseX,l.baseY,l.baseZ-(p.letterDepth??70)*(1-le));
     const spin=THREE.MathUtils.degToRad(p.letterSpin??35);
     l.group.rotation.set((1-le)*spin*.35*l.seed,(1-le)*spin*l.seed,(1-le)*spin*.2);
     l.group.scale.setScalar(.15+.85*le);
     l.mesh.material.opacity=le;
     const flash=Math.sin(Math.PI*lp)*(p.letterFlash??1.5);
     l.mesh.material.emissiveIntensity=.35+p.glow*.4+flash;
     l.glow.material.opacity=(.08+p.glow*.08)*le+flash*.12;
     l.glow.scale.setScalar(1.035+p.glow*.008+flash*.04);
    });
   }
   const totalTime=p.animation==='letter-burst'?Math.max(.05,p.animDuration)+(Math.max(0,(obj.letters?.length||1)-1)*(p.letterDelay??.08)):Math.max(.05,p.animDuration);
   if(obj.animTime>=totalTime){obj.playing=false;obj.group.scale.setScalar(1);obj.group.position.y=obj.baseY;if(obj.mesh)obj.mesh.material.opacity=1;if(obj.glowMesh)obj.glowMesh.material.opacity=.08+p.glow*.08;if(obj.letters)obj.letters.forEach(l=>{l.group.visible=true;l.group.position.set(l.baseX,l.baseY,l.baseZ);l.group.rotation.set(0,0,0);l.group.scale.setScalar(1);l.mesh.material.opacity=1;l.mesh.material.emissiveIntensity=.35+p.glow*.4;l.glow.material.opacity=.08+p.glow*.08;l.glow.scale.setScalar(1.035+p.glow*.008);});}
  }
 });
  rim1.intensity=4+Math.sin(t*1.5)*1.5;rim2.intensity=4+Math.cos(t*1.8)*1.5;
 const mult=1+(state.audioReact&&state.envReact?bass*3:0),de=dt*state.envSpeed;
 if(state.env)crystals.forEach((c,i)=>{const u=c.userData;c.rotation.x+=u.rs*de*60;c.rotation.y+=u.rs*de*45;u.a+=u.os*de;c.position.set(Math.cos(u.a)*u.r,u.y+Math.sin(t*u.b+i)*u.ba,Math.sin(u.a)*u.r);c.scale.setScalar(1+(state.audioReact&&state.envReact?bass*.8:0));c.material.opacity=Math.min(u.op*mult,1);});
 if(state.particles&&particles){const p=particles.geometry.attributes.position.array;for(let i=0;i<particleCount;i++){const j=i*3;p[j]+=vel[j]*de*60;p[j+1]+=vel[j+1]*de*60;p[j+2]+=vel[j+2]*de*60;const x=p[j],z=p[j+2],a=de*.05,c=Math.cos(a),s=Math.sin(a);p[j]=x*c-z*s;p[j+2]=x*s+z*c;if(Math.hypot(p[j],p[j+1],p[j+2])>300){p[j]=(Math.random()-.5)*180;p[j+1]=(Math.random()-.5)*180;p[j+2]=(Math.random()-.5)*180;}}particles.geometry.attributes.position.needsUpdate=true;particles.material.size=1.5*mult;}
 if(state.rings)rings.forEach(r=>r.rotation.z=r.userData.base+t*r.userData.speed*state.envSpeed);
 updateAudio();
 if(imageCubeGroup.visible){
  const beat=state.audioReact&&state.cubeBassEdges?bass:0;
  const sweep=state.cubeEdgeSweep?(.12+.18*(.5+.5*Math.sin(t*4.2))+high*.22):0;
  cubeEdges.material.opacity=Math.min(1,.45*state.cubeEdgeIntensity+beat*.42+sweep);
  const edgeBase=new THREE.Color($('cubeEdgeColor')?.value||'#00ffff');
  cubeEdges.material.color.copy(edgeBase).offsetHSL(mid*.04,0,mid*.08).lerp(new THREE.Color(0xffffff),Math.min(.75,beat*.5+sweep*.35+high*.25));
  if(state.parallax&&cubeFaceIndex!=null&&imageFacePlanes[cubeFaceIndex]?.material?.map){
   const tex=imageFacePlanes[cubeFaceIndex].material.map;
   tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
   tex.offset.x=Math.sin(t*.35)*.006*state.cubeSway;
   tex.offset.y=Math.cos(t*.31)*.004*state.cubeSway;
  }
  if(state.cameraDolly&&!typeTransition&&!cubeTransition){
   if(!cameraDollyBase)cameraDollyBase=camera.position.clone();
   const dir=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
   const target=cameraDollyBase.clone().addScaledVector(dir,4);
   camera.position.lerp(target,Math.min(1,dt*1.5));
  }
  bokehPass.enabled=false;
 }else{
  if(cameraDollyBase){camera.position.lerp(cameraDollyBase,Math.min(1,dt*2));if(camera.position.distanceTo(cameraDollyBase)<.1)cameraDollyBase=null;}

  bokehPass.enabled=$('dofToggle').checked;
 }
 updateCorridor(dt,t);
 const recPerf=(stereoRecording&&$('stereoPerformanceMode')?.checked)||(normalRecording&&$('recordPerformanceMode')?.checked);
 if(recPerf){recordPreviewFrame++;if(recordPreviewFrame%2===0)renderer.render(scene,camera);}else composer.render();
 const now=performance.now();renderStereoFrame(now);renderNormalRecordFrame(now);
}
renderer.setAnimationLoop(animate);

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
$('colorPicker').oninput=e=>{baseUniforms.color.set(e.target.value);syncMaterials();saveAppearanceForCurrent();saveSoon();};
$('bgColorPicker').oninput=e=>{scene.background.set(e.target.value);scene.fog.color.set(e.target.value);saveAppearanceForCurrent();saveSoon();};
$('autoRotateToggle').onchange=e=>{state.autoRotate=e.target.checked;saveSoon();};
document.querySelectorAll('.axis').forEach(b=>b.onclick=()=>{document.querySelectorAll('.axis').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.axis=b.dataset.axis;saveSoon();});
$('speedSlider').oninput=e=>{state.speed=+e.target.value;setText('speedValue',Math.abs(state.speed).toFixed(1));$('directionLabel').textContent=state.speed<0?'↺':state.speed>0?'↻':'⏸';saveSoon();};
$('cubeSpinSpeed').oninput=e=>{state.cubeSpinSpeed=+e.target.value;setText('cubeSpinSpeedValue',state.cubeSpinSpeed.toFixed(2));saveSoon();};
$('cubeTurnDuration').oninput=e=>{state.cubeTurnDuration=+e.target.value;setText('cubeTurnDurationValue',state.cubeTurnDuration.toFixed(1));saveSoon();};
$('imageFitMode').onchange=e=>{state.imageFitMode=e.target.value;preloadCache.clear();saveSoon();};
$('cubeTransitionStyle').onchange=e=>{state.cubeTransitionStyle=e.target.value;saveSoon();};
$('cubeHoldPercent').oninput=e=>{state.cubeHoldPercent=+e.target.value;setText('cubeHoldValue',state.cubeHoldPercent);saveSoon();};
$('cubeNearDistance').oninput=e=>{state.cubeNearDistance=+e.target.value;setText('cubeNearValue',state.cubeNearDistance);saveSoon();};
$('cubeFarDistance').oninput=e=>{state.cubeFarDistance=+e.target.value;setText('cubeFarValue',state.cubeFarDistance);saveSoon();};
$('cubeSway').oninput=e=>{state.cubeSway=+e.target.value;setText('cubeSwayValue',state.cubeSway.toFixed(2));saveSoon();};
$('cubeGlassOpacity').oninput=e=>{state.cubeGlassOpacity=+e.target.value;setText('cubeGlassValue',state.cubeGlassOpacity.toFixed(2));glassMaterial.opacity=state.cubeGlassOpacity;saveSoon();};
$('cubeEdgeIntensity').oninput=e=>{state.cubeEdgeIntensity=+e.target.value;setText('cubeEdgeValue',state.cubeEdgeIntensity.toFixed(2));saveSoon();};
$('cubeBassEdges').onchange=e=>{state.cubeBassEdges=e.target.checked;saveSoon();};
$('cubeEdgeSweep').onchange=e=>{state.cubeEdgeSweep=e.target.checked;saveSoon();};
$('cameraDolly').onchange=e=>{state.cameraDolly=e.target.checked;saveSoon();};
$('autoPalette').onchange=e=>{state.autoPalette=e.target.checked;saveSoon();};
$('cubeGlassColor').oninput=e=>{glassMaterial.color.set(e.target.value);saveSoon();};
$('cubeEdgeColor').oninput=e=>{cubeEdges.material.color.set(e.target.value);saveSoon();};
$('typeTransitionStyle').onchange=e=>{state.typeTransitionStyle=e.target.value;saveSoon();};
$('preloadToggle').onchange=e=>{state.preload=e.target.checked;if(!state.preload)preloadCache.clear();saveSoon();};
$('parallaxToggle').onchange=e=>{state.parallax=e.target.checked;saveSoon();};
$('objectScale').oninput=e=>setObjectScale(+e.target.value);
$('zoomInBtn').onclick=()=>setObjectScale(state.objectScale+.1);
$('zoomOutBtn').onclick=()=>setObjectScale(state.objectScale-.1);
$('zoomResetBtn').onclick=()=>setObjectScale(1);
$('reverseBtn').onclick=()=>{$('speedSlider').value=-state.speed;$('speedSlider').dispatchEvent(new Event('input'));};
$('pauseRotBtn').onclick=()=>{state.rotPaused=!state.rotPaused;$('pauseRotBtn').textContent=state.rotPaused?'▶️':'⏸';};
document.querySelectorAll('.orient').forEach(b=>b.onclick=()=>{if(currentMesh){currentMesh.rotation[b.dataset.axis]+=THREE.MathUtils.degToRad(+b.dataset.deg);if(state.technicalMode)updateTechnicalOverlay(currentMesh);}});
$('orientationResetBtn').onclick=()=>{if(currentMesh)currentMesh.rotation.set(0,0,0);};

$('addCorridorBtn').onclick=()=>{const item={name:'🌀 Музыкальный коридор',type:'corridor',duration:12,transition:'flow',appearance:captureAppearance()};playlist.push(item);playlistIndex=playlist.length-1;playlistTimer=0;renderPlaylist();showPlaylistItem(item);};
function rebuildCorridorFromUI(){syncCorridorState();if(corridorActive)buildCorridor(true);saveSoon();}
$('corridorAudioReact').onchange=e=>{state.corridorAudioReact=e.target.checked;saveSoon();};
$('corridorLength').oninput=e=>{state.corridorLength=+e.target.value;setText('corridorLengthValue',Math.round(state.corridorLength));rebuildCorridorFromUI();};
$('corridorRadius').oninput=e=>{state.corridorRadius=+e.target.value;setText('corridorRadiusValue',Math.round(state.corridorRadius));rebuildCorridorFromUI();};
$('corridorSpeed').oninput=e=>{state.corridorSpeed=+e.target.value;setText('corridorSpeedValue',Math.round(state.corridorSpeed));saveSoon();};
$('corridorBend').oninput=e=>{state.corridorBend=+e.target.value;setText('corridorBendValue',Math.round(state.corridorBend));saveSoon();};
$('corridorTwist').oninput=e=>{state.corridorTwist=+e.target.value;setText('corridorTwistValue',state.corridorTwist.toFixed(2));saveSoon();};
$('corridorSegments').oninput=e=>{state.corridorSegments=+e.target.value;setText('corridorSegmentsValue',Math.round(state.corridorSegments));rebuildCorridorFromUI();};
$('corridorColor').oninput=e=>{state.corridorColor=e.target.value;saveSoon();};
$('corridorShape').onchange=e=>{state.corridorShape=e.target.value;rebuildCorridorFromUI();};
$('corridorDensity').oninput=e=>{state.corridorDensity=+e.target.value;setText('corridorDensityValue',state.corridorDensity.toFixed(2));rebuildCorridorFromUI();};
$('corridorLineWidth').oninput=e=>{state.corridorLineWidth=+e.target.value;setText('corridorLineWidthValue',state.corridorLineWidth.toFixed(1));rebuildCorridorFromUI();};
$('corridorShapeWave').oninput=e=>{state.corridorShapeWave=+e.target.value;setText('corridorShapeWaveValue',state.corridorShapeWave.toFixed(2));saveSoon();};
$('corridorSectionSpin').oninput=e=>{state.corridorSectionSpin=+e.target.value;setText('corridorSectionSpinValue',state.corridorSectionSpin.toFixed(2));saveSoon();};
$('corridorStyle').onchange=e=>{state.corridorStyle=e.target.value;rebuildCorridorFromUI();};
$('corridorPulse').onchange=e=>{state.corridorPulse=e.target.checked;saveSoon();};
$('corridorParticles').onchange=e=>{state.corridorParticles=e.target.checked;if(corridorParticlesObj)corridorParticlesObj.visible=e.target.checked;saveSoon();};
$('corridorReplayBtn').onclick=()=>{corridorTravel=0;corridorPhase=0;if(!corridorActive)showCorridorItem(playlist[playlistIndex]);};
$('corridorDeleteBtn').onclick=()=>{if(playlist[playlistIndex]?.type!=='corridor')return;playlist.splice(playlistIndex,1);disposeCorridor();playlistIndex=Math.max(0,Math.min(playlistIndex,playlist.length-1));renderPlaylist();if(playlist.length)showPlaylistItem(playlist[playlistIndex]);else clearModels();};

$('addTextBtn').onclick=()=>addTextObject();
$('textObjectSelect').onchange=e=>{activeTextId=e.target.value||null;loadTextUI(activeText());};
$('textReplayBtn').onclick=()=>replayText();
$('textDeleteBtn').onclick=()=>{const o=activeText();if(o){disposeTextObject(o);refreshTextSelect();renderPlaylist();if(playlist.length){playlistIndex=Math.min(playlistIndex,playlist.length-1);showPlaylistItem(playlist[playlistIndex]);}else clearModels();loadTextUI(activeText());}};
$('textValue').oninput=()=>updateActiveText(true);
$('textFont').onchange=()=>updateActiveText(true);
$('textSize').oninput=e=>{setText('textSizeValue',(+e.target.value).toFixed(1));updateActiveText(true);};
$('textDepth').oninput=e=>{setText('textDepthValue',(+e.target.value).toFixed(1));updateActiveText(true);};
$('textGlow').oninput=e=>{setText('textGlowValue',(+e.target.value).toFixed(2));updateActiveText(true);};
$('textColor').oninput=()=>updateActiveText(true);
$('textAnimation').onchange=()=>updateActiveText(false);
$('textAnimDuration').oninput=e=>{setText('textAnimDurationValue',(+e.target.value).toFixed(1));updateActiveText(false);};
$('textLetterDelay').oninput=e=>{setText('textLetterDelayValue',(+e.target.value).toFixed(2));updateActiveText(false);};
$('textLetterDepth').oninput=e=>{setText('textLetterDepthValue',Math.round(+e.target.value));updateActiveText(false);};
$('textLetterSpin').oninput=e=>{setText('textLetterSpinValue',Math.round(+e.target.value));updateActiveText(false);};
$('textLetterFlash').oninput=e=>{setText('textLetterFlashValue',(+e.target.value).toFixed(2));updateActiveText(false);};
$('textX').oninput=e=>{setText('textXValue',Math.round(+e.target.value));updateActiveText(false);};
$('textY').oninput=e=>{setText('textYValue',Math.round(+e.target.value));updateActiveText(false);};
$('textZ').oninput=e=>{setText('textZValue',Math.round(+e.target.value));updateActiveText(false);};
$('textFaceCamera').onchange=()=>updateActiveText(false);

$('directorEnergy').oninput=e=>{setText('directorEnergyValue',Math.round(+e.target.value));saveSoon();};
$('directorDuration').oninput=e=>{setText('directorDurationValue',Math.round(+e.target.value));saveSoon();};
$('directorBuildBtn').onclick=runAutoDirector;
$('directorPreviewBtn').onclick=()=>{if(!playlist.length)return;playlistIndex=0;playlistTimer=0;playlistPlaying=true;renderPlaylist();showPlaylistItem(playlist[0]);$('plPlayBtn').textContent='⏸ Пауза';if(audioBuffer&&!audioPlaying)playAudio();};
['directorStyle','directorUseMusic','directorInterleave','directorAutoCamera','directorPostFx'].forEach(id=>{const e=$(id);if(e)e.onchange=saveSoon;});

$('recordBitrate').oninput=e=>{setText('recordBitrateValue',Math.round(+e.target.value));saveSoon();};
$('recordResolution').onchange=saveSoon;$('recordFps').onchange=saveSoon;$('recordPerformanceMode').onchange=saveSoon;
$('stereoEyeSep').oninput=e=>{setText('stereoEyeSepValue',(+e.target.value).toFixed(1));saveSoon();};
$('stereoFocus').oninput=e=>{setText('stereoFocusValue',Math.round(+e.target.value));saveSoon();};
$('stereoBitrate').oninput=e=>{setText('stereoBitrateValue',Math.round(+e.target.value));saveSoon();};
$('stereoRecord').onchange=saveSoon;$('stereoResolution').onchange=saveSoon;$('stereoFps').onchange=saveSoon;$('stereoSwapEyes').onchange=saveSoon;$('stereoPerformanceMode').onchange=saveSoon;

$('applyCameraPreset').onclick=()=>applyCameraView($('cameraPreset').value);
$('autoCameraEach').onclick=()=>{state.autoCameraEach=!state.autoCameraEach;$('autoCameraEach').classList.toggle('active',state.autoCameraEach);$('autoCameraEach').textContent=state.autoCameraEach?'✓ Auto для каждой STL':'Auto для каждой STL';saveSoon();};
$('technicalMode').onchange=e=>{
 state.technicalMode=e.target.checked;
 if(state.technicalMode){
  applyScenePresetByName('blueprint');
  if(currentMesh)updateTechnicalOverlay(currentMesh);
 }else technicalGroup.visible=false;
 saveSoon();
};
['technicalWireframe','technicalDimensions','technicalAxes','technicalGrid','technicalLabels'].forEach(id=>$(id).onchange=()=>{if(state.technicalMode)updateTechnicalOverlay(currentMesh);saveSoon();});
$('technicalUnits').onchange=()=>{if(state.technicalMode)updateTechnicalOverlay(currentMesh);saveSoon();};
$('refreshTechnical').onclick=()=>updateTechnicalOverlay(currentMesh);
$('clearTechnical').onclick=()=>{state.technicalMode=false;$('technicalMode').checked=false;technicalGroup.visible=false;saveSoon();};

$('fxChromatic').onchange=e=>{chromaPass.enabled=e.target.checked;saveSoon();};
$('fxChromaticAmount').oninput=e=>{chromaPass.uniforms.amount.value=+e.target.value;setText('fxChromaticValue',(+e.target.value).toFixed(4));saveSoon();};
$('fxVignette').onchange=e=>{vignettePass.enabled=e.target.checked;saveSoon();};
$('fxVignetteAmount').oninput=e=>{vignettePass.uniforms.darkness.value=+e.target.value;setText('fxVignetteValue',(+e.target.value).toFixed(2));saveSoon();};
$('fxFilm').onchange=e=>{filmPass.enabled=e.target.checked;saveSoon();};
$('fxFilmAmount').oninput=e=>{filmPass.uniforms.intensity.value=+e.target.value;setText('fxFilmValue',(+e.target.value).toFixed(2));saveSoon();};
$('fxScanlines').onchange=e=>{scanlinePass.enabled=e.target.checked;saveSoon();};
$('fxScanlinesAmount').oninput=e=>{scanlinePass.uniforms.amount.value=+e.target.value;setText('fxScanlinesValue',(+e.target.value).toFixed(2));saveSoon();};
$('fxGlitch').onchange=e=>{glitchPass.enabled=e.target.checked;saveSoon();};
$('fxGlitchAmount').oninput=e=>{const v=+e.target.value;glitchPass.goWild=v>.65;setText('fxGlitchValue',v.toFixed(2));saveSoon();};
$('fxRgb').onchange=e=>{rgbShiftPass.enabled=e.target.checked;saveSoon();};
$('fxRgbAmount').oninput=e=>{rgbShiftPass.uniforms.amount.value=+e.target.value;setText('fxRgbValue',(+e.target.value).toFixed(4));saveSoon();};
$('fxMotion').onchange=e=>{afterimagePass.enabled=e.target.checked;saveSoon();};
$('fxMotionAmount').oninput=e=>{afterimagePass.uniforms.damp.value=+e.target.value;setText('fxMotionValue',(+e.target.value).toFixed(2));saveSoon();};
$('fxGrading').onchange=e=>{gradingPass.enabled=e.target.checked;saveSoon();};
$('gradeContrast').oninput=e=>{gradingPass.uniforms.contrast.value=+e.target.value;setText('gradeContrastValue',(+e.target.value).toFixed(2));$('gradePreset').value='none';state.gradePreset='none';saveSoon();};
$('gradeSaturation').oninput=e=>{gradingPass.uniforms.saturation.value=+e.target.value;setText('gradeSaturationValue',(+e.target.value).toFixed(2));$('gradePreset').value='none';state.gradePreset='none';saveSoon();};
$('gradeTemperature').oninput=e=>{gradingPass.uniforms.temperature.value=+e.target.value;setText('gradeTemperatureValue',(+e.target.value).toFixed(2));$('gradePreset').value='none';state.gradePreset='none';saveSoon();};
$('gradeTint').oninput=e=>{gradingPass.uniforms.tint.value=+e.target.value;setText('gradeTintValue',(+e.target.value).toFixed(2));$('gradePreset').value='none';state.gradePreset='none';saveSoon();};
const onGradePreset=e=>applyGradePreset(e.target.value);$('gradePreset').onchange=onGradePreset;$('gradePreset').oninput=onGradePreset;
$('applyScenePreset').onclick=()=>applyScenePresetByName($('scenePreset').value);
const onScenePreset=e=>{state.scenePreset=e.target.value;};$('scenePreset').onchange=onScenePreset;$('scenePreset').oninput=onScenePreset;
$('saveCustomPreset').onclick=()=>{customScenePreset={bg:'#'+scene.background.getHexString(),fog:'#'+scene.fog.color.getHexString(),bloom:bloomPass.strength,model:'#'+baseUniforms.color.getHexString(),edge:$('cubeEdgeColor').value,env:$('envColorPicker').value,floor:floor.visible,grid:grid.visible,particles:particleGroup.visible,rings:ringGroup.visible,grade:state.gradePreset,glass:$('cubeGlassColor').value,glassOpacity:state.cubeGlassOpacity};state.scenePreset='custom';$('scenePreset').value='custom';saveSoon();$('info').textContent='💾 Custom scene preset сохранён';};

$('appearanceCopyAll').onclick=()=>{const a=captureAppearance();playlist.forEach(item=>item.appearance={...a});$('info').textContent='🎨 Внешний вид применён ко всем элементам';saveSoon();};
$('appearanceResetCurrent').onclick=resetCurrentAppearance;

$('wireframeToggle').onchange=e=>{state.wire=e.target.checked;syncMaterials();saveAppearanceForCurrent();saveSoon();};
$('doubleSided').onchange=e=>{state.doubleSide=e.target.checked;syncMaterials();saveAppearanceForCurrent();saveSoon();};
$('bloomToggle').onchange=e=>{bloomPass.enabled=e.target.checked;saveAppearanceForCurrent();saveSoon();};$('dofToggle').onchange=e=>{bokehPass.enabled=e.target.checked&&!imageCubeGroup.visible;saveAppearanceForCurrent();saveSoon();};
$('gridToggle').onchange=e=>{grid.visible=e.target.checked;saveAppearanceForCurrent();saveSoon();};$('showFloor').onchange=e=>{floor.visible=e.target.checked;saveAppearanceForCurrent();saveSoon();};
$('bloomStrength').oninput=e=>{bloomPass.strength=+e.target.value;saveAppearanceForCurrent();saveSoon();};const setTransitionMode=e=>{state.transitionMode=e.target.value;saveSoon();};$('transitionMode').onchange=setTransitionMode;$('transitionMode').oninput=setTransitionMode;$('transitionDuration').oninput=e=>{state.transition=+e.target.value;setText('transitionDurationValue',state.transition.toFixed(1));saveSoon();};

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
document.querySelectorAll('#controls details.acc').forEach(acc=>{
 acc.addEventListener('toggle',()=>{
  if(!acc.open)return;
  document.querySelectorAll('#controls details.acc').forEach(other=>{if(other!==acc)other.open=false;});
  try{localStorage.setItem('minired-open-accordion',acc.querySelector('summary')?.textContent||'');}catch(e){}
 });
});
try{
 const saved=localStorage.getItem('minired-open-accordion');
 if(saved){
  document.querySelectorAll('#controls details.acc').forEach(acc=>acc.open=(acc.querySelector('summary')?.textContent||'')===saved);
 }
}catch(e){}
const drag=$('drag');window.addEventListener('dragover',e=>{e.preventDefault();drag.classList.add('active');});
window.addEventListener('dragleave',e=>{if(e.relatedTarget===null)drag.classList.remove('active');});
window.addEventListener('drop',e=>{e.preventDefault();drag.classList.remove('active');const f=[...e.dataTransfer.files],media=f.filter(x=>x.name.toLowerCase().endsWith('.stl')||x.type.startsWith('image/')||/\.(jpg|jpeg|png|webp|gif)$/i.test(x.name)),a=f.find(x=>x.type.startsWith('audio/'));if(media.length)addFiles(media);if(a)loadAudio(a);});

$('previewBtn').onclick=()=>{document.body.classList.toggle('preview-mode');};
window.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('preview-mode');});
$('saveProjectBtn').onclick=()=>{
 const payload={version:5,state:{...state},customScenePreset,settings:saveSettingsSnapshot(),playlist:playlist.map(x=>({name:x.name,type:x.type,duration:x.duration,transition:x.transition,appearance:x.appearance?{...x.appearance}:undefined,textIndex:x.type==='text'?textObjects.findIndex(o=>o.id===x.textId):undefined})),texts:textObjects.map(o=>({...o.params}))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='minired-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
};
$('projectInput').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const p=JSON.parse(await f.text());
  Object.assign(state,p.state||{});
  if(p.customScenePreset)customScenePreset=p.customScenePreset;
  if(p.settings)applySettingsSnapshot(p.settings);
  [...textObjects].forEach(disposeTextObject);
  const restoredTexts=[];for(const tp of (p.texts||[]))restoredTexts.push(await addTextObject(tp,false));
  const restoredTextItems=(p.playlist||[]).filter(x=>x.type==='text'&&x.textIndex!=null&&restoredTexts[x.textIndex]).map(x=>({...x,textId:restoredTexts[x.textIndex].id,appearance:x.appearance||defaultAppearance()}));
  const restoredCorridors=(p.playlist||[]).filter(x=>x.type==='corridor').map(x=>({...x,appearance:x.appearance||defaultAppearance()}));
  playlist.push(...restoredTextItems,...restoredCorridors);renderPlaylist();
  alert('Настройки и 3D-текст проекта загружены. Текст восстановлен в плейлисте; медиа-файлы нужно добавить заново.');
 }catch(err){console.error(err);alert('Ошибка проекта');}
};
$('resetCinemaBtn').onclick=()=>{
 state.cubeHoldPercent=60;state.cubeNearDistance=58;state.cubeFarDistance=280;state.cubeSway=.4;state.cubeGlassOpacity=.13;state.cubeEdgeIntensity=1;
 ['cubeHoldPercent','cubeNearDistance','cubeFarDistance','cubeSway','cubeGlassOpacity','cubeEdgeIntensity'].forEach(id=>{if($(id))$(id).value=state[id];});
 glassMaterial.opacity=state.cubeGlassOpacity;saveSoon();
};
function saveSettingsSnapshot(){
 const ids=['cubeSpinSpeed','imageFitMode','cubeTransitionStyle','cubeHoldPercent','cubeNearDistance','cubeFarDistance','cubeSway','cubeGlassOpacity','cubeEdgeIntensity','cubeBassEdges','cubeEdgeSweep','cameraDolly','autoPalette','cubeGlassColor','cubeEdgeColor','typeTransitionStyle','preloadToggle','parallaxToggle','objectScale','transitionMode','transitionDuration','plInterval','fxChromatic','fxChromaticAmount','fxVignette','fxVignetteAmount','fxFilm','fxFilmAmount','fxScanlines','fxScanlinesAmount','fxGlitch','fxGlitchAmount','fxRgb','fxRgbAmount','fxMotion','fxMotionAmount','fxGrading','gradeContrast','gradeSaturation','gradeTemperature','gradeTint','gradePreset','scenePreset','cameraPreset','technicalMode','technicalWireframe','technicalDimensions','technicalAxes','technicalGrid','technicalLabels','technicalUnits','stereoRecord','stereoEyeSep','stereoFocus','stereoResolution','stereoFps','stereoBitrate','stereoSwapEyes','stereoPerformanceMode','recordResolution','recordFps','recordBitrate','recordPerformanceMode','cubeTurnDuration','directorStyle','directorEnergy','directorUseMusic','directorInterleave','directorAutoCamera','directorPostFx','directorDuration','corridorAudioReact','corridorLength','corridorRadius','corridorSpeed','corridorBend','corridorTwist','corridorSegments','corridorColor','corridorStyle','corridorShape','corridorDensity','corridorLineWidth','corridorShapeWave','corridorSectionSpin','corridorPulse','corridorParticles'];
 const o={};ids.forEach(id=>{const e=$(id);if(e)o[id]=e.type==='checkbox'?e.checked:e.value;});return o;
}
function applySettingsSnapshot(o){Object.entries(o||{}).forEach(([id,v])=>{const e=$(id);if(!e)return;if(e.type==='checkbox'){e.checked=!!v;e.dispatchEvent(new Event('change'));}else{e.value=v;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));}});}
const KEY='stl-cinematic-settings-v2';let saveTimer;
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveSettings,100);}
function saveSettings(){
 const ids=['opacitySlider','fresnelToggle','fresnelPower','fresnelIntensity','fresnelColorPicker','autoRotateToggle','speedSlider','audioReactToggle','audioSens','envToggle','particlesToggle','ringsToggle','envReactToggle','envSpeed','particleDensity','envColorPicker','wireframeToggle','bloomToggle','dofToggle','gridToggle','showFloor','doubleSided','bloomStrength','colorPicker','bgColorPicker','transitionMode','transitionDuration','plInterval','cubeSpinSpeed','cubeTurnDuration','objectScale','imageFitMode','cubeTransitionStyle','cubeHoldPercent','cubeNearDistance','cubeFarDistance','cubeSway','cubeGlassOpacity','cubeEdgeIntensity','cubeBassEdges','cubeEdgeSweep','cameraDolly','autoPalette','cubeGlassColor','cubeEdgeColor','typeTransitionStyle','preloadToggle','parallaxToggle','fxChromatic','fxChromaticAmount','fxVignette','fxVignetteAmount','fxFilm','fxFilmAmount','fxScanlines','fxScanlinesAmount','fxGlitch','fxGlitchAmount','fxRgb','fxRgbAmount','fxMotion','fxMotionAmount','fxGrading','gradeContrast','gradeSaturation','gradeTemperature','gradeTint','gradePreset','scenePreset','corridorAudioReact','corridorLength','corridorRadius','corridorSpeed','corridorBend','corridorTwist','corridorSegments','corridorColor','corridorStyle','corridorPulse','corridorParticles'];
 const d={axis:state.axis,customScenePreset,autoCameraEach:state.autoCameraEach};ids.forEach(id=>{const e=$(id);d[id]=e.type==='checkbox'?e.checked:e.value;});try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){}
}
function restoreSettings(){
 let d;try{d=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}if(!d)return;
 Object.keys(d).forEach(id=>{if(id==='axis'||id==='customScenePreset'||id==='autoCameraEach'||!$(id))return;const e=$(id);if(e.type==='checkbox'){e.checked=!!d[id];e.dispatchEvent(new Event('change'));}else{e.value=d[id];e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));}});
 if(['x','y','z'].includes(d.axis)){state.axis=d.axis;document.querySelectorAll('.axis').forEach(b=>b.classList.toggle('active',b.dataset.axis===state.axis));}if(d.customScenePreset)customScenePreset=d.customScenePreset;if(typeof d.autoCameraEach==='boolean'){state.autoCameraEach=d.autoCameraEach;if($('autoCameraEach')){$('autoCameraEach').classList.toggle('active',state.autoCameraEach);$('autoCameraEach').textContent=state.autoCameraEach?'✓ Auto для каждой STL':'Auto для каждой STL';}}
}
restoreSettings();
if($('scenePreset')&&$('scenePreset').value!=='custom'&&scenePresets[$('scenePreset').value])applyScenePresetByName($('scenePreset').value);
else if($('gradePreset'))applyGradePreset($('gradePreset').value||'none');
state.cubeSpinSpeed=+$('cubeSpinSpeed').value||.3;
state.cubeTurnDuration=+$('cubeTurnDuration').value||2.2;setText('cubeTurnDurationValue',state.cubeTurnDuration.toFixed(1));
setText('cubeSpinSpeedValue',state.cubeSpinSpeed.toFixed(2));
setObjectScale(+$('objectScale').value||1);

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);bloomPass.resolution.set(innerWidth,innerHeight);});
