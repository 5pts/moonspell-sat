import"./modulepreload-polyfill-B5Qt9EMX.js";import"./questions.data-BVAEHkic.js";(function(){const E="moonspell-theme",m=document.body;if(!m)return;function $(i){m.classList.toggle("dark-mode",i==="dark");const c=document.querySelector(".theme-toggle");c&&(c.textContent=i==="dark"?"☼":"☾",c.title=i==="dark"?"Switch to light mode":"Switch to dark mode")}function I(){if(document.querySelector(".grain-overlay"))return;const i=document.createElement("div");i.className="grain-overlay",m.prepend(i)}function C(){if(document.querySelector(".ascii-rain"))return;const i=["+","×","÷","=",">","<","[ ]","{ }","SAT","VERB","NOUN","☽","☾","✧","A","B","C","D","///","\\\\"],c=["var(--text-primary)","var(--text-primary)","var(--text-primary)","var(--accent-blue)","var(--accent-orange)","var(--accent-red)"],g=document.createElement("div");g.className="ascii-rain";for(let S=0;S<45;S+=1){const d=document.createElement("div");d.className="ascii-symbol",d.textContent=i[Math.floor(Math.random()*i.length)],d.style.left=`${Math.random()*100}%`,d.style.color=c[Math.floor(Math.random()*c.length)],d.style.fontSize=`${Math.random()*4+2}rem`,d.style.opacity=`${Math.random()*.15+.05}`,d.style.animationDuration=`${Math.random()*20+10}s`,d.style.animationDelay=`-${Math.random()*30}s`,g.appendChild(d)}m.prepend(g)}function O(){if(document.querySelector(".theme-toggle"))return;const i=document.createElement("button");i.type="button",i.className="theme-toggle",i.addEventListener("click",function(){const c=m.classList.contains("dark-mode")?"light":"dark";window.localStorage.setItem(E,c),$(c)}),m.appendChild(i)}I(),C(),O(),$(window.localStorage.getItem(E)||"light")})();(async function(){const E="",m=window.QUESTION_BANK;if(!m)return;async function $(){const t=localStorage.getItem("moonspell_admin_token");try{const s=await fetch(`${E}/api/admin/data`,{headers:{Authorization:t}});if(!s.ok){if(s.status===401)return null;throw new Error("Failed to fetch data")}return await s.json()}catch(s){return console.warn("API fetch failed, falling back to local storage",s),null}}const I=await $(),C=!!I;console.log("Admin Mode:",C?"Remote API":"Local Storage");const O={USERS:"moonspell_users"},i={MISTAKES:"mistakes",HISTORY:"history"},c="moonspell-mistake-records",g=new Date().toISOString().slice(0,10),S=new Map(m.questions.map(function(t){return[t.globalId,t]}));function d(t,s){try{return JSON.parse(window.localStorage.getItem(t)||JSON.stringify(s))}catch{return s}}function D(t,s){if(!C)return d(`moonspell_user:${t}:${s}`,[]);if(s===i.HISTORY)return I.records.filter(n=>n.userId===t).map(n=>({questionId:n.questionId,correct:n.correct,at:n.at,mode:n.mode})).sort((n,e)=>new Date(e.at)-new Date(n.at));if(s===i.MISTAKES){const n=I.records.filter(o=>o.userId===t).sort((o,r)=>new Date(o.at)-new Date(r.at)),e=new Set;return n.forEach(o=>{o.correct?e.delete(o.questionId):e.add(o.questionId)}),Array.from(e)}return[]}function k(t){return t?String(t).slice(0,10):g}function R(t,s){const n=new Date(`${k(t)}T00:00:00`);return n.setDate(n.getDate()+s),n.toISOString().slice(0,10)}function z(t){const s=t.slice().sort(function(e,o){return new Date(e.at).getTime()-new Date(o.at).getTime()}),n=new Map;return s.forEach(function(e){const o=n.get(e.questionId)||{attempts:[],wrongCount:0,correctCount:0,lastWrongOn:null,lastSeen:null,lastMode:"LOCAL"};o.attempts.push(e),o.lastSeen=e.at,o.lastMode=e.mode||o.lastMode,e.correct?o.correctCount+=1:(o.wrongCount+=1,o.lastWrongOn=e.at),n.set(e.questionId,o)}),n.forEach(function(e,o){let r=0;for(let l=e.attempts.length-1;l>=0&&e.attempts[l].correct;l-=1)r+=1;n.set(o,{attemptsCount:e.attempts.length,wrongCount:e.wrongCount,correctCount:e.correctCount,lastWrongOn:e.lastWrongOn?k(e.lastWrongOn):null,lastSeen:e.lastSeen,lastMode:e.lastMode,streak:r})}),n}function F(t,s){const n=t.lastWrongOn||k(t.lastSeen)||g;return s?t.wrongCount>=4?n:t.wrongCount===3?R(n,1):t.wrongCount===2?R(n,2):R(n,3):R(n,14)}function j(t,s,n){return s?n<=g?"due":t.wrongCount<=1?"new":"review":"mastered"}function K(t,s,n){const e=[];return t&&t.sectionCode&&e.push(String(t.sectionCode).toLowerCase()),(String(t&&t.stem?t.stem:"").match(/_{4,}/g)||[]).length>1&&e.push("double blank"),s.lastMode==="ERROR"&&e.push("error review"),n&&e.push("active"),e.length?e:["practice"]}function Y(){const t=C?I.users:d(O.USERS,[]),s=[],n=[];return t.forEach(function(e){const o=D(e.id,i.HISTORY),r=new Set(D(e.id,i.MISTAKES)),l=z(o),h=new Set(r);l.forEach(function(f,v){f.wrongCount>0&&h.add(v)});const q=o.filter(function(f){return!!f.correct}).length;s.push({id:e.id,name:e.username||e.name||e.email||e.id,className:e.className||"Independent",grade:e.grade||"SAT SC",email:e.email||"",lastLogin:e.lastLoginAt?new Date(e.lastLoginAt).toLocaleString():"",totalAnswered:o.length,correctCount:q,accuracy:o.length?Math.round(q/o.length*100):0,activeMistakeCount:r.size}),h.forEach(function(f){const v=l.get(f)||{wrongCount:0,lastWrongOn:null,lastSeen:null,lastMode:"LOCAL",streak:0},dt=S.get(f),N=r.has(f);if(!N&&v.wrongCount===0)return;const W=F(v,N);n.push({id:`${e.id}::${f}`,studentId:e.id,questionId:f,wrongCount:v.wrongCount,streak:v.streak,status:j(v,N,W),lastWrongOn:v.lastWrongOn||g,nextReviewOn:W,note:"",tags:K(dt,v,N)})})}),s.sort(function(e,o){return String(e.name||"").localeCompare(String(o.name||""))}),n.sort(function(e,o){return e.nextReviewOn!==o.nextReviewOn?String(e.nextReviewOn).localeCompare(String(o.nextReviewOn)):o.wrongCount!==e.wrongCount?o.wrongCount-e.wrongCount:String(e.questionId).localeCompare(String(o.questionId))}),{students:s,records:n}}function B(){return d(c,{})}function Q(t){const s=B();s[t.id]={status:t.status,note:t.note,nextReviewOn:t.nextReviewOn},window.localStorage.setItem(c,JSON.stringify(s))}const w=Y(),y=new Map(w.students.map(function(t){return[t.id,t]})),U=B(),u=w.records.map(function(t){const s=U[t.id]||{};return{...t,...s}}),a={selectedClass:"all",selectedStudentId:"all",selectedStatus:"all",search:"",activeRecordId:u[0]?u[0].id:null},G=document.getElementById("dashboardStats"),_=document.getElementById("classSelect"),J=document.getElementById("studentList"),P=document.getElementById("recordHeading"),V=document.getElementById("recordSearch"),X=document.getElementById("statusFilters"),x=document.getElementById("recordTable"),b=document.getElementById("detailCard"),M=document.getElementById("studentSummary");function L(t,s){const n=document.createElement("div");return n.className="stat-card",n.innerHTML=`<strong>${t}</strong><span>${s}</span>`,n}function Z(){return u.filter(function(t){return t.nextReviewOn<=g&&t.status!=="mastered"}).length}function tt(){return u.filter(function(t){return t.wrongCount>=3}).length}function H(){G.replaceChildren(L(w.students.length,"Students"),L(u.length,"Mistake Records"),L(Z(),"Due Now"),L(tt(),"Repeat Misses"))}function et(){const t=["all"].concat(Array.from(new Set(w.students.map(function(s){return s.className}))).filter(Boolean).sort());_.innerHTML=t.map(function(s){return`<option value="${s}">${s==="all"?"All classes":s}</option>`}).join("")}function nt(){const t={};return u.forEach(function(s){t[s.studentId]=(t[s.studentId]||0)+1}),t}function st(){return w.students.filter(function(t){return a.selectedClass==="all"||t.className===a.selectedClass})}function T(){const t=nt(),s=document.createDocumentFragment(),n=document.createElement("button");if(n.type="button",n.className="student-item"+(a.selectedStudentId==="all"?" is-active":""),n.innerHTML=`<strong>All students</strong><div class="muted">${u.length} records</div>`,n.addEventListener("click",function(){a.selectedStudentId="all",T(),p()}),s.appendChild(n),st().forEach(function(e){const o=document.createElement("button");o.type="button",o.className="student-item"+(a.selectedStudentId===e.id?" is-active":""),o.innerHTML=`<strong>${e.name}</strong><div class="muted">${e.className} · ${e.grade} · ${t[e.id]||0} records</div>`,o.addEventListener("click",function(){a.selectedStudentId=e.id,T(),p()}),s.appendChild(o)}),!w.students.length){const e=document.createElement("div");e.className="empty-state",e.textContent="No real student accounts yet. Log in from the student app and complete a few questions first.",s.appendChild(e)}J.replaceChildren(s)}function A(){const t=[["all","All"],["new","New"],["review","Review"],["due","Due"],["mastered","Mastered"]],s=document.createDocumentFragment();t.forEach(function(n){const e=n[0],o=n[1],r=document.createElement("button");r.type="button",r.className="status-pill"+(a.selectedStatus===e?" is-active":""),r.textContent=o,r.addEventListener("click",function(){a.selectedStatus=e,A(),p()}),s.appendChild(r)}),X.replaceChildren(s)}function ot(t){const s=y.get(t.studentId),n=S.get(t.questionId);return[t.id,t.questionId,t.status,t.note,s?s.name:"",s?s.className:"",n?n.localId:"",n?n.sectionDisplayName:"",n?n.stem:""].join(" ").toLowerCase()}function at(){const t=a.search.trim().toLowerCase();return u.filter(function(s){const n=y.get(s.studentId);return a.selectedClass!=="all"&&n&&n.className!==a.selectedClass||a.selectedStudentId!=="all"&&s.studentId!==a.selectedStudentId||a.selectedStatus!=="all"&&s.status!==a.selectedStatus?!1:t?ot(s).includes(t):!0})}function it(){if(a.selectedStudentId==="all"){M.style.display="none";return}const t=y.get(a.selectedStudentId);if(!t){M.style.display="none";return}const n=u.filter(function(o){return o.studentId===t.id}).filter(function(o){return o.status!=="mastered"}).length,e=`${t.accuracy||0}%`;M.innerHTML=`
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 1.5rem; flex-wrap: wrap;">
        <div>
          <h3 style="margin: 0; font-size: 1.25rem;">${t.name}</h3>
          <div class="muted" style="margin-top: 0.25rem;">${t.className} · ${t.grade}</div>
          <div class="muted" style="margin-top: 0.25rem;">${t.email||"No email"}</div>
          <div class="muted" style="margin-top: 0.25rem;">Last Login: ${t.lastLogin||"Never"}</div>
        </div>
        <div style="text-align: right; display: flex; gap: 2rem; flex-wrap: wrap;">
          <div>
            <div class="muted" style="font-size: 0.875rem;">Accuracy</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${e}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Total Answered</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${t.totalAnswered||0}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Active Issues</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--red);">${n}</div>
          </div>
        </div>
      </div>
    `,M.style.display="block"}function p(){it();const t=at(),s=a.selectedStudentId==="all"?"all visible students":(y.get(a.selectedStudentId)||{}).name||"student";if(P.textContent=`${t.length} records for ${s}`,!w.students.length){x.innerHTML='<div class="empty-state">No real student data yet. Create a student account in the main app and answer a few questions first.</div>',b.innerHTML='<div class="detail-card is-empty">This board is now wired to real local student accounts only. Demo users have been removed.</div>';return}if(!t.length){x.innerHTML='<div class="empty-state">No mistake records matched the current filters.</div>',b.innerHTML='<div class="detail-card is-empty">Select another student or loosen the filters.</div>';return}t.some(function(o){return o.id===a.activeRecordId})||(a.activeRecordId=t[0].id);const n=document.createDocumentFragment(),e=document.createElement("div");e.className="record-row record-row__header",e.innerHTML=`
      <div>Student</div>
      <div>Question</div>
      <div>Section</div>
      <div>Wrong</div>
      <div>Next Review</div>
      <div>Status</div>
    `,n.appendChild(e),t.forEach(function(o){const r=y.get(o.studentId),l=S.get(o.questionId),h=document.createElement("button");h.type="button",h.className="record-row"+(o.id===a.activeRecordId?" is-active":""),h.innerHTML=`
        <div><strong>${r?r.name:o.studentId}</strong><div class="muted">${r?r.className:""}</div></div>
        <div><strong>${o.questionId}</strong><div class="muted">${l?l.localId:""}</div></div>
        <div>${l?l.sectionCode:"-"}</div>
        <div>${o.wrongCount}x</div>
        <div>${o.nextReviewOn}</div>
        <div><span class="status status--${o.status}">${o.status}</span></div>
      `,h.addEventListener("click",function(){a.activeRecordId=o.id,p()}),n.appendChild(h)}),x.replaceChildren(n),rt()}function rt(){const t=u.find(function(e){return e.id===a.activeRecordId});if(!t){b.innerHTML='<div class="detail-card is-empty">Select a record to inspect it.</div>';return}const s=y.get(t.studentId),n=S.get(t.questionId);if(!n){b.innerHTML='<div class="detail-card is-empty">The linked question was not found in the current bank.</div>';return}b.innerHTML=`
      <div class="detail-card__head">
        <div class="badge-row">
          <span class="badge">${t.questionId}</span>
          <span class="badge">${n.localId}</span>
          <span class="badge">${s?s.name:t.studentId}</span>
        </div>
        <h3>${n.sectionDisplayName}</h3>
      </div>

      <div class="detail-card__grid">
        <div class="detail-row">
          <strong>Question</strong>
          <div>${n.stem}</div>
        </div>

        <div class="detail-row">
          <strong>Options</strong>
          <ol class="detail-options">
            ${n.options.map(function(e){return`<li><span class="option-label">${e.label}</span><span>${e.text}</span></li>`}).join("")}
          </ol>
        </div>

        <div class="detail-row">
          <strong>Teaching Notes</strong>
          <div class="detail-meta">Wrong count ${t.wrongCount} · current streak ${t.streak} · tags ${t.tags.join(", ")}</div>
        </div>

        <label class="field">
          <span>Status</span>
          <select id="detailStatus">
            ${["new","review","due","mastered"].map(function(e){return`<option value="${e}" ${e===t.status?"selected":""}>${e}</option>`}).join("")}
          </select>
        </label>

        <label class="field">
          <span>Next Review</span>
          <input id="detailReviewDate" type="date" value="${t.nextReviewOn}" />
        </label>

        <label class="field">
          <span>Teacher Note</span>
          <textarea id="detailNote">${t.note}</textarea>
        </label>

        <div class="detail-actions">
          <button id="saveRecord" class="button button--solid" type="button">Save record</button>
        </div>
      </div>
    `,document.getElementById("saveRecord").addEventListener("click",function(){t.status=document.getElementById("detailStatus").value,t.nextReviewOn=document.getElementById("detailReviewDate").value,t.note=document.getElementById("detailNote").value.trim(),Q(t),H(),A(),p()})}_.addEventListener("change",function(t){if(a.selectedClass=t.target.value,a.selectedStudentId!=="all"){const s=y.get(a.selectedStudentId);(!s||a.selectedClass!=="all"&&s.className!==a.selectedClass)&&(a.selectedStudentId="all")}T(),p()}),V.addEventListener("input",function(t){a.search=t.target.value,p()}),H(),et(),T(),A(),p()})();
