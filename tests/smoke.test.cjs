const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const sources=['data/questions.js','data/study.js','data/curriculum.js','data/games.js','data/asanas.js','assets/app.js','assets/pose-practice.js'];
const script=sources.map(path=>fs.readFileSync(path,'utf8')).join('\n;\n');
for(const path of sources)assert.ok(html.includes('src="'+path+'"')||html.includes('src="'+path+'?'),path+' is included in the HTML');
assert.ok(html.includes('assets/styles.css'),'Style sheet is linked');
assert.ok(script.includes('function render()'),'Application script exists');
function setup(saved){
  const store=new Map(saved?Object.entries(saved):[]);
  const nodes={app:{innerHTML:''},fillAnswer:{value:'מטה'}};
  const context=vm.createContext({
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
    document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:'',value:''})},
    alert:()=>{},console,Date,Math,JSON,Intl,
  });
  vm.runInContext(script,context);
  return {run:code=>vm.runInContext(code,context),store,nodes};
}
test('original questions and profiles remain available',()=>{
  const original={active:'אני',profiles:{'אני':{xp:80,streak:2,lastDay:null,answered:10,correct:8,history:{c01:{correct:2,wrong:1}},days:{}}},extra:[]};
  const app=setup({'yoga-quest-v1':JSON.stringify(original)});
  assert.equal(app.run('p().xp'),80);
  assert.equal(app.run('questions().length'),250);
  assert.equal(app.run('p().history.c01.correct'),2);
});
test('all modes render, and poses include adjustment scenarios',()=>{
  const app=setup();
  for(const mode of ['match','fill','order','image']){
    app.run("startSpecial('"+mode+"')");
    assert.equal(app.run('special.mode'),mode);
    assert.ok(app.nodes.app.innerHTML.length>0);
  }
  assert.equal(app.run('POSE_SCENARIOS.length'),9);
});
test('correct answers schedule future review, errors reschedule soon',()=>{
  const app=setup();
  app.run("begin('סנסקריט')");
  app.run("session.items=[questions().find(q=>q.id==='c01')];session.index=0;session.chosen=null");
  app.run('answer(0)');
  assert.equal(app.run('p().xp'),10);
  assert.equal(app.run('p().history.c01.interval'),1);
  assert.equal(app.run('p().history.c01.dueDay-dayNumber()'),1);
  app.run("session.chosen=null;answer(1)");
  assert.equal(app.run('p().history.c01.wrong'),1);
  assert.equal(app.run('p().answered'),2);
});
test('fill-in, ordering and image modes record answers',()=>{
  const app=setup();
  app.run("startSpecial('fill');special.items=[FILLS.find(f=>f.q.includes('Adho'))];special.index=0");
  app.nodes.fillAnswer.value='למטה';
  app.run('submitFill()');
  assert.equal(app.run('special.feedback.ok'),true);
  app.run("startSpecial('order');special.items=[ORDERS.find(o=>o.id==='c18'&&o.a.length===3)];special.index=0");
  app.run('chooseOrder(0);chooseOrder(1);chooseOrder(2);confirmOrder()');
  assert.equal(app.run('special.feedback.ok'),true);
  app.run("startSpecial('image');special.items=[POSE_SCENARIOS[0]];special.index=0");
  app.run('choosePose(0);confirmPose()');
  assert.equal(app.run('special.feedback.ok'),true);
});

test('matching selections are reversible until explicitly checked',()=>{
 const app=setup();
 app.run("startSpecial('match');special.pairs=[{key:0,left:'Adho',right:'מטה',id:'c01'}];special.rights=special.pairs");
 app.run("chooseMatch('left',0);chooseMatch('right',0)");
 assert.equal(app.run('p().answered'),0);
 assert.equal(app.run('special.selected'),0);
 assert.equal(app.run('special.pendingRight'),0);
 app.run('clearMatch()');
 assert.equal(app.run('special.selected'),null);
 assert.equal(app.run('special.pendingRight'),null);
 app.run("chooseMatch('left',0);chooseMatch('right',0);confirmMatch()");
 assert.equal(app.run('p().answered'),1);
 assert.equal(app.run('special.done'),true);
});
test('ordering can undo and reset without grading',()=>{
 const app=setup();
 app.run("startSpecial('order');special.items=[ORDERS.find(o=>o.id==='c18'&&o.a.length===3)];special.index=0");
 app.run("chooseOrder(0);chooseOrder(1);undoOrder()");
 assert.equal(app.run('special.selected.length'),1);
 assert.equal(app.run('p().answered'),0);
 app.run('resetOrder()');
 assert.equal(app.run('special.selected.length'),0);
 app.run('chooseOrder(0);chooseOrder(1);chooseOrder(2);confirmOrder()');
 assert.equal(app.run('special.feedback.ok'),true);
 assert.equal(app.run('p().answered'),1);
});
test('standard quiz and pose choices are not graded before confirmation',()=>{
 const app=setup();
 app.run("begin('סנסקריט');session.items=[questions().find(q=>q.id==='c01')]");
 app.run('chooseQuiz(0)');
 assert.equal(app.run('p().answered'),0);
 app.run('chooseQuiz(0)');
 assert.equal(app.run('session.pending'),null);
 app.run('chooseQuiz(0);confirmQuiz()');
 assert.equal(app.run('p().answered'),1);
 app.run("startSpecial('image');special.items=[POSE_SCENARIOS[0]]");
 app.run('choosePose(0)');
 assert.equal(app.run('p().answered'),1);
 app.run('choosePose(0)');
 assert.equal(app.run('special.chosen'),null);
 app.run('choosePose(0);confirmPose()');
 assert.equal(app.run('p().answered'),2);
});

test('homework completion is profile-specific and preserved',()=>{
 const app=setup();
 app.run("selectTab('homework')");
 assert.ok(app.nodes.app.innerHTML.includes('שיעורי בית'));
 app.run("toggleHomework('hw-ashtanga1')");
 assert.equal(app.run("p().homework['hw-ashtanga1']"),true);
 app.run("data.profiles['משתמש שני']=fresh();switchProfile('משתמש שני')");
 assert.equal(app.run("!!p().homework['hw-ashtanga1']"),false);
 app.run("switchProfile('אני')");
 assert.equal(app.run("p().homework['hw-ashtanga1']"),true);
});
test('mixed quiz balances topics and shuffles answer positions',()=>{
 const app=setup();
 app.run("begin('all')");
 assert.equal(app.run('session.items.length'),10);
 assert.equal(app.run('new Set(session.items.map(q=>q.topic)).size'),4);
 assert.equal(app.run('p().recentQuestions.length'),10);
 const seen=app.run('session.items.every(q=>q.options[q.answer]===questions().find(x=>x.id===q.id).options[questions().find(x=>x.id===q.id).answer])');
 assert.equal(seen,true);
});

test('Friday 13 November questions are present and cover the four padas',()=>{
 const app=setup();
 assert.equal(app.run("questions().filter(q=>q.lesson==='13.11.2026').length"),38);
 for(const term of ['סמאדהי','סדהנה','ויבהוטי','קאיווליה']){
  assert.ok(app.run("questions().some(q=>q.id.startsWith('f13') && (q.q.includes("+JSON.stringify(term)+") || q.options.some(o=>o.includes("+JSON.stringify(term)+"))))"));
 }
});

test('Friday lesson can be practiced independently',()=>{
 const app=setup();
 app.run("begin('lesson:13.11.2026')");
 assert.equal(app.run("session.items.length"),10);
 assert.equal(app.run("session.items.every(q=>q.lesson==='13.11.2026')"),true);
});

test('Tuesday lesson can be practiced independently with preserved original and new questions',()=>{
 const app=setup();
 assert.equal(app.run("questions().filter(q=>q.lesson==='10.11.2026').length"),130);
 app.run("begin('lesson:10.11.2026')");
 assert.equal(app.run('session.items.length'),10);
 assert.equal(app.run("session.items.every(q=>q.lesson==='10.11.2026')"),true);
 assert.ok(app.nodes.app.innerHTML.includes('שאלה'));
 app.run("selectTab('home');openPractice('lesson')");
 assert.ok(app.nodes.app.innerHTML.includes('יום שלישי · 10.11'));
 assert.ok(app.nodes.app.innerHTML.includes('יום שישי · 13.11'));
});

test('expanded course materials and mini-games have broader coverage',()=>{
 const app=setup();
 assert.equal(app.run('PAIRS.length'),41);
 assert.equal(app.run('FILLS.length'),34);
 assert.equal(app.run('ORDERS.length'),11);
 assert.equal(app.run('POSES.length'),7);
 assert.equal(app.run('POSE_SCENARIOS.length'),9);
 assert.equal(app.run("questions().filter(q=>q.id.startsWith('exp')).length"),36);
});
test('matching avoids repeating the exact previous four terms',()=>{
 const app=setup();
 app.run("startSpecial('match')");
 const a=app.run('special.pairs.map(z=>z.left).join(",")');
 app.run("startSpecial('match')");
 const b=app.run('special.pairs.map(z=>z.left).join(",")');
 assert.notEqual(a,b);
});
test('expanded poses support correct recognition and safeguards',()=>{
 const app=setup();
 app.run("startSpecial('image');special.items=[POSES[6]];special.index=0");
 app.run("choosePose(6);confirmPose()");
 assert.equal(app.run('special.feedback.ok'),true);
 assert.equal(app.run('p().answered'),1);
});
test('multi-round quizzes avoid the previous session questions when possible',()=>{
 const app=setup();
 app.run("begin('all')");
 const ids=app.run("session.items.map(q=>q.id)");
 app.run("begin('all')");
 const ids2=app.run("session.items.map(q=>q.id)");
 assert.ok(ids2.every(id=>!ids.includes(id)));
});

test('coverage map shows both lessons and identifies explicit gaps without conflating mastery',()=>{
 const app=setup();
 const counts=app.run('coverageTotals()');
 assert.ok(counts.total>=45);
 assert.ok(counts.covered>0);
 assert.ok(counts.missing>0);
 assert.equal(counts.covered+counts.missing,counts.total);
 app.run("selectTab('home')");
 assert.ok(!app.nodes.app.innerHTML.includes('מפת כיסוי חומר'));
 app.run("selectTab('progress')");
 assert.ok(!app.nodes.app.innerHTML.includes('מפת כיסוי חומר'));
 assert.equal(app.run('coverageTotals().total'),78);
});
test('each mapped item only counts existing question IDs',()=>{
 const app=setup();
 assert.equal(app.run('COVERAGE_UNITS.every(u=>u.facets.every(f=>f.ids.every(id=>questions().some(q=>q.id===id))))'),true);
});

test('new source-backed questions fill 11 of 12 previously unmapped facets',()=>{
 const app=setup();
 const t=app.run('coverageTotals()');
 assert.equal(t.total,78);
 assert.equal(t.missing,1);
 assert.equal(t.covered,77);
 assert.equal(app.run("questions().filter(q=>q.id.startsWith('gap')).length"),13);
 assert.equal(app.run("questions().filter(q=>q.id.startsWith('gap')).every(q=>q.options.length===4 && q.coverageId)"),true);
 assert.equal(app.run("COVERAGE_UNITS.filter(u=>u.lesson==='13.11.2026').flatMap(u=>u.facets).filter(f=>coverageFacetIds(f).length===0).map(f=>f.id).join(',')"),'unit-8-2');
});

test('unseen mode only offers questions that have never appeared and marks on display, not selection',()=>{
 const app=setup();
 const bank=app.run('questions().length');
 assert.equal(app.run('unseenQuestions().length'),bank);
 app.run("begin('unseen')");
 assert.equal(app.run('session.items.length'),10);
 assert.equal(app.run('unseenQuestions().length'),bank-1);
 const current=app.run('session.items[0].id');
 assert.equal(app.run('hasSeenQuestion(session.items[0])'),true);
 const second=app.run('session.items[1].id');
 assert.equal(app.run('hasSeenQuestion(session.items[1])'),false);
 app.run("selectTab('home');begin('unseen')");
 assert.equal(app.run('session.items.some(q=>q.id==='+JSON.stringify(current)+')'),false);
 // The unshown item may still be selected: only the displayed one is excluded.
 assert.equal(app.run('p().seenQuiz['+JSON.stringify(second)+']===true'),false);
});
test('all questions in a topic can be practiced, with short mode unchanged',()=>{
 const app=setup();
 const topic='פילוסופיה';
 const count=app.run("questions().filter(q=>q.topic==='פילוסופיה').length");
 assert.ok(count>10);
 app.run("begin('פילוסופיה',true)");
 assert.equal(app.run('session.items.length'),count);
 assert.equal(app.run('session.full'),true);
 assert.equal(app.run("session.items.every(q=>q.topic==='פילוסופיה')"),true);
 app.run("begin('פילוסופיה')");
 assert.equal(app.run('session.items.length'),10);
});
test('mixed full mode includes every quiz question once, with fresh order',()=>{
 const app=setup();
 const count=app.run('questions().length');
 app.run("begin('mixed',true)");
 assert.equal(app.run('session.items.length'),count);
 assert.equal(app.run('new Set(session.items.map(q=>q.id)).size'),count);
 app.run("begin('mixed')");
 assert.equal(app.run('session.items.length'),10);
});
test('coverage map remains available for internal verification but hidden in navigation',()=>{
 const app=setup();
 assert.equal(app.run('coverageTotals().total'),78);
 app.run("selectTab('coverage')");
 assert.equal(app.run('tab'),'progress');
 assert.ok(!app.nodes.app.innerHTML.includes('מפת כיסוי חומר'));
});

test('later mini-game attempts do not consume unshown trivia after migration',()=>{
 const app=setup();
 const target=app.run("questions().find(q=>q.id==='c01')");
 app.run('unseenQuestions()');
 const before=app.run('unseenQuestions().length');
 app.run("startSpecial('match');specialRecord('c01',true)");
 assert.equal(app.run('unseenQuestions().length'),before);
 assert.equal(app.run("hasSeenQuestion(questions().find(q=>q.id==='c01'))"),false);
});
test('legacy answered questions are treated as already seen once',()=>{
 const legacy={active:'אני',profiles:{'אני':{xp:10,streak:0,lastDay:null,answered:1,correct:1,history:{c01:{correct:1,wrong:0}},days:{}}},extra:[]};
 const app=setup({'yoga-quest-v1':JSON.stringify(legacy)});
 assert.equal(app.run('unseenQuestions().length'),app.run('questions().length')-1);
 assert.equal(app.run("p().seenQuiz.c01"),true);
});

test('home displays four primary practice paths and hides extra games by default',()=>{
 const app=setup();
 app.run("selectTab('home')");
 const html=app.nodes.app.innerHTML;
 assert.ok(html.includes('שאלות חדשות'));
 assert.ok(html.includes('תרגול מעורב'));
 assert.ok(html.includes('לפי נושא'));
 assert.ok(html.includes('לפי שיעור'));
 assert.ok(html.includes('<details class="card extra-games">'));
 assert.ok(!html.includes('כל השאלות במעורבב'));
 assert.ok(!html.includes('לתרגל לפי נושא'));
 assert.ok(!html.includes('מפת כיסוי חומר'));
});
test('topic picker defers session until topic and length are selected',()=>{
 const app=setup();
 app.run("openPractice('topic')");
 assert.equal(app.run('tab'),'practice-pick');
 assert.equal(app.run('session'),null);
 assert.ok(app.nodes.app.innerHTML.includes('סנסקריט'));
 app.run("pickPracticeTopic('פילוסופיה')");
 assert.ok(app.nodes.app.innerHTML.includes('20 שאלות'));
 app.run("begin('פילוסופיה',20)");
 assert.equal(app.run('session.items.length'),20);
 assert.ok(app.run("session.items.every(q=>q.topic==='פילוסופיה')"));
});
test('lesson and mixed pickers offer full-length practice without home duplication',()=>{
 const app=setup();
 app.run("openPractice('lesson');pickPracticeTopic('lesson:10.11.2026')");
 assert.ok(app.nodes.app.innerHTML.includes('כל השאלות'));
 app.run("begin('lesson:10.11.2026',true)");
 assert.equal(app.run('session.items.length'),130);
 app.run("openPractice('mixed')");
 assert.ok(app.nodes.app.innerHTML.includes('20 שאלות'));
 app.run("begin('mixed',20)");
 assert.equal(app.run('session.items.length'),20);
 app.run("begin('mixed',true)");
 assert.equal(app.run('session.items.length'),250);
});
test('game access and saved progress survive home redesign',()=>{
 const app=setup();
 app.run("toggleHomework('hw-count')");
 app.run("startSpecial('match')");
 assert.equal(app.run('special.mode'),'match');
 app.run("selectTab('home')");
 assert.equal(app.run("p().homework['hw-count']"),true);
 assert.ok(app.nodes.app.innerHTML.includes('משחקים נוספים'));
});

test('every verified Sanskrit notebook expression has a dedicated question',()=>{
 const app=setup();
 const expected=["Ashtanga","Tristhana","Bandha","Ujjayi","Drishti","Ahimsa","Vinyasa","Surya Namaskara A","Samasthitihi","Ekam","Dve","Trini","Chatvari","Pancha","Shat","Sapta","Ashtau","Nava","Urdhva Hastasana","Uttanasana","Ardha Uttanasana","Chaturanga Dandasana","Urdhva Mukha Svanasana","Adho Mukha Svanasana","Bhujangasana","Adho","Urdhva","Ardha","Mukha","Svana","Asana","Bhujanga","Yoga","Sthira","Sukha","Sthira Sukham","Sadhana","Sutra","Pada","Samadhi Pada","Sadhana Pada","Vibhuti Pada","Kaivalya Pada","Purusha","Prakriti","Vritti"];
 const found=app.run("questions().filter(q=>q.id.startsWith('sk')&&q.topic==='סנסקריט')");
 assert.equal(found.length,46);
 const names=found.map(q=>q.sanskrit);
 assert.equal(new Set(names).size,expected.length);
 assert.equal(names.sort().join('|'),expected.sort().join('|'));
 assert.ok(found.every(q=>q.options.length===4&&q.answer>=0&&q.answer<4&&q.why&&q.lesson));
});
test('Sanskrit practice can cover every expression in one run',()=>{
 const app=setup();
 const count=app.run("questions().filter(q=>q.topic==='סנסקריט').length");
 assert.ok(count>=46);
 app.run("begin('סנסקריט',true)");
 assert.equal(app.run('session.items.length'),count);
 assert.equal(app.run("session.items.every(q=>q.topic==='סנסקריט')"),true);
 const ids=app.run("session.items.filter(q=>q.id.startsWith('sk')).map(q=>q.id)");
 assert.equal(ids.length,46);
});

test('saved quiz resumes after reload with exact question and selected answer',()=>{
 const app=setup();
 app.run("begin('סנסקריט',20)");
 const id=app.run('session.items[0].id');
 app.run('chooseQuiz(2)');
 assert.equal(app.run('session.pending'),2);
 app.run('pauseQuiz()');
 assert.equal(app.run('tab'),'home');
 assert.ok(app.nodes.app.innerHTML.includes('להמשיך מהנקודה שבה עצרת'));
 const restarted=setup(Object.fromEntries(app.store));
 restarted.run('resumeQuiz()');
 assert.equal(restarted.run('tab'),'quiz');
 assert.equal(restarted.run('session.items[0].id'),id);
 assert.equal(restarted.run('session.pending'),2);
 restarted.run('confirmQuiz()');
 assert.equal(restarted.run('p().answered'),1);
 const saved=setup(Object.fromEntries(restarted.store));
 saved.run('resumeQuiz()');
 assert.equal(saved.run('session.chosen'),2);
 assert.equal(saved.run('p().answered'),1); // no duplicate award on restore
});
test('completed quiz clears resumable state but keeps XP',()=>{
 const app=setup();
 app.run("begin('סנסקריט')");
 app.run("session.items=session.items.slice(0,1)");
 app.run("answer(session.items[0].answer);next()");
 assert.equal(app.run('p().activeQuiz'),null);
 assert.equal(app.run('session.done'),true);
 assert.equal(app.run('p().xp'),10);
});
test('Sanskrit cards support both directions and saved progress',()=>{
 const app=setup();
 assert.equal(app.run('SANSKRIT_CARDS.length'),63);
 app.run("startCards('sanskrit')");
 assert.equal(app.run('tab'),'cards');
 assert.ok(app.nodes.app.innerHTML.includes('סנסקריט → עברית'));
 app.run('flipCard();gradeCard(true)');
 assert.equal(app.run('cardSession.index'),1);
 assert.equal(app.run('cardSession.known'),1);
 app.run('pauseCards()');
 const saved=setup(Object.fromEntries(app.store));
 saved.run('resumeCards()');
 assert.equal(saved.run('cardSession.index'),1);
 assert.equal(saved.run('cardSession.known'),1);
 saved.run('pauseCards()');
 saved.run("startCards('hebrew')");
 assert.ok(saved.nodes.app.innerHTML.includes('עברית → סנסקריט'));
 saved.run('flipCard();gradeCard(false)');
 assert.equal(saved.run('cardSession.again'),1);
});
test('lesson library displays sourced notes and practice links',()=>{
 const app=setup();
 app.run("selectTab('library')");
 const view=app.nodes.app.innerHTML;
 assert.ok(view.includes('ספריית שיעורים'));
 assert.ok(view.includes('10.11.2026'));
 assert.ok(view.includes('13.11.2026'));
 assert.ok(view.includes('טריסטאנה'));
 assert.ok(view.includes('ארבע הפאדות'));
 assert.ok(view.includes('מאגר השאלות וייבוא חומר'));
 assert.ok(view.includes('כל השאלות'));
});

test('homework checklist matches instructor screenshot without unrelated legacy tasks',()=>{
 const app=setup();
 assert.equal(app.run('HOMEWORK.length'),7);
 assert.equal(app.run("HOMEWORK.filter(t=>t.group==='לחזרה ולתרגול בבית').length"),3);
 assert.equal(app.run("HOMEWORK.filter(t=>t.group.includes('אל עצמי')).length"),4);
 assert.equal(app.run("HOMEWORK.some(t=>t.id==='hw-bring'||t.id==='hw-arrive'||t.id==='hw-email'||t.id==='hw-peers'||t.id==='hw-contact')"),false);
 app.run("selectTab('homework')");
 const view=app.nodes.app.innerHTML;
 for(const phrase of ['בקול או בשירה','איפה אפשר לרכך מאמץ','דרישטי','בנדהות','נשימת אוג׳אי','פתח דבר','מהי יוגה?','אטמן','ברהמן','ההיסטוריה והבסיס הפילוסופי']){
   assert.ok(view.includes(phrase),phrase);
 }
 app.run("toggleHomework('hw-count')");
 assert.equal(app.run("p().homework['hw-count']"),true);
});

test('17 November sourced lesson is in library, picker and question bank',()=>{
 const app=setup();
 assert.equal(app.run("LESSON_NOTES.find(l=>l.date==='17.11.2026').sections.length"),5);
 assert.equal(app.run("questions().filter(q=>q.lesson==='17.11.2026').length"),43);
 app.run("openPractice('lesson')");
 assert.ok(app.nodes.app.innerHTML.includes('17.11'));
 app.run("selectTab('library')");
 const v=app.nodes.app.innerHTML;
 for(const word of ['17.11.2026','ברכת השמש B','APT','PPT','תמיכות במגע','השלמה לימודית'])assert.ok(v.includes(word),word);
 app.run("begin('lesson:17.11.2026',true)");
 assert.equal(app.run('session.items.length'),43);
 assert.ok(app.run("session.items.every(q=>q.lesson==='17.11.2026')"));
});
test('lesson 17 quiz and games clearly distinguish course note from educational completions',()=>{
 const app=setup();
 const qs=app.run("questions().filter(q=>q.lesson==='17.11.2026')");
 assert.equal(new Set(qs.map(q=>q.id)).size,43);
 assert.ok(qs.every(q=>q.options.length===4&&q.answer>=0&&q.answer<4));
 assert.ok(qs.some(q=>q.why.includes('השלמה לימודית')));
 assert.ok(app.run("ORDERS.some(o=>o.q.includes('ברכת השמש B'))"));
 assert.ok(app.run("FILLS.some(f=>f.q.includes('Shodasha'))"));
 assert.equal(app.run("SANSKRIT_CARDS.filter(c=>/^sk0(4[7-9]|5[0-7])$/.test(c.id)).length"),11);
 const ids=app.run("COVERAGE_UNITS.filter(u=>u.lesson==='17.11.2026').flatMap(u=>u.facets).flatMap(f=>f.ids)");
 assert.ok(ids.every(id=>qs.some(q=>q.id===id)));
});

test('lessons appear newest first in library and lesson picker',()=>{
 const app=setup();
 assert.equal(app.run("recentLessons().map(l=>l.date).join(',')"),"20.11.2026,17.11.2026,13.11.2026,10.11.2026");
 app.run("selectTab('library')");
 const html=app.nodes.app.innerHTML;
 assert.ok(html.indexOf('17.11.2026')<html.indexOf('13.11.2026'));
 assert.ok(html.indexOf('13.11.2026')<html.indexOf('10.11.2026'));
 app.run("openPractice('lesson')");
 const picker=app.nodes.app.innerHTML;
 assert.ok(picker.indexOf('17.11')<picker.indexOf('13.11'));
 assert.ok(picker.indexOf('13.11')<picker.indexOf('10.11'));
});

test('Friday 20 November is newest and sourced notes are in lesson library',()=>{
 const app=setup();
 assert.equal(app.run("recentLessons()[0].date"),'20.11.2026');
 const lesson=app.run("LESSON_NOTES.find(x=>x.date==='20.11.2026')");
 assert.equal(lesson.sections.length,4);
 assert.ok(lesson.sections.some(s=>s.title.includes('ויראגיה')));
 app.run("selectTab('library')");
 const html=app.nodes.app.innerHTML;
 for(const term of ['20.11.2026','ראג׳ס','טמאס','סטווה','סו־הם','אבהיאסה','ויראגיה'])assert.ok(html.includes(term),term);
 assert.ok(html.indexOf('20.11.2026')<html.indexOf('17.11.2026'));
 app.run("openPractice('lesson')");
 assert.ok(app.nodes.app.innerHTML.indexOf('20.11')<app.nodes.app.innerHTML.indexOf('17.11'));
});
test('Friday 20 November quiz and Sanskrit deck are complete and unique',()=>{
 const app=setup();
 const qs=app.run("questions().filter(q=>q.lesson==='20.11.2026')");
 assert.equal(qs.length,29);
 assert.equal(new Set(qs.map(q=>q.id)).size,29);
 assert.ok(qs.every(q=>q.answer>=0&&q.answer<4&&q.options.length===4));
 app.run("begin('lesson:20.11.2026',true)");
 assert.equal(app.run('session.items.length'),29);
 assert.ok(app.run("session.items.every(q=>q.lesson==='20.11.2026')"));
 assert.equal(app.run("SANSKRIT_CARDS.filter(c=>/^sk0(5[8-9]|6[0-3])$/.test(c.id)).length"),6);
 assert.ok(app.run("PAIRS.some(x=>x[0]==='Vairāgya')"));
 assert.ok(app.run("FILLS.some(x=>x.q.includes('So’ham'))"));
});
test('Friday lesson coverage map remains internal and maps to actual questions',()=>{
 const app=setup();
 const f=app.run("COVERAGE_UNITS.filter(u=>u.lesson==='20.11.2026').flatMap(u=>u.facets)");
 assert.equal(f.length,12);
 assert.ok(f.every(x=>x.ids.length>0));
 const ids=f.flatMap(x=>x.ids);
 const all=app.run("questions().filter(q=>q.lesson==='20.11.2026').map(q=>q.id)");
 assert.ok(ids.every(id=>all.includes(id)));
 app.run("selectTab('home')");
 assert.ok(!app.nodes.app.innerHTML.includes('מפת כיסוי חומר'));
});

test('Sanskrit pose library contains all studied Sun Salutation names',()=>{
 const app=setup();
 assert.equal(app.run('ASANA_LIBRARY.length'),10);
 assert.equal(app.run('new Set(ASANA_LIBRARY.map(x=>x.id)).size'),10);
 assert.equal(app.run("posePool('A').length"),8);
 assert.equal(app.run("posePool('B').length"),9);
 assert.ok(app.run("ASANA_LIBRARY.every(x=>x.sk&&x.he&&x.image&&x.sets.length>0)"));
 app.run("selectTab('library')");
 assert.ok(app.nodes.app.innerHTML.includes('ספריית תנוחות וסנסקריט'));
 app.run("selectTab('pose-practice')");
 assert.ok(app.nodes.app.innerHTML.includes('תנוחת הכיסא'));
 assert.ok(app.nodes.app.innerHTML.includes('Virabhadrasana A'));
});
test('image to Sanskrit pose quiz is reversible until checking, tracks mastery separately',()=>{
 const app=setup();
 app.run("choosePoseMode('image-name');setPoseScope('A')");
 assert.equal(app.run('poseTraining.items.length'),8);
 assert.equal(app.run('p().poseStats'),undefined);
 const id=app.run('poseTraining.items[0].id');
 app.run('selectPoseAnswer(poseTraining.items[0].options[1])');
 assert.equal(app.run('p().poseStats'),undefined);
 app.run('selectPoseAnswer(poseTraining.items[0].options[1])');
 assert.equal(app.run('poseTraining.selected'),null);
 app.run('selectPoseAnswer(poseTraining.items[0].id)');
 app.run('submitPoseAnswer()');
 assert.equal(app.run('poseTraining.feedback.ok'),true);
 assert.equal(app.run('p().poseStats[poseTraining.items[0].id]["image-name"].correct'),1);
 assert.equal(app.run('poseOverall(poseTraining.items[0].id)'),0);
 app.run('nextPoseTraining()');
 assert.equal(app.run('poseTraining.index'),1);
 assert.ok(app.nodes.app.innerHTML.includes('תמונה'));
});
test('Sanskrit name to diagram and typed recall are independent',()=>{
 const app=setup();
 app.run("choosePoseMode('name-image');setPoseScope('B')");
 assert.equal(app.run('poseTraining.items.length'),9);
 assert.ok(app.nodes.app.innerHTML.includes('poseart'));
 app.run('selectPoseAnswer(poseTraining.items[0].id);submitPoseAnswer()');
 assert.equal(app.run('poseTraining.feedback.ok'),true);
 app.run("choosePoseMode('type-name');setPoseScope('all')");
 assert.ok(app.nodes.app.innerHTML.includes('הקלידי בסנסקריט'));
 const id=app.run('poseTraining.items[0].id');
 const correct=app.run('ASANA_LIBRARY.find(x=>x.id===poseTraining.items[0].id).sk');
 app.nodes.poseTyping={value:correct};
 app.run('submitPoseAnswer()');
 assert.equal(app.run('poseTraining.feedback.ok'),true);
 assert.equal(app.run('p().poseStats[id]["type-name"].correct'),1);
 assert.ok(app.run("poseNameMatches(ASANA_LIBRARY.find(x=>x.id==='virabhadrasana-a'),'Virabhadrasana I')"));
});
test('pose progress and unfinished training survive reload',()=>{
 const app=setup();
 app.run("choosePoseMode('image-name');setPoseScope('all')");
 const first=app.run('poseTraining.items[0].id');
 app.run('selectPoseAnswer(poseTraining.items[0].id);submitPoseAnswer();nextPoseTraining()');
 app.run('leavePosePractice()');
 const restored=setup(Object.fromEntries(app.store));
 restored.run('resumePosePractice()');
 assert.equal(restored.run('poseTraining.index'),1);
 assert.equal(restored.run('poseTraining.items[0].id'),first);
 assert.equal(restored.run('p().poseStats['+JSON.stringify(first)+']["image-name"].correct'),1);
});
