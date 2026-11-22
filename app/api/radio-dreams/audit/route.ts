import { NextRequest, NextResponse } from "next/server";
import { loadRadioDreamsToday } from "@/lib/x-persistence";
import { startOfTodayAmsterdamIso } from "@/lib/radio-dreams-source";
import { toRadioDreamCluster } from "@/lib/radio-dream-clusters";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
  const params=new URL(req.url).searchParams;
  const offset=Math.max(0,Number(params.get("offset")||0));
  const limit=Math.min(60,Math.max(1,Number(params.get("limit")||50)));
  const start=startOfTodayAmsterdamIso();
  const rows=await loadRadioDreamsToday(start);
  const items=rows.map((row:any)=>({
    id:row.id,
    text:row.text,
    created_at:row.created_at,
    source_cluster:row.cluster,
    radio_cluster:toRadioDreamCluster(row.cluster),
    state:row.state,
    agency:row.agency
  }));
  return NextResponse.json({
    total:items.length,
    offset,
    limit,
    items:items.slice(offset,offset+limit)
  },{
    headers:{
      "Cache-Control":"no-store, max-age=0",
      "X-Robots-Tag":"noindex"
    }
  });
}
