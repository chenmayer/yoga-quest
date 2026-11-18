// Yoga Quest application and game logic. Course content lives in data/.

'use strict';
const KEY='yoga-quest-v1';const TODAY=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
let data=load();data.profiles ||= {};data.active ||= 'אני';data.extra ||= [];data.homework ||= {};data.customTasks ||= [];data.profiles[data.active] ||= fresh();let tab='home',session=null, importStatus='';let special=null;let practicePick={kind:null,topic:null};let cardSession=null;
function fresh(){return {xp:0,streak:0,lastDay:null,answered:0,correct:0,history:{},days:{},homework:{}}}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}function p(){const profile=data.profiles[data.active];profile.homework ||= {};return profile}
function questions(){return [...INITIAL,...data.extra].map(q=>({...q,lesson:q.lesson||(/^(c\d{2}|n1\d{2})$/.test(q.id)?'10.11.2026':undefined)}))}const topics=['סנסקריט','פילוסופיה','הוראה ואליינמנט','ויניאסה ונשימה'];const symbols={'סנסקריט':'🔤','פילוסופיה':'🧠','הוראה ואליינמנט':'🧘','ויניאסה ונשימה':'🔁'};
function level(){return Math.floor(p().xp/100)+1}function sinceLevel(){return p().xp%100}
function selectTab(t){if(t==='coverage')t='progress';if(session&&!session.done)persistQuiz();if(cardSession&&!cardSession.done)persistCards();tab=t;session=null;special=null;cardSession=null;render()}function stats(){return `<div class="stats"><div><b>🔥 ${p().streak}</b><small>ימי רצף</small></div><div><b>✨ ${p().xp}</b><small>XP שנצבר</small></div><div><b>${p().answered?Math.round(100*p().correct/p().answered):0}%</b><small>תשובות נכונות</small></div></div>`}

function lessonDateValue(date){const [day,month,year]=date.split('.').map(Number);return year*10000+month*100+day}
function recentLessons(){return [...LESSON_NOTES].sort((a,b)=>lessonDateValue(b.date)-lessonDateValue(a.date))}
const LESSON_CHOICES=recentLessons().map(lesson=>({date:lesson.date,label:lesson.day+' · '+lesson.date.slice(0,5),sub:lesson.title}));
function openPractice(kind){
 practicePick={kind,topic:null};tab='practice-pick';session=null;special=null;render();
}
function pickPracticeTopic(value){
 practicePick.topic=value;render();
}
function practicePicker(){
 const kind=practicePick.kind;
 const topic=practicePick.topic;
 const items=kind==='topic'?topics.map(t=>({value:t,label:t,sub:questions().filter(q=>q.topic===t).length+' שאלות'})):
 kind==='lesson'?LESSON_CHOICES.map(l=>({value:'lesson:'+l.date,label:l.label,sub:l.sub+' · '+questions().filter(q=>q.lesson===l.date).length+' שאלות'})):[];
 const selected=topic;
 const count=selected?questionPool(selected,questions()).length:kind==='mixed'?questions().length:0;
 return '<div class="row"><button class="btn secondary small" onclick="'+(selected?"practicePick.topic=null;render()":"selectTab('home')")+'">חזרה</button><span class="pill">בחירת תרגול</span></div>'+
 '<h1 class="picker-title">'+(kind==='topic'?'תרגול לפי נושא':kind==='lesson'?'תרגול לפי שיעור':'תרגול מעורב')+'</h1>'+
 (!selected&&kind!=='mixed'?'<p class="muted">בחרי '+(kind==='topic'?'נושא':'שיעור')+' לתרגול</p><div class="picker-list">'+items.map(item=>'<button class="picker-choice" onclick="pickPracticeTopic('+JSON.stringify(item.value).replace(/"/g,'&quot;')+')"><span><b>'+esc(item.label)+'</b><small>'+esc(item.sub)+'</small></span><span aria-hidden="true">←</span></button>').join('')+'</div>':
 '<div class="card picker-length">'+
 '<h2>'+(kind==='mixed'?'כמה שאלות תרצי לפתור?':esc(items.find(x=>x.value===selected)?.label||selected))+'</h2>'+
 '<p class="muted">'+count+' שאלות זמינות'+(kind==='mixed'?' מכל הנושאים':'')+'</p>'+
 '<div class="length-options">'+
 '<button class="length-choice" onclick="begin('+JSON.stringify(kind==='mixed'?'mixed':selected).replace(/"/g,'&quot;')+')"><b>10 שאלות</b><small>תרגול קצר</small></button>'+
 (count>10?'<button class="length-choice" onclick="begin('+JSON.stringify(kind==='mixed'?'mixed':selected).replace(/"/g,'&quot;')+',20)"><b>20 שאלות</b><small>תרגול בינוני</small></button>':'')+
 '<button class="length-choice" onclick="begin('+JSON.stringify(kind==='mixed'?'mixed':selected).replace(/"/g,'&quot;')+',true)"><b>כל השאלות</b><small>'+count+' שאלות'+(kind==='mixed'?' בסדר אקראי':'')+'</small></button></div></div>');
}
function home(){
 const total=questions().length,unseen=unseenQuestions().length,seen=total-unseen;
 return '<div class="card hero dashboard-hero"><div class="row"><span class="pill">רמה '+level()+'</span><span class="muted">🔥 '+p().streak+' ימי רצף</span></div>'+
 '<h1>מה מתרגלים היום?</h1><div class="hero-metrics"><div><b>'+seen+' / '+total+'</b><small>שאלות שכבר ראית</small></div><div><b>'+unseen+'</b><small>שאלות חדשות</small></div><div><b>'+p().xp+'</b><small>XP שנצברו</small></div></div>'+
 '<div class="meter" aria-label="התקדמות בצפייה בשאלות"><div style="width:'+(total?Math.round(seen/total*100):0)+'%"></div></div>'+
 '<button class="btn light full" onclick="'+(unseen?"begin('unseen')":"openPractice('mixed')")+'">'+(unseen?'התחלת תרגול · שאלות חדשות':'התחלת תרגול מעורב')+'</button></div>'+
 (p().activeQuiz?'<div class="card resume-panel"><div class="row"><div><b>להמשיך מהנקודה שבה עצרת</b><p class="muted">שאלה '+(p().activeQuiz.index+1)+' מתוך '+p().activeQuiz.items.length+'</p></div><button class="btn small" onclick="resumeQuiz()">המשך תרגול</button></div><button class="btn outline small" onclick="abandonQuiz()" style="margin-top:10px">מחיקת הסבב השמור</button></div>':'')+
 (p().activeCards?'<div class="card resume-panel"><div class="row"><div><b>המשך כרטיסיות סנסקריט</b><p class="muted">כרטיס '+(p().activeCards.index+1)+' מתוך '+p().activeCards.ids.length+'</p></div><button class="btn small" onclick="resumeCards()">המשך</button></div></div>':'')+
 '<h2 class="section">איך תרצי לתרגל?</h2>'+
 '<div class="modegrid home-choices">'+
 '<button class="modetile" onclick="begin(\'unseen\')" '+(unseen?'':'disabled')+'><span class="mode-icon">✦</span><b>שאלות חדשות</b><small>'+unseen+' שאלות שעוד לא ראית</small></button>'+
 '<button class="modetile" onclick="openPractice(\'mixed\')"><span class="mode-icon">⇄</span><b>תרגול מעורב</b><small>כל הנושאים, בסדר אקראי</small></button>'+
 '<button class="modetile" onclick="openPractice(\'topic\')"><span class="mode-icon">▤</span><b>לפי נושא</b><small>סנסקריט, פילוסופיה ועוד</small></button>'+
 '<button class="modetile" onclick="openPractice(\'lesson\')"><span class="mode-icon">◷</span><b>לפי שיעור</b><small>בחירה לפי תאריך</small></button></div>'+
 '<details class="card extra-games"><summary>משחקים נוספים <span class="extra-caret" aria-hidden="true">⌄</span></summary><p class="muted">כרטיסיות סנסקריט · התאמות · השלמות · רצפים · זיהוי תנוחות</p>'+
 '<div class="game-links"><button class="game-link" onclick="selectTab(\'cards\')">כרטיסיות סנסקריט</button><button class="game-link" onclick="startSpecial(\'match\')">התאמות</button><button class="game-link" onclick="startSpecial(\'fill\')">השלמות</button><button class="game-link" onclick="startSpecial(\'order\')">סידור רצף</button><button class="game-link" onclick="startSpecial(\'image\')">זיהוי תנוחות</button></div></details>'+
 '<div class="card compact-review"><div class="row"><div><b>חזרה מתוזמנת</b><p class="muted">'+dueCount()+' שאלות לחזרה</p></div><button class="btn secondary small" onclick="begin(\'due\')" '+(dueCount()?'':'disabled')+'>תרגול</button></div></div>'+
 '<p class="footnote">ההתקדמות נשמרת בדפדפן במכשיר הזה בלבד.</p>';
}


function toggleHomework(id){p().homework[id]=!p().homework[id];save();render()}
function addCustomTask(){
 const field=document.getElementById('newHomeworkTask');
 const title=field?.value.trim();
 if(!title)return;
 const id='personal-'+Date.now()+'-'+Math.floor(Math.random()*10000);
 data.customTasks.push({id,group:'משימות אישיות',title,detail:'משימה שהוספת',source:'personal'});
 save();render();
}
function removeCustomTask(id){data.customTasks=data.customTasks.filter(t=>t.id!==id);delete p().homework[id];save();render()}

/* Explicit evidence map for the notebook lessons.
 * Mapping is question-level: a matched question demonstrates presence, not mastery.
 * Add a facet question ID (or a future q.coverageId) after verifying its content.
 */
function coverageFacetIds(f){
 const ids=new Set(f.ids);
 questions().forEach(q=>{if(q.coverageId===f.id)ids.add(q.id)});
 return [...ids].filter(id=>questions().some(q=>q.id===id));
}
function coverageTotals(lesson){
 const facets=COVERAGE_UNITS.filter(u=>!lesson||u.lesson===lesson).flatMap(u=>u.facets);
 const covered=facets.filter(f=>coverageFacetIds(f).length>0).length;
 return {covered,total:facets.length,missing:facets.length-covered};
}

function homeworkView(){
 const tasks=[...HOMEWORK,...data.customTasks];
 const done=tasks.filter(t=>p().homework[t.id]).length;
 const groups=[...new Set(tasks.map(t=>t.group))];
 return '<h1>שיעורי בית</h1><div class="card"><div class="row"><b>התקדמות במשימות</b><span class="pill">'+done+' / '+tasks.length+'</span></div><div class="meter" style="margin-top:13px"><div style="width:'+(tasks.length?done/tasks.length*100:0)+'%"></div></div><p class="footnote">כל סימון נשמר בפרופיל הנוכחי. הרשימה עודכנה לפי צילום ההנחיות של שני: תרגול בבית וקריאה מומלצת. אפשר לסמן כל משימה כהושלמה.</p></div>'+
 groups.map(group=>'<h2 class="section">'+esc(group)+'</h2><div class="card">'+tasks.filter(t=>t.group===group).map(t=>'<label class="hwitem"><input type="checkbox" '+(p().homework[t.id]?'checked':'')+' onchange="toggleHomework(\''+esc(t.id)+'\')"><span class="hwcopy"><b class="'+(p().homework[t.id]?'hwcompleted':'')+'">'+esc(t.title)+'</b><small>'+esc(t.detail)+'</small></span>'+(t.source==='personal'?'<button type="button" class="btn outline small" onclick="event.preventDefault();removeCustomTask(\''+esc(t.id)+'\')">מחיקה</button>':'')+'</label>').join('')+'</div>').join('')+
 '<div class="card"><h2>הוספת משימה</h2><div class="answerfield"><input class="field" id="newHomeworkTask" placeholder="שם המשימה" maxlength="150"><button class="btn" onclick="addCustomTask()">הוספה</button></div></div>';
}

function weakTopic(){let a=questions().filter(q=>p().history[q.id]?.wrong>0).sort((x,y)=>(p().history[y.id].wrong||0)-(p().history[x.id].wrong||0));return a.length?`כדאי לחזור על ${a[0].topic} — היו שם טעויות בתרגולים קודמים.`:'עדיין אין טעויות שנרשמו. אפשר להתחיל מכל נושא ולגלות מה צריך חיזוק.'}
function hasSeenQuestion(q){
 // One-time migration: legacy history did not distinguish quizzes from mini-games.
 // After migration, only displaying a trivia question adds it to seenQuiz.
 if(!p().seenQuizMigrated){
  p().seenQuiz ||= {};
  Object.keys(p().history||{}).forEach(id=>{p().seenQuiz[id]=true});
  p().seenQuizMigrated=true;save();
 }
 return !!p().seenQuiz[q.id];
}
function unseenQuestions(){return questions().filter(q=>!hasSeenQuestion(q))}
function markQuestionShown(q){
 hasSeenQuestion(q);
 if(!p().seenQuiz[q.id]){p().seenQuiz[q.id]=true;save()}
}
function questionPool(topic,all){
 return topic==='all'||topic==='mixed'?all:
 topic==='unseen'?all.filter(q=>!hasSeenQuestion(q)):
 topic==='weak'?all.filter(q=>p().history[q.id]?.wrong>0):
 topic==='due'?all.filter(q=>isDue(q)):
 topic.startsWith('lesson:')?all.filter(q=>q.lesson===topic.slice(7)):
 all.filter(q=>q.topic===topic);
}

function persistQuiz(){
 if(!session||session.done)return;
 p().activeQuiz=JSON.parse(JSON.stringify(session));save();
}
function resumeQuiz(){
 const saved=p().activeQuiz;
 if(!saved||!Array.isArray(saved.items)||!saved.items.length)return;
 // Discard invalidated cards from outdated/removed banks rather than corrupting a saved answer.
 if(!saved.items.every(q=>questions().some(n=>n.id===q.id))){p().activeQuiz=null;save();return}
 session=JSON.parse(JSON.stringify(saved));special=null;cardSession=null;tab='quiz';render();
}
function pauseQuiz(){
 persistQuiz();session=null;tab='home';render();
}
function abandonQuiz(){
 p().activeQuiz=null;save();session=null;tab='home';render();
}
function begin(topic,full=false){
 const all=questions(),pool=questionPool(topic,all);
 if(!pool.length){alert(topic==='unseen'?'כבר צפית בכל שאלות הטריוויה! אפשר לתרגל במצב מעורבב.':'אין כרגע שאלות מתאימות. אפשר לנסות תרגול מעורבב.');return}
 const recent=new Set(p().recentQuestions||[]);
 let selected=[];
 if(topic==='mixed'){selected=shuffled(pool).slice(0,full===true?pool.length:(typeof full==='number'?Math.min(full,pool.length):10))}
 else if(topic==='unseen'){selected=shuffled(pool).slice(0,Math.min(10,pool.length))}
 else{
  const weighted=pool.map(q=>({q,score:reviewPriority(q)+(recent.has(q.id)?-5:0)+Math.random()*1.4})).sort((a,b)=>b.score-a.score).map(x=>x.q);
  const limit=full===true?pool.length:Math.min(typeof full==='number'?full:10,pool.length);
  if(topic==='all'){
   const buckets=Object.fromEntries(topics.map(t=>[t,weighted.filter(q=>q.topic===t)]));
   const order=shuffled(topics);
   while(selected.length<limit){
    let moved=false;
    for(const t of order){if(buckets[t].length&&selected.length<limit){selected.push(buckets[t].shift());moved=true}}
    if(!moved)break;
   }
   selected=shuffled(selected);
  }else selected=weighted.slice(0,limit);
 }
 // Remember recent offered questions for session rotation, but do not count them as seen.
 p().recentQuestions=selected.slice(-10).map(q=>q.id);save();
 session={topic,full,items:selected.map(q=>{const indexes=shuffled([0,1,2,3]);return {...q,options:indexes.map(i=>q.options[i]),answer:indexes.indexOf(q.answer)}}),index:0,chosen:null,pending:null,gained:0,correct:0,done:false};
 tab='quiz';persistQuiz();render();
}
function chooseQuiz(i){if(!session||session.chosen!==null)return;session.pending=session.pending===i?null:i;persistQuiz();render()}
function clearPendingQuiz(){if(!session)return;session.pending=null;persistQuiz();render()}
function confirmQuiz(){if(!session||session.pending===null||session.chosen!==null)return;answer(session.pending)}
function answer(i){if(!session||session.chosen!==null)return;const q=session.items[session.index];session.chosen=i;const ok=i===q.answer;const h=p().history[q.id]||{correct:0,wrong:0};h[ok?'correct':'wrong']++;applyReview(h,ok);p().history[q.id]=h;p().answered++;if(ok){p().correct++;p().xp+=10;session.gained+=10;session.correct++}updateStreak();persistQuiz();render()}
function updateStreak(){let t=TODAY();if(p().lastDay===t)return;const y=new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});p().streak=p().lastDay===y?p().streak+1:1;p().lastDay=t;p().days[t]=true}
function next(){if(!session)return;if(session.index===session.items.length-1){session.done=true;p().activeQuiz=null;save()}else{session.index++;session.chosen=null;session.pending=null;persistQuiz()}render()}
function quiz(){if(!session)return home();if(session.done)return `<div class="card" style="text-align:center;padding:34px 20px"><div style="font-size:48px">🌟</div><h1>סיכום התרגול</h1><p>ענית נכון על <b>${session.correct}</b> מתוך <b>${session.items.length}</b> שאלות</p><h2 class="strong">+${session.gained} XP</h2><p class="muted">השאלות שבהן טעית יופיעו יותר בתרגולים הבאים.</p><button class="btn full" onclick="begin('${session.topic}',${session.full})">לשחק שוב</button><button class="btn secondary full" style="margin-top:9px" onclick="selectTab('home')">חזרה לבית</button></div>`;
const q=session.items[session.index],c=session.chosen,done=c!==null;markQuestionShown(q);return `<div class="row"><button class="close" aria-label="סגירה" onclick="pauseQuiz()" title="שמירה ויציאה">×</button><span class="pill">✨ +${session.gained} XP</span></div><div class="qmeta" style="margin-top:12px"><span>שאלה ${session.index+1} מתוך ${session.items.length}</span><span>${esc(q.topic)}</span></div><div class="meter"><div style="width:${session.index/session.items.length*100}%"></div></div><div class="card" style="margin-top:18px"><div class="row"><span class="tag">${q.source==='course'?'📚 מתוך חומר הקורס':'🌱 ידע משלים'}</span><span class="muted">10 XP לתשובה נכונה</span></div><h1 class="question">${esc(q.q)}</h1><div class="stack">${q.options.map((o,i)=>`<button class="option ${done?(i===q.answer?'correct':i===c?'wrong':''):(session.pending===i?'pending':'')}" aria-pressed="${!done&&session.pending===i}" ${done?'disabled':''} onclick="chooseQuiz(${i})">${done&&i===q.answer?'✓ ':''}${esc(o)}</button>`).join('')}</div>${!done?`<div class="actionrow"><button class="btn secondary" ${session.pending===null?'disabled':''} onclick="clearPendingQuiz()">ביטול בחירה</button><button class="btn" ${session.pending===null?'disabled':''} onclick="confirmQuiz()">בדיקת תשובה</button></div>`:''}${done?`<div class="feedback ${c===q.answer?'':'wrong'}"><strong>${c===q.answer?'תשובה נכונה':'תשובה לא נכונה'}</strong><div>${esc(q.why)}</div></div><button class="btn full" onclick="next()">${session.index===session.items.length-1?'סיום התרגול':'השאלה הבאה ←'}</button>`:''}</div>`}
function progress(){return `<h1>ההתקדמות שלי</h1><div class="card">${stats()}<div style="margin-top:19px"><b>רמה ${level()}</b><div class="meter" style="margin-top:9px"><div style="width:${sinceLevel()}%"></div></div></div></div><h2 class="section">שליטה לפי נושא</h2>${topics.map(t=>{let qs=questions().filter(q=>q.topic===t),attempts=qs.reduce((s,q)=>s+(p().history[q.id]?.correct||0)+(p().history[q.id]?.wrong||0),0),correct=qs.reduce((s,q)=>s+(p().history[q.id]?.correct||0),0),seen=qs.filter(q=>p().history[q.id]).length;return `<div class="card"><div class="row"><b>${symbols[t]} ${t}</b><span class="muted">${qs.filter(hasSeenQuestion).length}/${qs.length} שאלות שנראו</span></div><div class="meter" style="margin:12px 0"><div style="width:${attempts?Math.round(correct/attempts*100):0}%"></div></div><div class="muted">${attempts?Math.round(correct/attempts*100)+'% הצלחה ('+attempts+' ניסיונות)':'עוד לא תרגלת את הנושא'}</div></div>`}).join('')}<p class="footnote">המדדים מבוססים על ניסיונות עד כה; הם לא תחליף להערכת הבנה בהוראה מעשית.</p>`}
function community(){let ranks=Object.entries(data.profiles).sort((a,b)=>b[1].xp-a[1].xp);return `<h1>קהילה</h1><div class="card"><b>פרופילים במכשיר הזה</b><p class="muted">גרסת הדגמה: אפשר לעבור בין פרופילים במכשיר אחד. שיתוף דירוג חי בין חברי הקורס יתווסף עם התחברות לענן.</p><label for="profile">הפרופיל הפעיל</label><select class="field" id="profile" onchange="switchProfile(this.value)">${Object.keys(data.profiles).map(n=>`<option ${n===data.active?'selected':''}>${esc(n)}</option>`).join('')}</select><label for="newProfile">הוספת פרופיל מקומי</label><div class="row"><input id="newProfile" class="field" maxlength="30" placeholder="שם התלמיד/ה"><button class="btn" onclick="addProfile()">הוספה</button></div></div><h2 class="section">דירוג מקומי</h2><div class="card">${ranks.map(([n,v],i)=>`<div class="leader"><span>${i+1}. ${esc(n)}</span><strong>${v.xp} XP</strong></div>`).join('')}</div>`}
function switchProfile(n){if(!data.profiles[n])return;data.active=n;save();render()}function addProfile(){let n=document.getElementById('newProfile').value.trim();if(!n)return alert('נא להזין שם');if(data.profiles[n])return alert('פרופיל בשם הזה כבר קיים');data.profiles[n]=fresh();data.active=n;save();render()}

function startCards(direction='sanskrit'){
 cardSession={direction,ids:shuffled(SANSKRIT_CARDS.map(c=>c.id)),index:0,revealed:false,known:0,again:0,done:false};
 session=null;special=null;tab='cards';persistCards();render();
}
function persistCards(){if(!cardSession||cardSession.done)return;p().activeCards=JSON.parse(JSON.stringify(cardSession));save()}
function resumeCards(){
 const old=p().activeCards;if(!old||!Array.isArray(old.ids)||!old.ids.length)return;
 cardSession=JSON.parse(JSON.stringify(old));session=null;special=null;tab='cards';render();
}
function pauseCards(){persistCards();cardSession=null;tab='home';render()}
function abandonCards(){p().activeCards=null;save();cardSession=null;tab='home';render()}
function flipCard(){if(!cardSession||cardSession.done)return;cardSession.revealed=!cardSession.revealed;persistCards();render()}
function gradeCard(known){
 if(!cardSession||cardSession.done||!cardSession.revealed)return;
 const id=cardSession.ids[cardSession.index];
 p().cardStats ||= {};
 const h=p().cardStats[id]||{known:0,again:0};
 h[known?'known':'again']++;p().cardStats[id]=h;
 if(known)cardSession.known++;else cardSession.again++;
 cardSession.index++;cardSession.revealed=false;
 if(cardSession.index>=cardSession.ids.length){cardSession.done=true;p().activeCards=null;save()}
 else persistCards();
 render();
}
function cardsView(){
 if(!cardSession)return '<div class="card"><h1>כרטיסיות סנסקריט</h1><p class="muted">46 מושגים וביטויים מתוך המחברות. הפכי כרטיס כדי לבדוק את עצמך, ואז סמני אם ידעת.</p><div class="length-options"><button class="length-choice" onclick="startCards(\'sanskrit\')"><b>סנסקריט ← עברית</b><small>הכרטיס מציג מונח בסנסקריט</small></button><button class="length-choice" onclick="startCards(\'hebrew\')"><b>עברית ← סנסקריט</b><small>הכרטיס מציג משמעות בעברית</small></button></div></div>';
 if(cardSession.done)return '<div class="card"><h1>סיימת את הכרטיסיות</h1><p>ידעת '+cardSession.known+' מתוך '+cardSession.ids.length+' כרטיסיות.</p><p class="muted">'+cardSession.again+' כרטיסיות סימנת לחזרה.</p><button class="btn full" onclick="startCards(\''+cardSession.direction+'\')">סבב חדש</button><button class="btn secondary full" style="margin-top:8px" onclick="selectTab(\'home\')">חזרה לבית</button></div>';
 const item=SANSKRIT_CARDS.find(c=>c.id===cardSession.ids[cardSession.index]);if(!item)return '';
 const isSanskrit=cardSession.direction==='sanskrit',front=isSanskrit?item.term:item.meaning,back=isSanskrit?item.meaning:item.term;
 return '<div class="row"><button class="btn secondary small" onclick="pauseCards()">שמירה ויציאה</button><span class="pill">'+(cardSession.index+1)+' / '+cardSession.ids.length+'</span></div>'+
 '<h1 class="picker-title">כרטיסיות סנסקריט</h1><p class="muted">'+(isSanskrit?'סנסקריט → עברית':'עברית → סנסקריט')+'</p>'+
 '<div class="meter" style="margin:15px 0"><div style="width:'+Math.round(cardSession.index/cardSession.ids.length*100)+'%"></div></div>'+
 '<button class="flashcard" onclick="flipCard()" aria-label="הפיכת כרטיס"><small>'+(cardSession.revealed?'התשובה':'מה המשמעות?')+'</small><strong '+(isSanskrit&&!cardSession.revealed||!isSanskrit&&cardSession.revealed?'dir="ltr"':'')+'>'+esc(cardSession.revealed?back:front)+'</strong><span>'+(cardSession.revealed?'לחצי כדי לראות שוב את המונח':'לחצי כדי להפוך את הכרטיס')+'</span></button>'+
 (cardSession.revealed?'<div class="actionrow"><button class="btn secondary" onclick="gradeCard(false)">לחזור על זה</button><button class="btn" onclick="gradeCard(true)">ידעתי</button></div>':'<p class="footnote">נסי להיזכר לפני שאת הופכת את הכרטיס.</p>');
}


function library(){
 return '<h1>ספריית שיעורים</h1><p class="muted">סיכומים מהמחברת לפי תאריך, עם אפשרות לתרגל את החומר של כל שיעור.</p>'+
 '<div class="card"><div class="row"><div><b>כרטיסיות סנסקריט</b><p class="muted">'+SANSKRIT_CARDS.length+' מונחים · שני כיווני תרגול</p></div><button class="btn secondary small" onclick="selectTab(\'cards\')">פתיחה</button></div></div>'+
 recentLessons().map(lesson=>{
 const count=questions().filter(q=>q.lesson===lesson.date).length;
 return '<div class="card lesson-card"><h2>'+esc(lesson.day+' · '+lesson.date)+'</h2><b>'+esc(lesson.title)+'</b><p class="footnote">'+esc(lesson.source)+'</p>'+
 '<p class="muted">'+count+' שאלות משויכות לשיעור</p>'+
 '<div class="actionrow"><button class="btn secondary small" onclick="begin(\'lesson:'+lesson.date+'\')">10 שאלות</button><button class="btn small" onclick="begin(\'lesson:'+lesson.date+'\',true)">כל השאלות</button></div>'+
 '<div class="lesson-notes">'+lesson.sections.map(section=>'<details><summary>'+esc(section.title)+'</summary><ul>'+section.points.map(point=>'<li>'+esc(point)+'</li>').join('')+'</ul></details>').join('')+'</div></div>';
 }).join('')+
 '<details class="card archive-section"><summary>מאגר השאלות וייבוא חומר</summary><p class="muted">אפשר לעיין בשאלות, להוסיף חומר חדש ולייצא גיבוי של ההתקדמות.</p>'+
 '<p><b>'+questions().length+' שאלות · '+INITIAL.length+' מובנות · '+data.extra.length+' נוספו בייבוא</b></p>'+
 '<label for="topicLibrary">סינון לפי נושא</label><select id="topicLibrary" class="field" onchange="filterLibrary(this.value)"><option value="all">כל הנושאים</option>'+topics.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select>'+
 '<div id="libraryList" class="stack" style="margin-top:13px;max-height:420px;overflow:auto">'+questionList('all')+'</div>'+
 '<h2>עדכון חומר חדש</h2><p class="muted">ייבוא JSON מוסיף רק שאלות עם מזהים חדשים.</p>'+
 '<details><summary>דוגמה לפורמט שאלות</summary><pre style="direction:ltr;text-align:left;overflow-x:auto;white-space:pre-wrap;font-size:12px">'+esc(JSON.stringify([{id:'lesson-03-001',topic:'סנסקריט',source:'course',q:'מה פירוש המושג?',options:['א','ב','ג','ד'],answer:0,why:'הסבר התשובה'}],null,2))+'</pre></details>'+
 '<label for="importFile">ייבוא שאלות (JSON)</label><input class="field" id="importFile" type="file" accept=".json,application/json" onchange="importQuestions(this)"><p class="footnote">'+esc(importStatus)+'</p>'+
 '<button class="btn secondary full" onclick="download(\'questions\')">ייצוא מאגר השאלות</button><button class="btn outline full" style="margin-top:8px" onclick="download(\'backup\')">גיבוי נתוני התרגול</button></details>';
}
function questionList(t){return questions().filter(q=>t==='all'||q.topic===t).map(q=>`<div style="border-bottom:1px solid var(--line);padding:10px 0"><div class="row"><b>${esc(q.q)}</b><span class="tag">${q.source==='course'?'קורס':'השלמה'}</span></div><small class="muted">${esc(q.topic)}</small></div>`).join('')}
function filterLibrary(t){document.getElementById('libraryList').innerHTML=questionList(t)}
function download(what){let payload=what==='backup'?{version:1,exportedAt:new Date().toISOString(),data}:questions();let blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});let url=URL.createObjectURL(blob);let a=document.createElement('a');a.href=url;a.download=what==='backup'?'yogaquest-backup.json':'yogaquest-questions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importQuestions(input){const file=input.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed))throw Error('הקובץ חייב להכיל מערך שאלות');const current=new Set(questions().map(q=>q.id));let add=[];for(const q of parsed){if(typeof q.id!=='string'||!q.id.trim()||typeof q.q!=='string'||typeof q.why!=='string'||!topics.includes(q.topic)||!['course','extra'].includes(q.source)||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string')||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw Error('לפחות שאלה אחת חסרה שדות או אינה בפורמט תקין');if(!current.has(q.id)){add.push(q);current.add(q.id)}}data.extra.push(...add);save();importStatus=`נוספו ${add.length} שאלות חדשות בהצלחה`;render()}catch(e){importStatus='הייבוא נכשל: '+e.message;render()}}
function render(){document.getElementById('app').innerHTML=`<div class="top"><div class="brand"><div class="logo">ॐ</div><div><strong>Yoga Quest</strong></div></div><span class="pill">👤 ${esc(data.active)}</span></div>${tab==='home'?home():tab==='practice-pick'?practicePicker():tab==='quiz'?quiz():tab==='cards'?cardsView():tab==='special'?specialView():tab==='progress'?progress():tab==='community'?community():tab==='homework'?homeworkView():library()}<nav class="tabs" aria-label="ניווט">${[['home','⌂','בית'],['progress','◫','התקדמות'],['homework','☑','שיעורי בית'],['community','♧','קהילה'],['library','▤','שיעורים']].map(([t,ic,name])=>`<button onclick="selectTab('${t}')" class="${tab===t||tab==='quiz'&&t==='home'||tab==='practice-pick'&&t==='home'||tab==='cards'&&t==='home'?'active':''}"><span class="ico">${ic}</span>${name}</button>`).join('')}</nav>`}

/* Yoga Quest 1.1: review scheduling and additional practice modes.
   All existing localStorage profile keys and question IDs are preserved. */
const DAY_MS=86400000;
function dayNumber(){return Math.floor(new Date(TODAY()+'T12:00:00Z').getTime()/DAY_MS)}
function reviewPriority(q){const h=p().history[q.id];if(!h)return 4;const d=dayNumber();if(!Number.isFinite(h.dueDay))return 3+(h.wrong||0)*.2;if(h.dueDay<=d)return 6+Math.min(3,d-h.dueDay)*.2+(h.wrong||0)*.1;return -.5-Math.min(20,h.dueDay-d)*.1}
function isDue(q){const h=p().history[q.id];return !!h&&(h.dueDay===undefined||h.dueDay<=dayNumber())}
function dueCount(){return questions().filter(isDue).length}
function applyReview(h,ok){const d=dayNumber();const prev=Math.max(0,Number(h.interval)||0);const ease=Math.max(1.3,Number(h.ease)||2.3);h.ease=ok?Math.min(2.8,ease+.1):Math.max(1.3,ease-.25);h.interval=ok?(prev===0?1:prev===1?3:Math.max(4,Math.round(prev*h.ease))):1;h.dueDay=d+h.interval;h.lastReviewed=TODAY()}
function chooseSpecialItems(items,key,count){const recent=new Set((p().specialRecent||{})[key]||[]);const arranged=shuffled(items).sort((a,b)=>Number(recent.has(a.id))-Number(recent.has(b.id)));const selected=arranged.slice(0,count);p().specialRecent ||= {};p().specialRecent[key]=selected.map(x=>x.id);save();return selected}
function startSpecial(mode){
 if(mode==='match'){
  const seen=new Set(p().recentPairs||[]);const picked=shuffled(PAIRS).sort((a,b)=>Number(seen.has(a[0]))-Number(seen.has(b[0]))).slice(0,4);p().recentPairs=picked.map(x=>x[0]);save();const pairs=picked.map((x,i)=>({left:x[0],right:x[1],id:x[2],key:i}));
  special={mode,pairs,rights:shuffled(pairs),selected:null,pendingRight:null,matched:[],tries:0,wrong:0,matchFeedback:null,done:false,gained:0,correct:0};
 }else if(mode==='fill'){special={mode,items:chooseSpecialItems(FILLS,'fills',5),index:0,feedback:null,gained:0,correct:0,done:false}}
 else if(mode==='order'){special={mode,items:chooseSpecialItems(ORDERS,'orders',Math.min(5,ORDERS.length)),index:0,selected:[],feedback:null,gained:0,correct:0,done:false}}
 else{special={mode,items:chooseSpecialItems([...POSES,...POSE_SCENARIOS],'poses',6),index:0,chosen:null,feedback:null,gained:0,correct:0,done:false}}
 tab='special';render();
}
function specialRecord(id,ok){
 const h=p().history[id]||{correct:0,wrong:0};h[ok?'correct':'wrong']++;applyReview(h,ok);p().history[id]=h;p().answered++;
 if(ok){p().correct++;p().xp+=10;special.gained+=10;special.correct++}
 updateStreak();save();
}
function chooseMatch(side,key){
 if(!special||special.mode!=='match'||special.done||special.matched.includes(key))return;
 if(side==='left')special.selected=special.selected===key?null:key;
 else special.pendingRight=special.pendingRight===key?null:key;
 special.matchFeedback=null;render();
}
function clearMatch(){if(!special||special.mode!=='match')return;special.selected=null;special.pendingRight=null;special.matchFeedback=null;render()}
function confirmMatch(){
 if(!special||special.mode!=='match'||special.selected===null||special.pendingRight===null)return;
 const left=special.selected,right=special.pendingRight,ok=left===right;
 special.tries++;
 if(ok){special.matched.push(left);specialRecord(special.pairs.find(x=>x.key===left).id,true);special.matchFeedback={ok:true,message:'זוג נכון'};}
 else{special.wrong++;specialRecord(special.pairs.find(x=>x.key===left).id,false);special.matchFeedback={ok:false,message:'ההתאמה לא נכונה. אפשר לנסות שוב.'};}
 special.selected=null;special.pendingRight=null;
 if(special.matched.length===special.pairs.length)special.done=true;
 render();
}
function norm(s){return String(s||'').trim().toLowerCase().replace(/[\u0591-\u05c7]/g,'').replace(/[\s־-]+/g,' ')}
function submitFill(){
 if(!special||special.feedback!==null)return;
 const val=document.getElementById('fillAnswer').value;
 if(!norm(val))return;
 const item=special.items[special.index];
 const ok=item.a.some(a=>norm(a)===norm(val));
 special.feedback={ok,why:item.why,correct:item.a[0]};
 specialRecord(item.id,ok);render();
}
function chooseOrder(i){
 if(!special||special.feedback||special.selected.includes(i))return;
 special.selected.push(i);render();
}
function undoOrder(){if(!special||special.mode!=='order'||special.feedback)return;special.selected.pop();render()}
function resetOrder(){if(!special||special.mode!=='order'||special.feedback)return;special.selected=[];render()}
function confirmOrder(){
 if(!special||special.mode!=='order'||special.feedback)return;
 const item=special.items[special.index];if(special.selected.length!==item.a.length)return;
 const ok=special.selected.every((x,j)=>x===j);
 special.feedback={ok,why:item.why,correct:item.a.join(' ← ')};
 specialRecord(item.id,ok);render();
}
function choosePose(i){if(!special||special.feedback)return;special.chosen=special.chosen===i?null:i;render()}
function confirmPose(){
 if(!special||special.feedback||special.chosen===null)return;
 const item=special.items[special.index],correct=POSE_SCENARIOS.includes(item)?item.answer:POSES.indexOf(item),ok=special.chosen===correct;
 special.feedback={ok,why:item.why,correct:POSE_SCENARIOS.includes(item)?item.options[item.answer]:item.sanskrit};
 specialRecord(item.id,ok);render();
}
function nextSpecial(){
 if(!special)return;
 if(special.index===special.items.length-1)special.done=true;
 else{special.index++;special.feedback=null;special.selected=[];special.chosen=null}
 render();
}
function poseSvg(type){
 const lines={
 dog:'<path d="M57 157 L100 64 L170 145 M100 64 L175 64 L225 155 M100 64 L85 47" /><circle cx="82" cy="41" r="10"/>',
 up:'<path d="M145 160 L145 92 M145 92 L130 40 M145 92 L160 40 M145 160 L128 180 M145 160 L162 180"/><circle cx="145" cy="77" r="12"/>',
 cobra:'<path d="M40 160 Q98 170 145 157 Q165 150 170 123 L170 85 M145 157 L190 160 M170 123 L193 152 M170 123 L153 151"/><circle cx="170" cy="68" r="13"/>',
 fold:'<path d="M120 172 L139 104 L205 111 L236 148 M139 104 L132 46 M205 111 L214 164"/><circle cx="247" cy="153" r="10"/>',
 half:'<path d="M110 173 L125 103 L198 96 M125 103 L119 46 M198 96 L220 150 M125 103 L158 166"/><circle cx="211" cy="91" r="11"/>',
 plank:'<path d="M55 151 L110 112 L206 112 L243 153 M110 112 L104 156 M206 112 L219 155"/><circle cx="253" cy="109" r="11"/>',
 updog:'<path d="M60 166 L132 155 L182 112 L190 59 M182 112 L203 164 M132 155 L122 173"/><circle cx="194" cy="43" r="13"/>'
 };
 return '<svg class="poseart" viewBox="0 0 290 200" role="img" aria-label="איור סכמטי של תנוחת יוגה"><path d="M20 183 H270" stroke="#cad8c8" stroke-width="2"/><g fill="none" stroke="#2e5947" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'+lines[type]+'</g><text x="145" y="23" text-anchor="middle" font-size="11" fill="#697b70">איור סכמטי · לא הנחיית אליינמנט</text></svg>'
}
function specialFeedback(f){
 return f?'<div class="feedback '+(f.ok?'':'wrong')+'"><b>'+(f.ok?'תשובה נכונה':'תשובה לא נכונה')+'</b><div>'+esc(f.why)+'</div>'+(f.ok?'':'<div>תשובה: '+esc(f.correct)+'</div>')+'</div><button class="btn full" onclick="nextSpecial()">'+(special.index===special.items.length-1?'סיום התרגול':'הבא')+'</button>':''
}
function specialView(){
 if(!special)return home();
 const x=special;
 if(x.done)return '<div class="card" style="text-align:center;padding:30px"><h1>סיכום התרגול</h1><p>'+x.correct+' תשובות נכונות</p><h2 class="strong">+'+x.gained+' XP</h2><p class="muted">מועדי החזרה עודכנו.</p><button class="btn full" onclick="startSpecial(\''+x.mode+'\')">לשחק שוב</button><button class="btn secondary full" style="margin-top:8px" onclick="selectTab(\'home\')">חזרה לבית</button></div>';
 const headings={match:'התאמות',fill:'השלמות',order:'סידור רצף',image:'זיהוי תנוחות'};
 let html='<div class="row"><button class="close" onclick="selectTab(\'home\')" aria-label="חזרה">×</button><span class="pill">+'+x.gained+' XP</span></div><h1>'+headings[x.mode]+'</h1>';
 if(x.mode==='match'){
  html+='<p class="muted">בחרי מושג ופירוש. אפשר לשנות בחירה לפני הבדיקה.</p><div class="matchrow"><div class="matchcol">'+x.pairs.map(z=>'<button aria-pressed="'+(x.selected===z.key)+'" class="matchbtn '+(x.selected===z.key?'active ':'')+(x.matched.includes(z.key)?'matched':'')+'" '+(x.matched.includes(z.key)?'disabled':'')+' onclick="chooseMatch(\'left\','+z.key+')">'+esc(z.left)+'</button>').join('')+'</div><div class="matchcol">'+x.rights.map(z=>'<button aria-pressed="'+(x.pendingRight===z.key)+'" class="matchbtn '+(x.pendingRight===z.key?'active ':'')+(x.matched.includes(z.key)?'matched':'')+'" '+(x.matched.includes(z.key)?'disabled':'')+' onclick="chooseMatch(\'right\','+z.key+')">'+esc(z.right)+'</button>').join('')+'</div></div>'+
  '<div class="selectionpanel" aria-live="polite">'+(x.selected===null&&x.pendingRight===null?'עדיין לא נבחר זוג':(x.selected===null?'בחרי מושג':esc(x.pairs.find(z=>z.key===x.selected).left))+' ↔ '+(x.pendingRight===null?'בחרי פירוש':esc(x.pairs.find(z=>z.key===x.pendingRight).right)))+'</div>'+
  '<div class="actionrow"><button class="btn secondary" '+(x.selected===null&&x.pendingRight===null?'disabled':'')+' onclick="clearMatch()">ביטול בחירה</button><button class="btn" '+(x.selected===null||x.pendingRight===null?'disabled':'')+' onclick="confirmMatch()">בדיקת זוג</button></div>'+
  (x.matchFeedback?'<div role="status" class="feedback '+(x.matchFeedback.ok?'':'wrong')+'">'+esc(x.matchFeedback.message)+'</div>':'')+
  '<p class="reviewmeta">הותאמו '+x.matched.length+' מתוך '+x.pairs.length+'</p>';
 }else{
  const item=x.items[x.index];
  html+='<div class="qmeta">שאלה '+(x.index+1)+' מתוך '+x.items.length+'</div><div class="card"><h2 class="question">'+esc(item.q)+'</h2>';
  if(x.mode==='fill')html+='<form onsubmit="event.preventDefault();submitFill()" class="answerfield"><input id="fillAnswer" class="field" autocomplete="off" placeholder="כתבי תשובה" '+(x.feedback?'disabled':'')+'><button class="btn" '+(x.feedback?'disabled':'')+'>בדיקה</button></form>';
  else if(x.mode==='order')html+='<p class="muted">בחרי את הפריטים לפי הסדר. אפשר לבטל לפני הבדיקה.</p>'+shuffledFixedOrder(item.a).map(z=>'<button class="sequenceitem '+(x.selected.includes(z.index)?'pending':'')+'" '+(x.selected.includes(z.index)||x.feedback?'disabled':'')+' onclick="chooseOrder('+z.index+')">'+esc(z.label)+'</button>').join('')+'<div class="sequenceChosen" aria-live="polite">'+x.selected.map((id,i)=>'<div class="step">'+(i+1)+'. '+esc(item.a[id])+'</div>').join('')+'</div><p class="reviewmeta">נבחרו '+x.selected.length+' מתוך '+item.a.length+'</p>'+(x.feedback?'':'<div class="actionrow"><button class="btn secondary" '+(x.selected.length?'':'disabled')+' onclick="undoOrder()">ביטול אחרון</button><button class="btn secondary" '+(x.selected.length?'':'disabled')+' onclick="resetOrder()">ניקוי</button><button class="btn" '+(x.selected.length===item.a.length?'':'disabled')+' onclick="confirmOrder()">בדיקת רצף</button></div>');
  else html+=poseSvg(item.type)+'<div class="stack" style="margin-top:16px">'+(POSE_SCENARIOS.includes(item)?item.options:POSES.map(z=>z.sanskrit)).map((label,i)=>'<button aria-pressed="'+(!x.feedback&&x.chosen===i)+'" class="option '+(x.feedback?(i===(POSE_SCENARIOS.includes(item)?item.answer:POSES.indexOf(item))?'correct':!x.feedback.ok&&i===x.chosen?'wrong':''):(x.chosen===i?'pending':''))+'" '+(x.feedback?'disabled':'')+' onclick="choosePose('+i+')">'+esc(label)+'</button>').join('')+'</div>'+(x.feedback?'':'<div class="actionrow"><button class="btn secondary" '+(x.chosen===null?'disabled':'')+' onclick="special.chosen=null;render()">ביטול בחירה</button><button class="btn" '+(x.chosen===null?'disabled':'')+' onclick="confirmPose()">בדיקת תשובה</button></div>');
  html+=specialFeedback(x.feedback)+'</div>';
 }
 return html;
}
function shuffledFixedOrder(a){
 // Deterministic presentation within the current question so the order does not reshuffle after taps.
 const j=special.index;
 if(!special.orderCache)special.orderCache={};
 if(!special.orderCache[j])special.orderCache[j]=shuffled(a.map((label,index)=>({label,index})));
 return special.orderCache[j];
}

render();

