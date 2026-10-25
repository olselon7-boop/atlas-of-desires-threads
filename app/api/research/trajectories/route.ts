import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({trajectories:[],storage:'browser-local',note:'Import a real corpus in /research/trajectories; no shared database is configured.'},{headers:{'Cache-Control':'no-store'}});}
