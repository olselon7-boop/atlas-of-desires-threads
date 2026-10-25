"use client";
import { useCallback,useEffect,useState } from "react";
import { CORPUS_STORAGE, REVIEW_STORAGE, parseCorpus } from "@/lib/corpus";
import type { DesireRecord } from "@/lib/desire";
import type { TrajectoryReview } from "@/lib/trajectory";
export function useResearchCorpus(){
  const [records,setRecords]=useState<DesireRecord[]>([]);
  const [reviews,setReviews]=useState<Record<string,TrajectoryReview>>({});
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    function load(){try{
      const raw=localStorage.getItem(CORPUS_STORAGE)||localStorage.getItem('atlas-research-corpus-v1');
      setRecords(raw?parseCorpus(JSON.parse(raw)):[]);
      const saved=JSON.parse(localStorage.getItem(REVIEW_STORAGE)||'{}');
      setReviews(Object.fromEntries(Object.entries(saved).filter(([k,v])=>k.length<=1000&&['same_dream','different_dream','insufficient_evidence'].includes(String(v)))) as Record<string,TrajectoryReview>);
      setError('');
    }catch{setError('Не удалось прочитать локальный корпус. Сохраните исходный JSON и проверьте его структуру.');}finally{setReady(true);}}
    load();window.addEventListener('storage',load);window.addEventListener('atlas-corpus-updated',load);
    return()=>{window.removeEventListener('storage',load);window.removeEventListener('atlas-corpus-updated',load);};
  },[]);
  const saveRecords=useCallback((next:DesireRecord[])=>{
    try{localStorage.setItem(CORPUS_STORAGE,JSON.stringify({version:2,records:next}));setRecords(next);window.dispatchEvent(new Event('atlas-corpus-updated'));setError('');return true;}
    catch{setError('Хранилище переполнено или недоступно. Экспортируйте текущий корпус.');return false;}
  },[]);
  const saveReview=useCallback((id:string,verdict:TrajectoryReview)=>{
    try{const saved=JSON.parse(localStorage.getItem(REVIEW_STORAGE)||'{}');const next={...saved,[id]:verdict};localStorage.setItem(REVIEW_STORAGE,JSON.stringify(next));setReviews(next);return true;}
    catch{setError('Не удалось сохранить ручную проверку.');return false;}
  },[]);
  return {records,reviews,ready,error,setError,saveRecords,saveReview};
}
