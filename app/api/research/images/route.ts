import { NextResponse } from "next/server";
import { hasImage } from "@/lib/corpus";
import { readResearchSnapshot } from "@/lib/research/snapshot";
export const dynamic='force-dynamic';
export async function GET(){
  // The deployed corpus remains local to the researcher's browser until shared storage exists.
  // This endpoint exposes metadata only; raw controlled snapshots are never made public.
  try{const records=await readResearchSnapshot();return NextResponse.json({records:[],image_count:records.filter(hasImage).length,storage:'browser-local',analysis_configured:Boolean(process.env.OPENAI_API_KEY)},{headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({error:'Research snapshot is invalid.'},{status:500});}
}
