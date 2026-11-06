import postgres from "postgres";
import { enrichDesireText } from "@/lib/desire-enrichment";
import RadioDreamsClient from "./RadioDreamsClient";

export const dynamic = "force-dynamic";

async function getInitialFeed(){
  const dbUrl=process.env.POSTGRES_URL;
  if(!dbUrl) throw new Error("Database is not configured");
  const db=postgres(dbUrl,{max:1,ssl:"require"});

  try{
    const marker=await db.unsafe(`
      select start_time,end_time,metadata
      from collection_runs
      where platform='x'
        and query='radio-dreams-rolling24h-v4'
        and status='completed'
      order by finished_at desc
      limit 1
    `);

    if(!marker.length){
      return {
        source:"x_recent_daily",
        date:"",
        timezone:"Europe/London",
        start:"",
        end:"",
        total:0,
        posts:[],
        cluster_counts:{}
      };
    }

    const start=new Date(marker[0].start_time);
    const end=new Date(marker[0].end_time);
    const rows=await db.unsafe(`
      select
        d.id,
        rp.source_post_id as source_id,
        d.surface_expression as text,
        rp.source_created_at as created_at,
        d.language,
        d.deep_desire as cluster,
        d.dream_state as state,
        d.agency,
        d.confidence,
        coalesce(
          json_agg(
            json_build_object(
              'type', ma.media_type,
              'url', ma.source_url,
              'preview_url', ma.preview_url,
              'width', ma.width,
              'height', ma.height,
              'alt_text', ma.alt_text
            )
          ) filter (where ma.id is not null),
          '[]'::json
        ) as media
      from desires d
      join raw_posts rp on rp.id=d.primary_post_id
      left join media_assets ma on ma.post_id=rp.id
      where rp.platform='x'
        and rp.source_created_at >= $1
        and rp.source_created_at < $2
        and d.is_human_aspiration=true
      group by d.id, rp.source_post_id, rp.source_created_at, d.language, d.deep_desire,
               d.dream_state, d.agency, d.confidence
      order by rp.source_created_at asc
    `,[start.toISOString(),end.toISOString()]);

    const posts=rows
      .map((row:any)=>{
        const enriched=enrichDesireText(row.text||"");
        return {
          id:row.source_id,
          text:row.text,
          created_at:row.created_at,
          language:row.language,
          cluster:enriched.deep_desire,
          state:enriched.lifecycle_state,
          agency:enriched.agency,
          confidence:Number(enriched.confidence||0),
          permalink:`https://x.com/i/web/status/${row.source_id}`,
          media:row.media||[],
          is_human_aspiration:enriched.is_human_aspiration
        };
      })
      .filter((post:any)=>post.is_human_aspiration);

    const cluster_counts:Record<string,number>={};
    for(const post of posts) cluster_counts[post.cluster]=(cluster_counts[post.cluster]||0)+1;

    const date=marker[0]?.metadata?.snapshot_key || marker[0]?.metadata?.date || "";
    return {
      source:"x_recent_daily",
      date,
      timezone:"Europe/London",
      start:start.toISOString(),
      end:end.toISOString(),
      total:posts.length,
      posts,
      cluster_counts
    };
  } finally {
    await db.end({timeout:2});
  }
}

export default async function RadioDreamsPage(){
  const feed=await getInitialFeed();
  return <RadioDreamsClient initialFeed={feed} />;
}
