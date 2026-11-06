import { NextResponse } from "next/server";
import postgres from "postgres";
import { enrichDesireText } from "@/lib/desire-enrichment";

export const dynamic="force-dynamic";

export async function GET(){
  const dbUrl=process.env.POSTGRES_URL;
  if(!dbUrl) return NextResponse.json({error:"db not configured"},{status:503});
  const db=postgres(dbUrl,{max:1,ssl:"require"});
  try{
    const marker=await db.unsafe(`
      select start_time,end_time
      from collection_runs
      where platform='x' and query='radio-dreams-rolling24h-v4' and status='completed'
      order by finished_at desc limit 1
    `);
    if(!marker.length) return NextResponse.json({total:0});
    const [m]=marker;
    const rows=await db.unsafe(`
      select rp.source_post_id, d.surface_expression as text,
        coalesce(json_agg(json_build_object('type',ma.media_type,'url',ma.source_url,'preview_url',ma.preview_url))
        filter(where ma.id is not null),'[]'::json) as media
      from desires d
      join raw_posts rp on rp.id=d.primary_post_id
      left join media_assets ma on ma.post_id=rp.id
      where rp.platform='x' and rp.source_created_at >= $1 and rp.source_created_at < $2
      group by rp.source_post_id,d.surface_expression
    `,[new Date(m.start_time).toISOString(),new Date(m.end_time).toISOString()]);

    const posts=rows.filter((r:any)=>enrichDesireText(r.text||"").is_human_aspiration);
    let withMedia=0, displayable=0, textOnly=0, photoPosts=0, videoPosts=0, gifPosts=0;
    let photoAssets=0, videoAssets=0, gifAssets=0;
    for(const p of posts as any[]){
      const media=Array.isArray(p.media)?p.media:[];
      if(media.length) withMedia++;
      let hasDisplay=false,hasPhoto=false,hasVideo=false,hasGif=false;
      for(const mm of media){
        if(mm.type==="photo"){photoAssets++;hasPhoto=true}
        if(mm.type==="video"){videoAssets++;hasVideo=true}
        if(mm.type==="animated_gif"){gifAssets++;hasGif=true}
        if(mm.url||mm.preview_url) hasDisplay=true;
      }
      if(hasPhoto) photoPosts++;
      if(hasVideo) videoPosts++;
      if(hasGif) gifPosts++;
      if(hasDisplay) displayable++; else textOnly++;
    }
    return NextResponse.json({
      total_posts:posts.length,
      posts_with_any_media:withMedia,
      posts_with_displayable_image_or_preview:displayable,
      text_only_posts:textOnly,
      posts_by_media_type:{photo:photoPosts,video:videoPosts,animated_gif:gifPosts},
      media_assets:{photo:photoAssets,video:videoAssets,animated_gif:gifAssets},
      pct_with_displayable:posts.length?Number((displayable/posts.length*100).toFixed(1)):0
    });
  }finally{await db.end({timeout:2})}
}
