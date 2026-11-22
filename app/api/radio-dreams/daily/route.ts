import { NextResponse } from "next/server";
import { getRadioDreamCursors, loadRadioDreamsToday } from "@/lib/x-persistence";
import { startOfTodayAmsterdamIso } from "@/lib/radio-dreams-source";
import { toRadioDreamCluster } from "@/lib/radio-dream-clusters";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    const start=startOfTodayAmsterdamIso();
    const [posts,cursors]=await Promise.all([
      loadRadioDreamsToday(start),
      getRadioDreamCursors()
    ]);
    const radioPosts=posts
      .map((post:any)=>{
        const cluster=toRadioDreamCluster(post.cluster);
        if(!cluster) return null;
        return {
          ...post,
          source_cluster:post.cluster,
          cluster
        };
      })
      .filter(Boolean);

    const clusterCounts:Record<string,number>={};
    for(const post of radioPosts){
      const cluster=String((post as any).cluster);
      clusterCounts[cluster]=(clusterCounts[cluster]||0)+1;
    }
    return NextResponse.json({
      source:"postgres",
      timezone:"Europe/Amsterdam",
      start,
      fetched_at:new Date().toISOString(),
      total:radioPosts.length,
      review_total:posts.length-radioPosts.length,
      posts:radioPosts,
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
