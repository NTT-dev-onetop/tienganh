// Lớp làm khó việc sửa đáp án ở phía client; không phải mã hóa tuyệt đối.
const XOR_KEY=73;
const SECRET='EN11T1-client-secret-v1';
const toBase64=s=>btoa(String(s));
const fromBase64=s=>atob(String(s));
export function encodeCorrectIndex(index){
  const n=Number(index);
  if(!Number.isInteger(n)||n<0||n>9)return '';
  return toBase64(String(n^XOR_KEY));
}
export function decodeCorrectIndex(code){
  if(typeof code!=='string'||!code.trim())return -1;
  try{
    const n=Number(fromBase64(code));
    const idx=n^XOR_KEY;
    return Number.isInteger(idx)&&idx>=0&&idx<=9?idx:-1;
  }catch{return -1}
}
export function simpleHash(input){
  let h=2166136261;
  const s=String(input??'');
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
}
export function makeSignature(uid,setId,score,date){return simpleHash(`${uid}|${setId}|${score}|${date}|${SECRET}`)}
export function isValidToday(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(),local=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return date===local;
}
