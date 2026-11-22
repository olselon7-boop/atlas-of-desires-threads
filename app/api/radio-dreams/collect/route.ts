import { NextRequest, NextResponse } from "next/server";
import { estimateXPostReadCost } from "@/lib/x";
import {
  fetchRadioDreamPages,
  RADIO_DREAM_QUERIES,
  startOfTodayAmsterdamIso
} from "@/lib/radio-dreams-source";
import {
  getRadioDreamCursors,
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
  const secret=process.env.CRON_SECRET;
  if(secret && req.headers.get("authorization")!==`Bearer ${secret}`){
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }

  const token=process.env.X_BEARER_TOKEN;
  if(!token) return NextResponse.json({error:"X is not configured"},{status:503});

  try{
    const before=await getRadioDreamCursors();
    const [ruPages,enPages]=await Promise.all([
      fetchRadioDreamPages(token,"ru",before.ru),
      fetchRadioDreamPages(token,"en",before.en)
    ]);

    const year=currentYearAmsterdam();
    const startTime=startOfTodayAmsterdamIso();
    const endTime=new Date().toISOString();
    let received=0;
    let insertedPosts=0;
    let insertedDesires=0;

    for(const [language,pages] of [["ru",ruPages],["en",enPages]] as const){
      for(const page of pages){
        const count=page.data?.length||0;
        received+=count;
        if(!count) continue;
        const persisted=await persistXSearchResponse({
          response:page,
          query:RADIO_DREAM_QUERIES[language],
          year,
          estimatedCostUsd:estimateXPostReadCost(count),
          mode:"radio-dreams-live",
          startTime,
          endTime
        });
        insertedPosts+=persisted.insertedPosts;
        insertedDesires+=persisted.insertedDesires;
      }
    }

    const after={
      ru:ruPages[0]?.meta?.newest_id || before.ru,
      en:enPages[0]?.meta?.newest_id || before.en
    };
    await saveRadioDreamCursors(after);

    return NextResponse.json({
      ok:true,
      received,
      inserted_posts:insertedPosts,
      inserted_desires:insertedDesires,
      pages:{ru:ruPages.length,en:enPages.length},
      cursors:after,
      collected_at:new Date().toISOString()
    },{headers:{"Cache-Control":"no-store, max-age=0"}});
  }catch(error){
    console.error("radio-dreams collector failed",error);
    return NextResponse.json({
      error:error instanceof Error?error.message:"Collector failed"
    },{status:502});
  }
}
