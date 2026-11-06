import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic="force-dynamic";

export async function GET(){
  const url=process.env.POSTGRES_URL;
  if(!url) return NextResponse.json({error:"db missing"},{status:503});
  const db=postgres(url,{max:1,ssl:"require"});
  try{
    const rows=await db.unsafe(`
      select
        rp.source_post_id,
        rp.text,
        rp.source_created_at,
        d.deep_desire,
        coalesce(
          json_agg(
            json_build_object(
              'type',ma.media_type,
              'url',ma.source_url,
              'preview_url',ma.preview_url,
              'width',ma.width,
              'height',ma.height,
              'alt_text',ma.alt_text
            )
          ) filter (where ma.id is not null),
          '[]'::json
        ) as media
      from raw_posts rp
      left join desires d on d.primary_post_id=rp.id
      left join media_assets ma on ma.post_id=rp.id
      where rp.platform='x'
        and (
          rp.text ilike '%унизить себя%'
          or rp.text ilike '%шлюх%'
          or rp.text ilike '%униж%'
        )
      group by rp.source_post_id,rp.text,rp.source_created_at,d.deep_desire
      order by rp.source_created_at desc
      limit 20
    `);
    return NextResponse.json({rows});
  }finally{await db.end({timeout:2})}
}
