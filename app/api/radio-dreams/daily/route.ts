import { NextResponse } from "next/server";
import { getRadioDreamCursors, loadRadioDreamsToday } from "@/lib/x-persistence";
import { startOfTodayAmsterdamIso } from "@/lib/radio-dreams-source";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    const start=startOfTodayAmsterdamIso();
    const [posts,cursors]=await Promise.all([
      loadRadioDreamsToday(start),
      getRadioDreamCursors()
    ]);
    const clusterCounts:Record<string,number>={};
    for(const post of posts){
      const cluster=String(post.cluster||"other");
      clusterCounts[cluster]=(clusterCounts[cluster]||0)+1;
    }
    return NextResponse.json({
      source:"postgres",
      timezone:"Europe/Amsterdam",
      start,
      fetched_at:new Date().toISOString(),
      total:posts.length,
      posts,
      cluster_counts:clusterCounts,
      cursors
    },{
      headers:{
        "Cache-Control":"no-store, max-age=0",
        "X-Robots-Tag":"noindex"
      }
    });
  }catch(error){
    console.error("radio-dreams daily feed failed",error);
    return NextResponse.json({
      error:error instanceof Error?error.message:"Daily feed failed"
    },{status:502});
  }
}
