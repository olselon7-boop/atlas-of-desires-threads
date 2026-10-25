"use client";
import { useEffect,useRef } from "react";
import * as THREE from "three";
import type { DesireObject,AtlasTrajectory } from "@/lib/atlas/data-source";
import { desirePosition } from "@/lib/atlas/position";
export default function AtlasScene({desires,trajectories,mode,onSelect,onZoom,onFailure}:{desires:DesireObject[];trajectories:AtlasTrajectory[];mode:'universe'|'time';onSelect:(d:DesireObject)=>void;onZoom:(n:number)=>void;onFailure:()=>void}){
  const mount=useRef<HTMLDivElement>(null);
  const callbacks=useRef({onSelect,onZoom,onFailure});
  useEffect(()=>{callbacks.current={onSelect,onZoom,onFailure};},[onSelect,onZoom,onFailure]);
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{callbacks.current.onFailure();return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x070909,0);
    const canvas=renderer.domElement;host.appendChild(canvas);canvas.setAttribute('aria-label','Живой Атлас: перетаскивайте для вращения, прокручивайте для приближения, нажмите для выбора');canvas.tabIndex=0;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,1,.05,50);camera.position.z=5.5;
    const organism=new THREE.Group();scene.add(organism);
    const size=Math.min(desires.length,5000),positions=new Float32Array(size*3),colors=new Float32Array(size*3);
    const palette=['#c8d2b0','#d2a979','#8ab6b1','#c2a9c7'];
    desires.slice(0,size).forEach((d,i)=>{positions.set(desirePosition(d),i*3);const c=new THREE.Color(palette[d.state.startsWith('fulfilled')?1:d.state==='stalled'?3:d.language==='ru'?0:2]);colors.set([c.r,c.g,c.b],i*3);});
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const pointsMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{pixelRatio:{value:renderer.getPixelRatio()},time:{value:0},reduced:{value:window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:0}},vertexShader:`varying vec3 tint; uniform float pixelRatio; uniform float time; uniform float reduced; void main(){ tint=color; vec3 p=position; p+=vec3(sin(time*.18+position.y*3.),cos(time*.14+position.x*2.),sin(time*.13+position.z*4.))*.018*(1.-reduced); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(24.*pixelRatio/-mv.z,3.,18.); }`,fragmentShader:`varying vec3 tint; void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float glow=pow(1.-d*2.,1.1);gl_FragColor=vec4(tint,glow*.9);}`});
    const points=new THREE.Points(geometry,pointsMaterial);organism.add(points);
    const resources:{dispose:()=>void}[]=[geometry,pointsMaterial];
    let disposed=false;
    if(mode==='universe'){
      const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
      desires.slice(0,size).map((d,i)=>({d,i})).filter(({d})=>d.image).slice(0,80).forEach(({d,i})=>{
        const texture=loader.load(d.image!,()=>{if(disposed)texture.dispose();},undefined,()=>{});texture.colorSpace=THREE.SRGBColorSpace;resources.push(texture);
        const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.7,depthWrite:false});resources.push(material);
        const sprite=new THREE.Sprite(material);sprite.position.fromArray(positions,i*3);sprite.scale.set(.075,.075,.075);organism.add(sprite);
      });
    }else{
      const byId=new Map(desires.slice(0,size).map((d,i)=>[d.id,new THREE.Vector3().fromArray(positions,i*3)]));
      for(const t of trajectories){
        const first=t.points[0],last=t.points.at(-1)!;const start=byId.get(first.id),finish=byId.get(last.id);if(!start||!finish)continue;
        const length=.3+Math.min(1.8,Math.log1p(t.elapsed_days||0)/4);
        const control=start.clone().add(finish).multiplyScalar(.5).add(new THREE.Vector3(0,length,.2));
        let curve:THREE.Curve<THREE.Vector3>=new THREE.QuadraticBezierCurve3(start,control,finish);
        if(first.state==='stalled'||last.state==='stalled')curve=new THREE.CatmullRomCurve3([start,start.clone().add(new THREE.Vector3(.4,.3,0)),start.clone().add(new THREE.Vector3(.2,-.2,.2)),control,finish]);
        const g=new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));const m=new THREE.LineBasicMaterial({color:last.state.startsWith('fulfilled')?0xd2b581:0x8fb3a5,transparent:true,opacity:.65});resources.push(g,m);organism.add(new THREE.Line(g,m));
        if(last.state==='transformed'){
          const branch=new THREE.BufferGeometry().setFromPoints([control,control.clone().add(new THREE.Vector3(.4,.25,.1))]);const bm=new THREE.LineBasicMaterial({color:0xb2a2bf});resources.push(branch,bm);organism.add(new THREE.Line(branch,bm));
        }
        if(last.state.startsWith('fulfilled')){const g=new THREE.OctahedronGeometry(.035),m=new THREE.MeshBasicMaterial({color:0xd2b581});resources.push(g,m);const mineral=new THREE.Mesh(g,m);mineral.position.copy(finish);organism.add(mineral);}
      }
    }
    function resize(){const width=host!.clientWidth,height=host!.clientHeight;renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let targetZ=5.5,drag=false,moved=false,lastX=0,lastY=0,yaw=0,pitch=0,selection=0;
    const ray=new THREE.Raycaster();ray.params.Points={threshold:.055};
    function pick(e:PointerEvent){const box=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1),camera);const hit=ray.intersectObject(points)[0];if(hit?.index!==undefined){selection=hit.index;callbacks.current.onSelect(desires[selection]);}}
    function down(e:PointerEvent){drag=true;moved=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}
    function move(e:PointerEvent){if(drag){const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;yaw+=dx*.004;pitch+=dy*.004;lastX=e.clientX;lastY=e.clientY;}else pick(e);}
    function up(e:PointerEvent){drag=false;if(!moved)pick(e);}
    function zoom(delta:number){targetZ=Math.max(.85,Math.min(7,targetZ+delta));callbacks.current.onZoom(targetZ<1.8?3:targetZ<3.7?2:1);}
    function wheel(e:WheelEvent){e.preventDefault();zoom(e.deltaY*.003);}
    function keyboard(e:KeyboardEvent){if(['ArrowRight','ArrowLeft','+','-','='].includes(e.key))e.preventDefault();if(e.key==='+'||e.key==='=')zoom(-.5);if(e.key==='-')zoom(.5);if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&size){selection=(selection+(e.key==='ArrowRight'?1:size-1))%size;callbacks.current.onSelect(desires[selection]);}}
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started=performance.now();let frame=0;
    function render(){if(disposed)return;const t=(performance.now()-started)/1000;pointsMaterial.uniforms.time.value=t;camera.position.z+=(targetZ-camera.position.z)*.08;organism.rotation.y=yaw+(reduced?0:Math.sin(t*.035)*.14);organism.rotation.x=pitch;const breath=reduced?1:1+Math.sin(t*.4)*.018;organism.scale.setScalar(breath);renderer.render(scene,camera);frame=requestAnimationFrame(render);}
    render();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keyboard);resources.forEach(r=>r.dispose());renderer.dispose();canvas.remove();};
  },[desires,trajectories,mode]);
  return <div className="atlas-canvas" ref={mount}/>;
}
