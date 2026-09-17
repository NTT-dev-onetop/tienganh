(function(){
  const queue=[];let busy=false,currentTimer=null,currentResolve=null;
  function ensure(){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast-note';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');document.body.appendChild(el)}return el}
  async function show(msg,type='success',ms=2600){
    queue.push({msg,type,ms,action:arguments[3]});
    if(busy)return;
    busy=true;
    const el=ensure();
    while(queue.length){
      const x=queue.shift();
      el.className=`toast-note ${x.type}`;el.replaceChildren();
      const msgEl=document.createElement('span');msgEl.textContent=String(x.msg??'');el.appendChild(msgEl);
      let actionUsed=false;
      if(x.action?.label&&typeof x.action.onClick==='function'){
        const a=document.createElement('button');a.type='button';a.className='toast-action';a.textContent=x.action.label;
        a.onclick=()=>{
          if(actionUsed)return;actionUsed=true;
          if(currentTimer){clearTimeout(currentTimer);currentTimer=null}
          el.classList.remove('show');
          const resolve=currentResolve;currentResolve=null;
          try{x.action.onClick()}catch(e){console.error('Toast action failed:',e)}
          resolve?.();
        };
        el.appendChild(a);
      }
      el.classList.add('show');
      await new Promise(resolve=>{
        currentResolve=resolve;
        currentTimer=setTimeout(()=>{currentTimer=null;currentResolve=null;resolve()},Math.max(0,Number(x.ms)||0));
      });
      el.classList.remove('show');
      await new Promise(r=>setTimeout(r,100));
    }
    busy=false;
  }
  window.appToast=show;
})();