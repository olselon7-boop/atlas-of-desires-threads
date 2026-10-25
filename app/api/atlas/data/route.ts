import { NextResponse } from "next/server";
import { CorpusDataSource } from "@/lib/atlas/data-source";
import { readResearchSnapshot } from "@/lib/research/snapshot";
export const dynamic='force-dynamic';
export async function GET(){
  try{const source=new CorpusDataSource(await readResearchSnapshot());return NextResponse.json({desires:await source.getDesires(),trajectories:await source.getTrajectories(),source:'controlled-snapshot',note:'No synthetic records; import a research corpus locally if empty.'},{headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({error:'Atlas snapshot is invalid.'},{status:500});}
}
