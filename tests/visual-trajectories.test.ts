import assert from 'node:assert/strict';
import {test} from 'node:test';
import {detectDesire,type DesireRecord} from '../lib/desire.ts';
import {extractDreamObject} from '../lib/dream-object.ts';
import {emptyVisual,parseVisualOutput} from '../lib/visual-schema.ts';
import {compareDreams,applyTrajectoryReview,linkTrajectories,trajectoryIsConfirmed} from '../lib/trajectory.ts';
import {CorpusDataSource,sanitizeDesire,publicImage} from '../lib/atlas/data-source.ts';
import {parseCorpus} from '../lib/corpus.ts';
import {analyzeBatch,analyzeImage,allowedAnalysisImage,MAX_IMAGE_BATCH} from '../lib/research/visual-analysis.ts';
function record(id:string,text:string,date='2026-01-01'):DesireRecord{return {id,source:{platform:'bluesky',post_id:`at://did:plc:private/app.bsky.feed.post/${id}`,author_key:'research-only-key',original_text:text,timestamp:date+'T12:00:00Z',permalink:'https://bsky.app/profile/private.example/post/1',queries:['dream'],collected_at:'2026-10-25'},media:{type:null,url:null,thumbnail_url:null},interpretation:detectDesire(text),place:{city:null,country:null,source:null},review:'unreviewed'};}
const output={visual_motifs:['water'],objects:['sea'],scene_type:'coast',mood:['calm'],visual_role:'object_of_dream',dream_object_visual:'travel_to_sea',text_image_alignment:'high',contains_people:false,contains_readable_text:false,description:'Sea without people or text',confidence:.9};
test('object extraction handles RU morphology, English, ambiguity and unknowns',()=>{
 for(const text of ['мечтаю о море','Я впервые увидела море','мечтаю о морском побережье','I dream of seeing the sea'])assert.equal(extractDreamObject(text).canonical,'travel_to_sea');
 assert.equal(extractDreamObject('очень давно мечтаю подколоть губы').canonical,'body_change');
 assert.equal(extractDreamObject('моя мечта сбылась — нашла роман с героиней-тарологом').canonical,'find_book');
 assert.equal(extractDreamObject('Хочу свой дом и увидеть море').canonical,null);
 assert.equal(extractDreamObject('Моя мечта сбылась').canonical,null);
});
test('strict visual output validation rejects extra fields, missing flags and impossible confidence',()=>{
 assert.equal(parseVisualOutput(output).dream_object_visual,'travel_to_sea');
 for(const bad of [{...output,confidence:1.1},{...output,contains_people:'no'},{...output,username:'private'},{...output,visual_role:'proof'}])assert.throws(()=>parseVisualOutput(bad));
 const {contains_people:_unused,...missing}=output;assert.throws(()=>parseVisualOutput(missing));
});
test('aligned visual evidence permits a novel canonical object; unrelated or uncertain images do not',()=>{
 const v={...emptyVisual(),...parseVisualOutput({...output,dream_object_visual:'build_telescope'}),status:'analyzed' as const};
 assert.equal(extractDreamObject('my dream came true',v).canonical,'build_telescope');
 assert.equal(extractDreamObject('my dream came true',{...v,visual_role:'unrelated'}).canonical,null);
 assert.equal(extractDreamObject('my dream came true',{...v,confidence:.2}).canonical,null);
 assert.ok(extractDreamObject('мечтаю подколоть губы',{...v,dream_object_visual:'travel_to_sea'}).confidence<.7);
});
test('required false positive A: same author, lips then book is a different dream',()=>{
 const t=compareDreams(record('a','очень давно мечтаю подколоть губы'),record('b','моя мечта сбылась — нашла роман с героиней-тарологом','2026-03-01'));
 assert.equal(t.same_dream.verdict,'different_dream');assert.equal(t.time_to_fulfillment,null);
});
test('explicit RU/EN same-object first-person sequence is a candidate, not a verified fact',()=>{
 for(const [a,b]of [['Я мечтаю впервые увидеть море','Моя мечта сбылась — я увидела море'],['I dream of seeing the sea','My dream came true: I finally saw the sea']]){
  const t=compareDreams(record('a',a),record('b',b,'2026-01-11'));
  assert.equal(t.same_dream.verdict,'confirmed_candidate');assert.equal(t.time_to_fulfillment,10);assert.equal(t.same_dream.requires_manual_review,true);assert.equal(trajectoryIsConfirmed(t),false);
 }
});
test('required case B: two post-fulfillment observations do not invent a start or fulfillment duration',()=>{
 const t=compareDreams(record('a','Моя мечта сбылась — я увидела море'),record('b','Я осуществила мечту — побывала на море','2026-02-01'));
 assert.equal(t.same_dream.shared_dream_object,'travel_to_sea');assert.equal(t.same_dream.verdict,'possible');assert.equal(t.time_to_fulfillment,null);
 assert.equal(applyTrajectoryReview(t,'same_dream').time_to_fulfillment,null);
});
test('same author/states alone, wrong dates, quotations and different authors cannot confirm',()=>{
 const a=record('a','Я мечтаю о море');
 for(const b of [record('b','Моя мечта сбылась','2026-02-01'),record('b','Моя мечта сбылась — я увидела море','2025-01-01'),record('b','Он мечтает о море','2026-02-01'),{...record('b','Моя мечта сбылась — я увидела море','2026-02-01'),source:{...a.source,author_key:'other',original_text:'Моя мечта сбылась — я увидела море',timestamp:'2026-02-01'}}])assert.notEqual(compareDreams(a,b).same_dream.verdict,'confirmed_candidate');
});
test('manual rejection and uncertainty override automatic fulfillment metrics and public TIME',async()=>{
 const a=record('a','Я мечтаю о море'),b=record('b','Моя мечта сбылась — я увидела море','2026-01-11');
 const pair=compareDreams(a,b);
 for(const verdict of ['different_dream','insufficient_evidence']as const){assert.equal(applyTrajectoryReview(pair,verdict).time_to_fulfillment,null);assert.equal((await new CorpusDataSource([a,b],{[pair.id]:verdict}).getTrajectories()).length,0);}
 assert.equal((await new CorpusDataSource([a,b],{[pair.id]:'same_dream'}).getTrajectories()).length,1);
 assert.equal(linkTrajectories([a,{...b,source:{...b.source,author_key:null}}]).length,0);
});
test('Russian/English lifecycle, agency and Russian duration are recognized',()=>{
 for(const [text,state]of [['Я мечтаю о море','dreaming'],['Я мечтала о море','dreaming'],['Я мечтаю, но не получается','stalled'],['Я пытаюсь исполнить мечту','struggling'],['I am working toward my dream','struggling'],['Моя мечта сбылась','fulfilled_passive'],['Я осуществила свою мечту','fulfilled_active'],['I made my dream come true','fulfilled_active'],['Я перестала мечтать','abandoned'],['My dream has changed','transformed']])assert.equal(detectDesire(text).dream_state,state,text);
 assert.equal(detectDesire('Мечтаю уже 7 лет').duration_mentioned,'7 лет');
});
test('public atlas is an allowlist DTO without research identifiers, contact links or location',()=>{
 const r=record('at://did:plc:raw/private','I dream of sea @private https://bsky.app/profile/private did:plc:private');
 const json=JSON.stringify(sanitizeDesire(r));
 for(const forbidden of ['author_key','post_id','permalink','research-only-key','did:','at://','@private','bsky.app/profile','city','country'])assert.equal(json.includes(forbidden),false,forbidden);
 assert.equal(sanitizeDesire(r).dream_object,'travel_to_sea');
});
test('people, unknown flags, text in images and untrusted URLs never appear as artwork textures',()=>{
 const r={...record('a','I dream of sea'),media:{type:'IMAGE',url:'https://cdn.bsky.app/img/feed_fullsize/plain/test',thumbnail_url:null}};
 assert.equal(publicImage(r),null);
 const visual={...emptyVisual(),...parseVisualOutput(output),status:'analyzed' as const};
 assert.ok(publicImage({...r,visual_analysis:visual}));
 for(const v of [{...visual,contains_people:true},{...visual,contains_people:null},{...visual,contains_readable_text:true},{...visual,status:'failed' as const}])assert.equal(publicImage({...r,visual_analysis:v}),null);
 assert.equal(publicImage({...r,media:{...r.media,url:'https://private.example/face'},visual_analysis:visual}),null);
});
test('import validates schema, recomputes interpretations and ignores injected metadata',()=>{
 const r=record('a','I dream of sea');const parsed=parseCorpus({records:[{...r,interpretation:{dream_state:'evil'},username:'private',location:'private'}]});
 assert.equal(parsed[0].interpretation.dream_state,'dreaming');assert.equal((parsed[0]as unknown as Record<string,unknown>).username,undefined);
 assert.throws(()=>parseCorpus([{id:1}]));assert.throws(()=>parseCorpus([r,r],1));
});
test('analysis is not_configured with no key, skips non-images and bounds batches',async()=>{
 const r={...record('a','I dream of sea'),media:{type:'IMAGE',url:'https://cdn.bsky.app/img/test',thumbnail_url:null}};
 assert.equal((await analyzeImage(r,'')).status,'not_configured');
 assert.equal((await analyzeBatch([record('text','I dream of sea')],'')).length,0);
 await assert.rejects(analyzeBatch(Array.from({length:MAX_IMAGE_BATCH+1},()=>r),''));
 assert.equal(allowedAnalysisImage('https://localhost/private'),null);assert.equal(allowedAnalysisImage('http://cdn.bsky.app/image'),null);
});
test('real provider boundary shape, cache, invalid JSON and API failures are handled without exposing keys',async()=>{
 const original=globalThis.fetch;let calls=0;
 const r={...record('mock-boundary','I dream of the sea'),media:{type:'IMAGE',url:'https://cdn.bsky.app/img/mock-boundary',thumbnail_url:null}};
 globalThis.fetch=async(_input,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[1].type,'input_image');return new Response(JSON.stringify({status:'completed',model:'test-model',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]}));};
 try{
  assert.equal((await analyzeImage(r,'test-only-key')).status,'analyzed');assert.equal((await analyzeImage(r,'test-only-key')).status,'analyzed');assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('unauthorized test-only-key',{status:401});const failed=await analyzeImage({...r,source:{...r.source,original_text:'Different request'}},'test-only-key');assert.equal(failed.status,'failed');assert.equal(JSON.stringify(failed).includes('test-only-key'),false);
 }finally{globalThis.fetch=original;}
});
test('explicit conflicting destinations block the same broad sea category',()=>{
 const t=compareDreams(record('a','I dream of the sea in Italy'),record('b','My dream came true: I saw the sea in Japan','2026-02-01'));
 assert.equal(t.same_dream.verdict,'different_dream');assert.equal(t.time_to_fulfillment,null);
});
test('quoted third-party first-person words do not confirm an author trajectory',()=>{
 const t=compareDreams(record('a','She said: I dream of the sea'),record('b','My dream came true: I saw the sea','2026-02-01'));
 assert.notEqual(t.same_dream.verdict,'confirmed_candidate');
});
