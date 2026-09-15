const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const isPassedValue=v=>v===true||v===1||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='passed';
export function progressFromSubmissionDocs(docs){
  const byUid=new Map();
  const firstPassByUid=new Map();
  for(const d of docs||[]){const x=d?.data?d.data():(d||{});if(!isPassedValue(x.passed)||!x.uid||!x.setId)continue;const uid=String(x.uid);let m=firstPassByUid.get(uid);if(!m){m=new Map();firstPassByUid.set(uid,m)}const setId=String(x.setId);const old=m.get(setId);if(!old||String(x.date||'').localeCompare(String(old.date||''))<0)m.set(setId,x)}
  for(const [uid,setMap] of firstPassByUid){const dates=new Set();let lastCompletedDate='';for(const x of setMap.values()){const date=String(x.date||'');if(date){dates.add(date);if(!lastCompletedDate||new Date(date+'T00:00:00').getTime()>new Date(lastCompletedDate+'T00:00:00').getTime())lastCompletedDate=date}}const now=dateKey(new Date());const yDate=new Date();yDate.setDate(yDate.getDate()-1);const yesterday=dateKey(yDate);let streak=0;if(dates.has(now)||dates.has(yesterday)){const cursor=new Date((dates.has(now)?now:yesterday)+'T00:00:00');while(dates.has(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1)}}byUid.set(uid,{streak,totalPassed:setMap.size,totalBonus:setMap.size*2,lastCompletedDate})}
  return byUid;
}
export function getProgressForUid(docs,uid){return progressFromSubmissionDocs(docs).get(String(uid))||{streak:0,totalPassed:0,totalBonus:0,lastCompletedDate:''};}
