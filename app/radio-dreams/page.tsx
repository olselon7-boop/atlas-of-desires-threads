import RadioDreamsClient from "./RadioDreamsClient";

export const dynamic = "force-dynamic";

export default function RadioDreamsPage(){
  return <RadioDreamsClient initialFeed={{
    source:"x_recent_live",
    date:"",
    timezone:"Europe/Amsterdam",
    start:"",
    end:"",
    total:0,
    posts:[],
    cluster_counts:{}
  }} />;
}
