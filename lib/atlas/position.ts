import type { DesireObject } from "./data-source.ts";
export function seed(value:string):number{let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967295;}
export function desirePosition(d:DesireObject):[number,number,number]{
  const a=seed(d.id+'a')*Math.PI*2,b=Math.acos(2*seed(d.id+'b')-1),radius=.35+Math.pow(seed(d.id+'r'),.45)*1.35;
  const cluster=seed(d.dream_object||'unknown')*Math.PI*2;
  const state=seed(d.state),language=seed(d.language),platform=seed(d.platform);
  const date=d.date?Math.max(0,Math.min(1,(Date.parse(d.date)-Date.UTC(2020,0,1))/(86400000*3650))):.5;
  const warp=1+.3*Math.sin(a*3+b*2)+.2*Math.cos(b*5+state*3);
  return [Math.cos(a)*Math.sin(b)*radius*warp*1.28+Math.cos(cluster)*.32,Math.cos(b)*radius*.85+(language-.5)*.3,Math.sin(a)*Math.sin(b)*radius*.55+Math.sin(cluster)*.25+(date-.5)*.2+(platform-.5)*.1];
}
