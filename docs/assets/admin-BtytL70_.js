import"./modulepreload-polyfill-B5Qt9EMX.js";import"./questions.data-BVAEHkic.js";(function(){const b="moonspell-theme",f=document.body;if(!f)return;function E(r){f.classList.toggle("dark-mode",r==="dark");const l=document.querySelector(".theme-toggle");l&&(l.textContent=r==="dark"?"☼":"☾",l.title=r==="dark"?"Switch to light mode":"Switch to dark mode")}function w(){if(document.querySelector(".grain-overlay"))return;const r=document.createElement("div");r.className="grain-overlay",f.prepend(r)}function h(){if(document.querySelector(".ascii-rain"))return;const r=["+","×","÷","=",">","<","[ ]","{ }","SAT","VERB","NOUN","☽","☾","✧","A","B","C","D","///","\\\\"],l=["var(--text-primary)","var(--text-primary)","var(--text-primary)","var(--accent-blue)","var(--accent-orange)","var(--accent-red)"],g=document.createElement("div");g.className="ascii-rain";for(let y=0;y<45;y+=1){const d=document.createElement("div");d.className="ascii-symbol",d.textContent=r[Math.floor(Math.random()*r.length)],d.style.left=`${Math.random()*100}%`,d.style.color=l[Math.floor(Math.random()*l.length)],d.style.fontSize=`${Math.random()*4+2}rem`,d.style.opacity=`${Math.random()*.15+.05}`,d.style.animationDuration=`${Math.random()*20+10}s`,d.style.animationDelay=`-${Math.random()*30}s`,g.appendChild(d)}f.prepend(g)}function R(){if(document.querySelector(".theme-toggle"))return;const r=document.createElement("button");r.type="button",r.className="theme-toggle",r.addEventListener("click",function(){const l=f.classList.contains("dark-mode")?"light":"dark";window.localStorage.setItem(b,l),E(l)}),f.appendChild(r)}w(),h(),R(),E(window.localStorage.getItem(b)||"light")})();(async function(){const b="",f=window.QUESTION_BANK;if(!f)return;async function E(){const e=localStorage.getItem("moonspell_admin_token")||"",s=String(e).replace(/^Bearer\s+/i,"").trim();try{const n=await fetch(`${b}/api/admin/data`,{headers:s?{Authorization:`Bearer ${s}`}:{}});if(!n.ok){if(n.status===401)return null;throw new Error("Failed to fetch data")}return await n.json()}catch(n){return console.warn("API fetch failed, falling back to local storage",n),null}}let w=await E(),h=!!w;console.log("Admin Mode:",h?"Remote API":"Local Storage");const R={USERS:"moonspell_users"},r={MISTAKES:"mistakes",HISTORY:"history"},l="moonspell-mistake-records",g=new Date().toISOString().slice(0,10),y=new Map(f.questions.map(function(e){return[e.globalId,e]}));function d(e,s){try{return JSON.parse(window.localStorage.getItem(e)||JSON.stringify(s))}catch{return s}}async function j(){if(!h)return{inserted:0,total:0,users:0};const e=d(R.USERS,[]).filter(function(o){return o&&o.id});let s=0,n=0,t=0;for(const o of e){const i=d(`moonspell_user:${o.id}:${r.HISTORY}`,[]);if(!(!Array.isArray(i)||!i.length)){t+=1,n+=i.length;try{const c=await fetch(`${b}/api/records/bulk`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user:o,records:i})});if(!c.ok)continue;const m=await c.json();s+=Number(m.inserted||0)}catch{}}}return{inserted:s,total:n,users:t}}if(h){const e=await j();if(e.inserted>0){const s=await E();s&&(w=s,h=!0)}e.total>0&&console.log("Recovery scan:",e)}function D(e,s){if(!h)return d(`moonspell_user:${e}:${s}`,[]);if(s===r.HISTORY)return w.records.filter(n=>n.userId===e).map(n=>({questionId:n.questionId,correct:n.correct,at:n.at,mode:n.mode})).sort((n,t)=>new Date(t.at)-new Date(n.at));if(s===r.MISTAKES){const n=w.records.filter(o=>o.userId===e).sort((o,i)=>new Date(o.at)-new Date(i.at)),t=new Set;return n.forEach(o=>{o.correct?t.delete(o.questionId):t.add(o.questionId)}),Array.from(t)}return[]}function k(e){return e?String(e).slice(0,10):g}function T(e,s){const n=new Date(`${k(e)}T00:00:00`);return n.setDate(n.getDate()+s),n.toISOString().slice(0,10)}function z(e){const s=e.slice().sort(function(t,o){return new Date(t.at).getTime()-new Date(o.at).getTime()}),n=new Map;return s.forEach(function(t){const o=n.get(t.questionId)||{attempts:[],wrongCount:0,correctCount:0,lastWrongOn:null,lastSeen:null,lastMode:"LOCAL"};o.attempts.push(t),o.lastSeen=t.at,o.lastMode=t.mode||o.lastMode,t.correct?o.correctCount+=1:(o.wrongCount+=1,o.lastWrongOn=t.at),n.set(t.questionId,o)}),n.forEach(function(t,o){let i=0;for(let c=t.attempts.length-1;c>=0&&t.attempts[c].correct;c-=1)i+=1;n.set(o,{attemptsCount:t.attempts.length,wrongCount:t.wrongCount,correctCount:t.correctCount,lastWrongOn:t.lastWrongOn?k(t.lastWrongOn):null,lastSeen:t.lastSeen,lastMode:t.lastMode,streak:i})}),n}function F(e,s){const n=e.lastWrongOn||k(e.lastSeen)||g;return s?e.wrongCount>=4?n:e.wrongCount===3?T(n,1):e.wrongCount===2?T(n,2):T(n,3):T(n,14)}function U(e,s,n){return s?n<=g?"due":e.wrongCount<=1?"new":"review":"mastered"}function Y(e,s,n){const t=[];return e&&e.sectionCode&&t.push(String(e.sectionCode).toLowerCase()),(String(e&&e.stem?e.stem:"").match(/_{4,}/g)||[]).length>1&&t.push("double blank"),s.lastMode==="ERROR"&&t.push("error review"),n&&t.push("active"),t.length?t:["practice"]}function K(){const e=h?w.users:d(R.USERS,[]),s=[],n=[];return e.forEach(function(t){const o=D(t.id,r.HISTORY),i=new Set(D(t.id,r.MISTAKES)),c=z(o),m=new Set(i);c.forEach(function(v,p){v.wrongCount>0&&m.add(p)});const q=o.filter(function(v){return!!v.correct}).length;s.push({id:t.id,name:t.username||t.name||t.email||t.id,className:t.className||"Independent",grade:t.grade||"SAT SC",email:t.email||"",lastLogin:t.lastLoginAt?new Date(t.lastLoginAt).toLocaleString():"",totalAnswered:o.length,correctCount:q,accuracy:o.length?Math.round(q/o.length*100):0,activeMistakeCount:i.size}),m.forEach(function(v){const p=c.get(v)||{wrongCount:0,lastWrongOn:null,lastSeen:null,lastMode:"LOCAL",streak:0},ce=y.get(v),N=i.has(v);if(!N&&p.wrongCount===0)return;const W=F(p,N);n.push({id:`${t.id}::${v}`,studentId:t.id,questionId:v,wrongCount:p.wrongCount,streak:p.streak,status:U(p,N,W),lastWrongOn:p.lastWrongOn||g,nextReviewOn:W,note:"",tags:Y(ce,p,N)})})}),s.sort(function(t,o){return String(t.name||"").localeCompare(String(o.name||""))}),n.sort(function(t,o){return t.nextReviewOn!==o.nextReviewOn?String(t.nextReviewOn).localeCompare(String(o.nextReviewOn)):o.wrongCount!==t.wrongCount?o.wrongCount-t.wrongCount:String(t.questionId).localeCompare(String(o.questionId))}),{students:s,records:n}}function B(){return d(l,{})}function Q(e){const s=B();s[e.id]={status:e.status,note:e.note,nextReviewOn:e.nextReviewOn},window.localStorage.setItem(l,JSON.stringify(s))}const I=K(),C=new Map(I.students.map(function(e){return[e.id,e]})),G=B(),u=I.records.map(function(e){const s=G[e.id]||{};return{...e,...s}}),a={selectedClass:"all",selectedStudentId:"all",selectedStatus:"all",search:"",activeRecordId:u[0]?u[0].id:null},J=document.getElementById("dashboardStats"),_=document.getElementById("classSelect"),P=document.getElementById("studentList"),V=document.getElementById("recordHeading"),X=document.getElementById("recordSearch"),Z=document.getElementById("statusFilters"),A=document.getElementById("recordTable"),$=document.getElementById("detailCard"),L=document.getElementById("studentSummary");function M(e,s){const n=document.createElement("div");return n.className="stat-card",n.innerHTML=`<strong>${e}</strong><span>${s}</span>`,n}function ee(){return u.filter(function(e){return e.nextReviewOn<=g&&e.status!=="mastered"}).length}function te(){return u.filter(function(e){return e.wrongCount>=3}).length}function H(){J.replaceChildren(M(I.students.length,"Students"),M(u.length,"Mistake Records"),M(ee(),"Due Now"),M(te(),"Repeat Misses"))}function ne(){const e=["all"].concat(Array.from(new Set(I.students.map(function(s){return s.className}))).filter(Boolean).sort());_.innerHTML=e.map(function(s){return`<option value="${s}">${s==="all"?"All classes":s}</option>`}).join("")}function se(){const e={};return u.forEach(function(s){e[s.studentId]=(e[s.studentId]||0)+1}),e}function oe(){return I.students.filter(function(e){return a.selectedClass==="all"||e.className===a.selectedClass})}function O(){const e=se(),s=document.createDocumentFragment(),n=document.createElement("button");if(n.type="button",n.className="student-item"+(a.selectedStudentId==="all"?" is-active":""),n.innerHTML=`<strong>All students</strong><div class="muted">${u.length} records</div>`,n.addEventListener("click",function(){a.selectedStudentId="all",O(),S()}),s.appendChild(n),oe().forEach(function(t){const o=document.createElement("button");o.type="button",o.className="student-item"+(a.selectedStudentId===t.id?" is-active":""),o.innerHTML=`<strong>${t.name}</strong><div class="muted">${t.className} · ${t.grade} · ${e[t.id]||0} records</div>`,o.addEventListener("click",function(){a.selectedStudentId=t.id,O(),S()}),s.appendChild(o)}),!I.students.length){const t=document.createElement("div");t.className="empty-state",t.textContent="No real student accounts yet. Log in from the student app and complete a few questions first.",s.appendChild(t)}P.replaceChildren(s)}function x(){const e=[["all","All"],["new","New"],["review","Review"],["due","Due"],["mastered","Mastered"]],s=document.createDocumentFragment();e.forEach(function(n){const t=n[0],o=n[1],i=document.createElement("button");i.type="button",i.className="status-pill"+(a.selectedStatus===t?" is-active":""),i.textContent=o,i.addEventListener("click",function(){a.selectedStatus=t,x(),S()}),s.appendChild(i)}),Z.replaceChildren(s)}function ae(e){const s=C.get(e.studentId),n=y.get(e.questionId);return[e.id,e.questionId,e.status,e.note,s?s.name:"",s?s.className:"",n?n.localId:"",n?n.sectionDisplayName:"",n?n.stem:""].join(" ").toLowerCase()}function ie(){const e=a.search.trim().toLowerCase();return u.filter(function(s){const n=C.get(s.studentId);return a.selectedClass!=="all"&&n&&n.className!==a.selectedClass||a.selectedStudentId!=="all"&&s.studentId!==a.selectedStudentId||a.selectedStatus!=="all"&&s.status!==a.selectedStatus?!1:e?ae(s).includes(e):!0})}function re(){if(a.selectedStudentId==="all"){L.style.display="none";return}const e=C.get(a.selectedStudentId);if(!e){L.style.display="none";return}const n=u.filter(function(o){return o.studentId===e.id}).filter(function(o){return o.status!=="mastered"}).length,t=`${e.accuracy||0}%`;L.innerHTML=`
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 1.5rem; flex-wrap: wrap;">
        <div>
          <h3 style="margin: 0; font-size: 1.25rem;">${e.name}</h3>
          <div class="muted" style="margin-top: 0.25rem;">${e.className} · ${e.grade}</div>
          <div class="muted" style="margin-top: 0.25rem;">${e.email||"No email"}</div>
          <div class="muted" style="margin-top: 0.25rem;">Last Login: ${e.lastLogin||"Never"}</div>
        </div>
        <div style="text-align: right; display: flex; gap: 2rem; flex-wrap: wrap;">
          <div>
            <div class="muted" style="font-size: 0.875rem;">Accuracy</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${t}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Total Answered</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${e.totalAnswered||0}</div>
          </div>
          <div>
            <div class="muted" style="font-size: 0.875rem;">Active Issues</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--red);">${n}</div>
          </div>
        </div>
      </div>
    `,L.style.display="block"}function S(){re();const e=ie(),s=a.selectedStudentId==="all"?"all visible students":(C.get(a.selectedStudentId)||{}).name||"student";if(V.textContent=`${e.length} records for ${s}`,!I.students.length){A.innerHTML='<div class="empty-state">No real student data yet. Create a student account in the main app and answer a few questions first.</div>',$.innerHTML='<div class="detail-card is-empty">This board is now wired to real local student accounts only. Demo users have been removed.</div>';return}if(!e.length){A.innerHTML='<div class="empty-state">No mistake records matched the current filters.</div>',$.innerHTML='<div class="detail-card is-empty">Select another student or loosen the filters.</div>';return}e.some(function(o){return o.id===a.activeRecordId})||(a.activeRecordId=e[0].id);const n=document.createDocumentFragment(),t=document.createElement("div");t.className="record-row record-row__header",t.innerHTML=`
      <div>Student</div>
      <div>Question</div>
      <div>Section</div>
      <div>Wrong</div>
      <div>Next Review</div>
      <div>Status</div>
    `,n.appendChild(t),e.forEach(function(o){const i=C.get(o.studentId),c=y.get(o.questionId),m=document.createElement("button");m.type="button",m.className="record-row"+(o.id===a.activeRecordId?" is-active":""),m.innerHTML=`
        <div><strong>${i?i.name:o.studentId}</strong><div class="muted">${i?i.className:""}</div></div>
        <div><strong>${o.questionId}</strong><div class="muted">${c?c.localId:""}</div></div>
        <div>${c?c.sectionCode:"-"}</div>
        <div>${o.wrongCount}x</div>
        <div>${o.nextReviewOn}</div>
        <div><span class="status status--${o.status}">${o.status}</span></div>
      `,m.addEventListener("click",function(){a.activeRecordId=o.id,S()}),n.appendChild(m)}),A.replaceChildren(n),de()}function de(){const e=u.find(function(t){return t.id===a.activeRecordId});if(!e){$.innerHTML='<div class="detail-card is-empty">Select a record to inspect it.</div>';return}const s=C.get(e.studentId),n=y.get(e.questionId);if(!n){$.innerHTML='<div class="detail-card is-empty">The linked question was not found in the current bank.</div>';return}$.innerHTML=`
      <div class="detail-card__head">
        <div class="badge-row">
          <span class="badge">${e.questionId}</span>
          <span class="badge">${n.localId}</span>
          <span class="badge">${s?s.name:e.studentId}</span>
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
            ${n.options.map(function(t){return`<li><span class="option-label">${t.label}</span><span>${t.text}</span></li>`}).join("")}
          </ol>
        </div>

        <div class="detail-row">
          <strong>Teaching Notes</strong>
          <div class="detail-meta">Wrong count ${e.wrongCount} · current streak ${e.streak} · tags ${e.tags.join(", ")}</div>
        </div>

        <label class="field">
          <span>Status</span>
          <select id="detailStatus">
            ${["new","review","due","mastered"].map(function(t){return`<option value="${t}" ${t===e.status?"selected":""}>${t}</option>`}).join("")}
          </select>
        </label>

        <label class="field">
          <span>Next Review</span>
          <input id="detailReviewDate" type="date" value="${e.nextReviewOn}" />
        </label>

        <label class="field">
          <span>Teacher Note</span>
          <textarea id="detailNote">${e.note}</textarea>
        </label>

        <div class="detail-actions">
          <button id="saveRecord" class="button button--solid" type="button">Save record</button>
        </div>
      </div>
    `,document.getElementById("saveRecord").addEventListener("click",function(){e.status=document.getElementById("detailStatus").value,e.nextReviewOn=document.getElementById("detailReviewDate").value,e.note=document.getElementById("detailNote").value.trim(),Q(e),H(),x(),S()})}_.addEventListener("change",function(e){if(a.selectedClass=e.target.value,a.selectedStudentId!=="all"){const s=C.get(a.selectedStudentId);(!s||a.selectedClass!=="all"&&s.className!==a.selectedClass)&&(a.selectedStudentId="all")}O(),S()}),X.addEventListener("input",function(e){a.search=e.target.value,S()}),H(),ne(),O(),x(),S()})();
