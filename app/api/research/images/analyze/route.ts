import { NextRequest,NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { parseCorpus } from "@/lib/corpus";
import { analyzeBatch, MAX_IMAGE_BATCH } from "@/lib/research/visual-analysis";
export const maxDuration=300;
export async function POST(request:NextRequest){
  // A separate researcher credential protects paid calls; never use the OpenAI key in the browser.
  if(process.env.OPENAI_API_KEY){
    const expected=process.env.RESEARCH_ANALYSIS_TOKEN;
    if(!expected)return NextResponse.json({error:'Set RESEARCH_ANALYSIS_TOKEN on the server before enabling paid analysis.'},{status:503});
    const actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
    if(Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return NextResponse.json({error:'Research authorization required.'},{status:401});
  }
  try{
    const text=await request.text();if(text.length>2_000_000)return NextResponse.json({error:'Batch too large.'},{status:413});
    const records=parseCorpus(JSON.parse(text),MAX_IMAGE_BATCH);
    const results=await analyzeBatch(records);
    return NextResponse.json({status:process.env.OPENAI_API_KEY?'completed':'not_configured',results,storage:'browser-local; persist returned analysis with the corpus',max_batch_size:MAX_IMAGE_BATCH},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:`Invalid corpus; maximum ${MAX_IMAGE_BATCH} records.`},{status:400});}
}
