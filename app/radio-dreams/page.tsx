import { headers } from "next/headers";
import RadioDreamsClient from "./RadioDreamsClient";

export const dynamic = "force-dynamic";

async function getInitialFeed(){
  const h=await headers();
  const host=h.get("x-forwarded-host") || h.get("host");
  const proto=h.get("x-forwarded-proto") || "https";
  if(!host) throw new Error("Missing host");
  const response=await fetch(`${proto}://${host}/api/radio-dreams/daily`,{cache:"no-store"});
  if(!response.ok) throw new Error(`Radio Dreams feed failed: ${response.status}`);
  return response.json();
}

export default async function RadioDreamsPage(){
  const feed=await getInitialFeed();
  return <RadioDreamsClient initialFeed={feed} />;
}
