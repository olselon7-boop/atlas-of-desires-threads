import { NextRequest, NextResponse } from "next/server";
import { enrichDesireText, type DeepDesire } from "@/lib/desire-enrichment";
import { estimateXPostReadCost } from "@/lib/x";
import {
  fetchRadioDreamPages,
  RADIO_DREAM_QUERIES,
  startOfTodayAmsterdamIso
} from "@/lib/radio-dreams-source";
import {
  persistXSearchResponse,
  saveRadioDreamCursors
} from "@/lib/x-persistence";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function currentYearAmsterdam(){
  return Number(new Intl.DateTimeFormat("en",{timeZone:"Europe/Amsterdam",year:"numeric"}).format(new Date()));
}

export async function GET(req:NextRequest){
  const token=process.env.X_BEARER_TOKEN;
  if(!token) return NextResponse.json({error:"X is not configured"},{status:503});

  const params=new URL(req.url).searchParams;
  const sinceRu=params.get("since_ru");
  const sinceEn=params.get("since_en");

  try{
    const [ruPages,enPages]=await Promise.all([
      fetchRadioDreamPages(token,"ru",sinceRu),
      fetchRadioDreamPages(token,"en",sinceEn)
    ]);
    const allPages=[...ruPages,...enPages];

    // Persist every X match. The desires table stores the classifier result,
    // including is_human_aspiration=false for rejected matches.
    const startTime=startOfTodayAmsterdamIso();
    const endTime=new Date().toISOString();
    const year=currentYearAmsterdam();
    for(const [language,pages] of [["ru",ruPages],["en",enPages]] as const){
      for(const page of pages){
        const count=page.data?.length||0;
        if(!count) continue;
        await persistXSearchResponse({
          response:page,
          query:RADIO_DREAM_QUERIES[language],
          year,
          estimatedCostUsd:estimateXPostReadCost(count),
          mode:"radio-dreams-live-client",
          startTime,
          endTime
        });
      }
    }

    const mediaByKey=new Map(
      allPages
        .flatMap(page=>page.includes?.media||[])
        .filter(m=>m.media_key)
        .map(m=>[m.media_key as string,m])
    );
    const referencedById=new Map(
      allPages
        .flatMap(page=>page.includes?.tweets||[])
        .map(t=>[t.id,t] as const)
    );

    const merged=[
      ...ruPages.flatMap(page=>(page.data||[]).map(p=>({...p,source_language:"ru"}))),
      ...enPages.flatMap(page=>(page.data||[]).map(p=>({...p,source_language:"en"})))
    ];

    const posts=merged
      .map(post=>{
        const e=enrichDesireText(post.text);
        return {
          id:post.id,
          text:post.text,
          created_at:post.created_at||null,
          language:post.lang||post.source_language,
          cluster:e.deep_desire as DeepDesire,
          state:e.lifecycle_state,
          agency:e.agency,
          confidence:e.confidence,
          is_human_aspiration:e.is_human_aspiration,
          permalink:`https://x.com/i/web/status/${post.id}`,
          media:(()=>{
            const ownKeys=post.attachments?.media_keys||[];
            const referencedKeys=(post.referenced_tweets||[])
              .flatMap(ref=>referencedById.get(ref.id||"")?.attachments?.media_keys||[]);
            const keys=ownKeys.length?ownKeys:referencedKeys;
            return keys
              .map(key=>mediaByKey.get(key))
              .filter(Boolean)
              .map(m=>({
                type:m?.type||null,
                url:m?.url||m?.preview_image_url||null,
                preview_url:m?.preview_image_url||null,
                width:m?.width||null,
                height:m?.height||null,
                alt_text:m?.alt_text||null,
                duration_ms:m?.duration_ms||null,
                video_url:(m?.variants||[])
                  .filter(v=>v.content_type==="video/mp4"&&v.url)
                  .sort((a,b)=>(b.bit_rate||0)-(a.bit_rate||0))[0]?.url||null
              }))
              .filter(m=>m.url);
          })()
        };
      })
      .filter(p=>p.is_human_aspiration)
      .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));

    const cursors={
      ru:ruPages[0]?.meta?.newest_id||sinceRu||null,
      en:enPages[0]?.meta?.newest_id||sinceEn||null
    };
    await saveRadioDreamCursors(cursors);

    const clusterCounts:Record<string,number>={};
    for(const post of posts) clusterCounts[post.cluster]=(clusterCounts[post.cluster]||0)+1;

    return NextResponse.json({
      source:"x_recent",
      fetched_at:new Date().toISOString(),
      posts,
      cluster_counts:clusterCounts,
      stats:{
        query_matches:merged.length,
        human_aspirations:posts.length,
        pages:{ru:ruPages.length,en:enPages.length}
      },
      cursors
    },{
      headers:{
        "Cache-Control":"no-store, max-age=0",
        "X-Robots-Tag":"noindex"
      }
    });
  }catch(error){
    console.error("radio-dreams live failed",error);
    return NextResponse.json({
      error:error instanceof Error?error.message:"Unknown X error"
    },{status:502});
  }
}
