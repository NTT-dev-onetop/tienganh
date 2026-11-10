(function(){
  const queue=[];let busy=false,currentTimer=null,currentResolve=null;
  const isEn=()=>document.documentElement.lang==='en';

  function dismissCurrent(){
    if(currentTimer){clearTimeout(currentTimer);currentTimer=null;}
    const el=document.getElementById('toast');
    el?.classList.remove('show');
    const resolve=currentResolve;currentResolve=null;
    resolve?.();
  }

  function ensure(){
    let el=document.getElementById('toast');
    if(!el){
      el=document.createElement('div');
      el.id='toast';
      el.className='toast-note';
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      el.setAttribute('aria-atomic','true');
      document.body.appendChild(el);
    }
    if(!el.dataset.dismissBound){
      el.dataset.dismissBound='1';
      el.addEventListener('click',e=>{
        if(e.target.closest('.toast-action'))return;
        dismissCurrent();
      });
    }
    return el;
  }

  async function show(msg,type='success',ms=2600){
    queue.push({msg,type,ms,action:arguments[3]});
    if(busy)return;
    busy=true;
    const el=ensure();
    while(queue.length){
      const x=queue.shift();
      el.className=`toast-note ${x.type}`;
      el.replaceChildren();
      const msgEl=document.createElement('span');
      msgEl.textContent=String(x.msg??'');
      el.appendChild(msgEl);
      let actionUsed=false;
      if(x.action?.label&&typeof x.action.onClick==='function'){
        const a=document.createElement('button');
        a.type='button';
        a.className='toast-action';
        a.textContent=x.action.label;
        a.onclick=()=>{
          if(actionUsed)return;
          actionUsed=true;
          if(currentTimer){clearTimeout(currentTimer);currentTimer=null;}
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
        currentTimer=setTimeout(()=>{
          currentTimer=null;
          currentResolve=null;
          resolve();
        },Math.max(0,Number(x.ms)||0));
      });
      el.classList.remove('show');
      await new Promise(r=>setTimeout(r,100));
    }
    busy=false;
  }

  function sanitizeUserMessage(err,viFallback,enFallback){
    const en=isEn();
    const fallback=en?(enFallback||viFallback||'Something went wrong. Please try again.'):(viFallback||'Đã xảy ra lỗi. Vui lòng thử lại.');
    if(!err)return fallback;
    const code=String(err?.code||'').toLowerCase();
    const raw=typeof err==='string'?err:String(err?.message||'');
    if(code==='permission-denied')return en?'You do not have permission for this action.':'Bạn chưa có quyền thực hiện thao tác này.';
    if(code==='unauthenticated')return en?'Please sign in again to continue.':'Vui lòng đăng nhập lại để tiếp tục.';
    if(code==='unavailable'||code==='deadline-exceeded')return en?'Connection is temporarily unavailable. Please try again.':'Kết nối tạm gián đoạn. Vui lòng thử lại.';
    if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')return en?'Sign-in window was closed.':'Bạn đã đóng cửa sổ đăng nhập.';
    if(code==='auth/popup-blocked')return en?'Sign-in window was blocked by browser settings. Please allow pop-ups for this site.':'Cửa sổ đăng nhập bị chặn. Vui lòng cho phép mở cửa sổ đăng nhập trên trang web này.';
    if(code==='auth/network-request-failed')return en?'Network error. Please check your internet connection.':'Lỗi kết nối mạng. Vui lòng kiểm tra Internet.';
    if(!raw||/\b(firebase|firestore|firebaseerror|vercel|indexeddb|bootstrap|decompressionstream|insufficient permissions|failed to get document|client is offline)\b/i.test(raw)||/^auth\//i.test(raw)){
      return fallback;
    }
    return raw;
  }

  let dialogLock=null;
  function showDialog(mode,optsOrMsg){
    const opts=(optsOrMsg&&typeof optsOrMsg==='object')?optsOrMsg:{message:String(optsOrMsg??'')};
    const en=isEn();
    const rawMsg=String(opts.message||'');
    const inferredDanger=typeof opts.danger==='boolean'
      ? opts.danger
      : /\b(xóa|xoá|delete|remove|thoát|exit|mất|lost|cannot be undone|không thể hoàn tác)\b/i.test(rawMsg);
    const title=opts.title||(mode==='alert'?(en?'Notice':'Thông báo'):(enceivedTitle(en,inferredDanger)));
    const confirmText=opts.confirmText||(mode==='alert'?(en?'OK':'Đã hiểu'):(inferredDanger?(en?'Delete':'Xóa'):(en?'Confirm':'Đồng ý')));
    const cancelText=opts.cancelText||(en?'Cancel':'Hủy');

    function enceivedTitle(isEnglish,danger){
      if(danger)return isEnglish?'Confirm Action':'Xác nhận thao tác';
      return isEnglish?'Confirmation':'Xác nhận';
    }

    const run=()=>{
      return new Promise(resolve=>{
        document.querySelectorAll('.app-dialog-backdrop').forEach(n=>n.remove());
        const prevFocus=document.activeElement;
        const bd=document.createElement('div');
        bd.className='app-dialog-backdrop';
        bd.setAttribute('role','presentation');

        const box=document.createElement('div');
        box.className=`app-dialog${inferredDanger?' is-danger':''}`;
        box.setAttribute('role','alertdialog');
        box.setAttribute('aria-modal','true');
        const titleId=`appDialogTitle_${Date.now()}`;
        const msgId=`appDialogMsg_${Date.now()}`;
        box.setAttribute('aria-labelledby',titleId);
        box.setAttribute('aria-describedby',msgId);

        const header=document.createElement('div');
        header.className='app-dialog-head';
        const icon=document.createElement('span');
        icon.className='app-dialog-icon';
        icon.setAttribute('aria-hidden','true');
        icon.textContent=opts.icon||(inferredDanger?'⚠':mode==='alert'?'ℹ':'❓');
        const h=document.createElement('h4');
        h.className='app-dialog-title';
        h.id=titleId;
        h.textContent=title;
        header.appendChild(icon);
        header.appendChild(h);

        const body=document.createElement('div');
        body.className='app-dialog-body';
        body.id=msgId;
        rawMsg.split(/\n+/).filter(Boolean).forEach(line=>{
          const p=document.createElement('p');
          p.textContent=line;
          body.appendChild(p);
        });

        const footer=document.createElement('div');
        footer.className='app-dialog-actions';

        let cancelBtn=null;
        if(mode!=='alert'){
          cancelBtn=document.createElement('button');
          cancelBtn.type='button';
          cancelBtn.className='btn btn-outline-secondary app-dialog-cancel';
          cancelBtn.textContent=cancelText;
          footer.appendChild(cancelBtn);
        }

        const okBtn=document.createElement('button');
        okBtn.type='button';
        okBtn.className=`btn ${inferredDanger?'btn-danger':'btn-primary'} app-dialog-ok`;
        okBtn.textContent=confirmText;
        footer.appendChild(okBtn);

        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(footer);
        bd.appendChild(box);
        document.body.appendChild(bd);
        document.body.classList.add('app-dialog-open');

        requestAnimationFrame(()=>bd.classList.add('is-open'));

        let settled=false;
        const close=(result)=>{
          if(settled)return;
          settled=true;
          document.removeEventListener('keydown',onKey,true);
          bd.classList.remove('is-open');
          document.body.classList.remove('app-dialog-open');
          setTimeout(()=>{
            bd.remove();
            try{if(prevFocus&&typeof prevFocus.focus==='function'&&document.contains(prevFocus))prevFocus.focus();}catch{}
          },140);
          resolve(mode==='alert'?undefined:Boolean(result));
        };

        const focusables=cancelBtn?[cancelBtn,okBtn]:[okBtn];
        const onKey=(e)=>{
          if(!document.contains(bd))return;
          if(e.key==='Escape'){
            e.preventDefault();
            e.stopPropagation();
            if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
            close(false);
            return;
          }
          if(e.key==='Tab'){
            e.preventDefault();
            const cur=document.activeElement;
            const idx=focusables.indexOf(cur);
            const nextIdx=e.shiftKey?(idx<=0?focusables.length-1:idx-1):((idx+1)%focusables.length);
            focusables[nextIdx]?.focus();
          }
        };
        document.addEventListener('keydown',onKey,true);

        if(cancelBtn)cancelBtn.onclick=()=>close(false);
        okBtn.onclick=()=>close(true);
        bd.addEventListener('click',e=>{
          if(e.target===bd)close(false);
        });

        setTimeout(()=>{
          if(inferredDanger&&cancelBtn)cancelBtn.focus();
          else okBtn.focus();
        },20);
      });
    };

    const next=(dialogLock?dialogLock.catch(()=>{}):Promise.resolve()).then(run);
    dialogLock=next;
    return next;
  }

  window.appToast=show;
  window.appConfirm=(optsOrMsg)=>showDialog('confirm',optsOrMsg);
  window.appAlert=(optsOrMsg)=>showDialog('alert',optsOrMsg);
  window.appErrorMsg=sanitizeUserMessage;
})();
