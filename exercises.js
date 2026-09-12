// Chuẩn hóa dữ liệu bài tập về một schema duy nhất.
export function normalizeExerciseItem(kind, raw){
  if(typeof kind!=='string'||!kind.trim()||raw==null)return null;
  const k=kind.trim().toLowerCase();
  const validKinds=new Set(['mcq','two','form','rewrite','reading','closest','opposite']);
  if(!validKinds.has(k))return null;

  let prompt='',options=[],correctIndex=-1,explain='',answer='';
  if(k==='mcq'){
    if(!Array.isArray(raw)||raw.length<7)return null;
    prompt=String(raw[0]??'').trim();
    options=raw.slice(1,5).map(x=>String(x??'').trim());
    correctIndex=Number(raw[5]);
    explain=String(raw[6]??'').trim();
  }else if(k==='two'){
    if(!Array.isArray(raw)||raw.length<4)return null;
    prompt=String(raw[0]??'').trim();
    options=raw.slice(1,3).map(x=>String(x??'').trim());
    correctIndex=Number(raw[3]);
  }else if(k==='form'||k==='rewrite'){
    if(!Array.isArray(raw)||raw.length<2)return null;
    prompt=String(raw[0]??'').trim();
    answer=String(raw[1]??'').trim();
    options=answer?[answer]:[];
    correctIndex=0;
  }else if(k==='reading'){
    if(!Array.isArray(raw)||raw.length<3||!Array.isArray(raw[1]))return null;
    prompt=String(raw[0]??'').trim();
    options=raw[1].map(x=>String(x??'').trim());
    correctIndex=Number(raw[2]);
  }else{
    if(!Array.isArray(raw)||raw.length!==5)return null;
    const word=String(raw[0]??'').trim();
    if(word.length<1)return null;
    prompt=`Choose the ${k} meaning of ${word}`;
    options=raw.slice(1,4).map(x=>String(x??'').trim());
    correctIndex=Number(raw[4]);
  }

  if(prompt.length<3)return null;
  if(!Array.isArray(options)||options.length<1)return null;
  if((k!=='form'&&k!=='rewrite')&&options.length<2)return null;
  if(options.some(x=>typeof x!=='string'||!x.trim()))return null;
  if(!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length)return null;
  if((k==='form'||k==='rewrite')&&!answer)return null;
  return {kind:k,prompt,options,correctIndex,explain};
}
