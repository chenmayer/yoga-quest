// Sanskrit pose study, progress and practice modes. No dependency on external image services.
let poseTraining=null;
function posePool(scope='all'){return ASANA_LIBRARY.filter(x=>scope==='all'||x.sets.includes(scope))}
function poseModeName(mode){return ({'image-name':'תמונה → סנסקריט','name-image':'סנסקריט → תמונה','type-name':'עברית → הקלדת סנסקריט'})[mode]||mode}
function poseStats(id){
 const h=(p().poseStats||{})[id]||{};
 return h;
}
function poseMastered(id,mode){return (poseStats(id)[mode]?.correct||0)>=2}
function poseOverall(id){return ['image-name','name-image','type-name'].filter(mode=>poseMastered(id,mode)).length}
function poseReviewTotals(){return {count:ASANA_LIBRARY.length,mastered:ASANA_LIBRARY.filter(x=>poseOverall(x.id)===3).length}}
function posePracticeEntry(){
 const total=poseReviewTotals();
 return '<div class="row"><button class="btn secondary small" onclick="selectTab(\'library\')">חזרה לשיעורים</button><span class="pill">'+total.mastered+' / '+total.count+' בשליטה</span></div>'+
 '<h1 class="picker-title">שמות התנוחות בסנסקריט</h1><p class="muted">תנוחות מברכות השמש A ו־B. בחרי מסלול תרגול:</p>'+
 '<div class="card"><h2>מזהים וזוכרים</h2><div class="length-options">'+
 ['image-name','name-image','type-name'].map(mode=>'<button class="length-choice" onclick="choosePoseMode(\''+mode+'\')"><b>'+poseModeName(mode)+'</b><small>'+({ 'image-name':'לזהות שם סנסקריט לפי איור','name-image':'לבחור איור לפי השם','type-name':'לזכור ולהקליד בלי אפשרויות'})[mode]+'</small></button>').join('')+
 '</div></div>'+
 (p().activePoseTraining?'<div class="card"><div class="row"><div><b>תרגול ששמרת</b><p class="muted">אפשר לחזור למקום שהפסקת</p></div><button class="btn small" onclick="resumePosePractice()">המשך</button></div></div>':'')+
 '<h2 class="section">ספריית תנוחות</h2><p class="muted">לכל תנוחה: איור סכמטי, שם בעברית ובסנסקריט, פירוק השם והתקדמות נפרדת בכל סוג תרגול.</p>'+
 '<div class="pose-library">'+ASANA_LIBRARY.map(item=>'<details class="card pose-library-card"><summary><span><b>'+esc(item.he)+'</b><small dir="ltr">'+esc(item.sk)+'</small></span><span class="pill">'+poseOverall(item.id)+'/3</span></summary>'+
 poseSvg(item.image)+'<p>'+esc(item.breakdown)+'</p><p class="footnote">'+esc(item.source)+'</p><p class="muted">שליטה: '+['image-name','name-image','type-name'].map(m=>poseMastered(item.id,m)?'✓ '+poseModeName(m):'○ '+poseModeName(m)).join(' · ')+'</p></details>').join('')+'</div>'+
 '<p class="footnote">האיורים סכמטיים, אינם הוראת אליינמנט. שליטה מסומנת אחרי שתי תשובות נכונות בכל מצב.</p>';
}
function choosePoseMode(mode){
 poseTraining={mode,scope:null,items:[],index:0,selected:null,feedback:null,done:false,correct:0};
 tab='pose-practice';render();
}
function setPoseScope(scope){
 if(!poseTraining)return;
 const pool=shuffled(posePool(scope));
 poseTraining={mode:poseTraining.mode,scope,items:pool.map(item=>{
 const choices=shuffled([item,...shuffled(ASANA_LIBRARY.filter(z=>z.id!==item.id)).slice(0,3)]).map(z=>z.id);
 return {id:item.id,options:choices};
 }),index:0,selected:null,feedback:null,done:false,correct:0};
 persistPosePractice();render();
}
function persistPosePractice(){if(poseTraining&&!poseTraining.done&&poseTraining.scope){p().activePoseTraining=JSON.parse(JSON.stringify(poseTraining));save()}}
function resumePosePractice(){const saved=p().activePoseTraining;if(!saved||!saved.items?.length)return;poseTraining=JSON.parse(JSON.stringify(saved));tab='pose-practice';render()}
function leavePosePractice(){persistPosePractice();poseTraining=null;selectTab('library')}
function selectPoseAnswer(value){if(!poseTraining||poseTraining.feedback)return;poseTraining.selected=poseTraining.selected===value?null:value;persistPosePractice();render()}
function normalPoseName(text){
 return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[׳’']/g,'').replace(/[^a-z0-9]/g,'');
}
function poseNameMatches(item,input){
 const alternatives=[item.sk];
 if(item.id==='virabhadrasana-a')alternatives.push('Virabhadrasana I','Virabhadrasana 1');
 if(item.id==='samasthitihi')alternatives.push('Samasthiti');
 if(item.id==='urdhva-mukha-svanasana')alternatives.push('Urdhva Mukha Shvanasana');
 if(item.id==='adho-mukha-svanasana')alternatives.push('Adho Mukha Shvanasana');
 return alternatives.some(x=>normalPoseName(x)===normalPoseName(input));
}
function submitPoseAnswer(){
 const x=poseTraining;if(!x||x.done||x.feedback||!x.scope)return;
 const item=ASANA_LIBRARY.find(p=>p.id===x.items[x.index].id);
 let value=x.mode==='type-name'?document.getElementById('poseTyping')?.value.trim():x.selected;
 if(!value)return;
 const ok=x.mode==='type-name'?poseNameMatches(item,value):value===item.id;
 x.feedback={ok,correct:item.sk,given:String(value)};
 if(ok)x.correct++;
 p().poseStats ||= {};
 const h=p().poseStats[item.id]||{};
 const stat=h[x.mode]||{correct:0,wrong:0};
 stat[ok?'correct':'wrong']++;
 h[x.mode]=stat;p().poseStats[item.id]=h;
 save();persistPosePractice();render();
}
function nextPoseTraining(){
 if(!poseTraining?.feedback)return;
 if(poseTraining.index>=poseTraining.items.length-1){poseTraining.done=true;p().activePoseTraining=null;save()}
 else{poseTraining.index++;poseTraining.selected=null;poseTraining.feedback=null;persistPosePractice()}
 render();
}
function posePracticeView(){
 const x=poseTraining;
 if(!x)return posePracticeEntry();
 if(!x.scope)return '<button class="btn secondary small" onclick="poseTraining=null;render()">חזרה</button><h1 class="picker-title">'+poseModeName(x.mode)+'</h1><p class="muted">מה תרצי לתרגל?</p><div class="length-options">'+[
 ['all','כל התנוחות'],['A','ברכת השמש A'],['B','ברכת השמש B']
 ].map(([scope,label])=>'<button class="length-choice" onclick="setPoseScope(\''+scope+'\')"><b>'+label+'</b><small>'+posePool(scope).length+' תנוחות</small></button>').join('')+'</div>';
 if(x.done)return '<div class="card"><h1>סיימת את התרגול</h1><p>ענית נכון על '+x.correct+' מתוך '+x.items.length+'.</p><button class="btn full" onclick="choosePoseMode(\''+x.mode+'\')">תרגול נוסף</button><button class="btn secondary full" onclick="poseTraining=null;render()">חזרה לספרייה</button></div>';
 const item=ASANA_LIBRARY.find(i=>i.id===x.items[x.index].id);
 const count=x.items.length;
 const options=x.items[x.index].options.map(id=>ASANA_LIBRARY.find(p=>p.id===id));
 const typed=x.mode==='type-name',imagePrompt=x.mode==='image-name';
 let html='<div class="row"><button class="btn secondary small" onclick="leavePosePractice()">שמירה ויציאה</button><span class="pill">'+(x.index+1)+' / '+count+'</span></div>'+
 '<h1 class="picker-title">'+poseModeName(x.mode)+'</h1><div class="meter" style="margin:14px 0"><div style="width:'+Math.round(x.index/count*100)+'%"></div></div>'+
 '<div class="card pose-question"><p class="muted">'+(imagePrompt?'מה שם התנוחה באיור?':typed?'איך קוראים לתנוחה בסנסקריט?':'איזה איור מתאים לשם?')+'</p>'+
 (imagePrompt?poseSvg(item.image):'<h2 '+(!typed?'dir="ltr"':'')+'>'+esc(typed?item.he:item.sk)+'</h2>')+'</div>';
 if(typed){
 html+='<label for="poseTyping">הקלידי בסנסקריט, באותיות לטיניות</label><input class="field pose-typing" id="poseTyping" dir="ltr" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Sanskrit name" '+(x.feedback?'disabled':'')+' onkeydown="if(event.key===\'Enter\')submitPoseAnswer()">';
 }else html+='<div class="'+(imagePrompt?'pose-answer-text':'pose-answer-images')+'">'+options.map(z=>'<button class="pose-choice '+(x.selected===z.id?'chosen':'')+'" aria-pressed="'+(x.selected===z.id)+'" '+(x.feedback?'disabled':'')+' onclick="selectPoseAnswer(\''+z.id+'\')">'+(imagePrompt?'<span dir="ltr">'+esc(z.sk)+'</span>':poseSvg(z.image))+'</button>').join('')+'</div>';
 if(!x.feedback)html+='<button class="btn full" style="margin-top:14px" '+(!typed&&!x.selected?'disabled':'')+' onclick="submitPoseAnswer()">בדיקה</button>';
 else html+='<div class="feedback '+(x.feedback.ok?'':'wrong')+'"><b>'+(x.feedback.ok?'נכון':'עוד לא')+'</b><p>התשובה: <span dir="ltr">'+esc(item.sk)+'</span></p><p class="muted">'+esc(item.breakdown)+'</p></div><button class="btn full" onclick="nextPoseTraining()">'+(x.index===count-1?'סיום':'הבא')+'</button>';
 return html;
}
