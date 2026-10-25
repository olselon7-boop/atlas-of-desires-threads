import { NextRequest,NextResponse } from "next/server";
export async function POST(request:NextRequest){
  try{const body=await request.json();if(typeof body.id!=='string'||body.id.length>1000||!['same_dream','different_dream','insufficient_evidence'].includes(body.verdict))throw new Error();
    return NextResponse.json({review:{id:body.id,verdict:body.verdict},persisted:false,storage:'browser-local',note:'Save in localStorage; this response does not claim database persistence.'},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Invalid review.'},{status:400});}
}
