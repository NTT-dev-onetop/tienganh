(function(){
  const queue=[];let busy=false;
  function ensure(){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast-note';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');document.body.appendChild(el)}return el}
  async function show(msg,type='success',ms=2600){queue.push({msg,type,ms});if(busy)return;busy=true;const el=ensure();while(queue.length){const x=queue.shift();el.className=`toast-note ${x.type}`;el.textContent=String(x.msg??'');el.classList.add('show');await new Promise(r=>setTimeout(r,x.ms));el.classList.remove('show');await new Promise(r=>setTimeout(r,100))}busy=false}
  window.appToast=show;
})();
