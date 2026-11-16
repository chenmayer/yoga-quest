const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Application script exists');
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
  assert.equal(app.run('questions().length'),83);
  assert.equal(app.run('p().history.c01.correct'),2);
});
test('all modes render, and poses include adjustment scenarios',()=>{
  const app=setup();
  for(const mode of ['match','fill','order','image']){
    app.run("startSpecial('"+mode+"')");
    assert.equal(app.run('special.mode'),mode);
    assert.ok(app.nodes.app.innerHTML.length>0);
  }
  assert.equal(app.run('POSE_SCENARIOS.length'),3);
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
  app.run("startSpecial('fill');special.items=[FILLS[0]];special.index=0");
  app.nodes.fillAnswer.value='למטה';
  app.run('submitFill()');
  assert.equal(app.run('special.feedback.ok'),true);
  app.run("startSpecial('order');special.items=[ORDERS[0]];special.index=0");
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
 app.run("startSpecial('order');special.items=[ORDERS[0]];special.index=0");
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
 assert.equal(app.run("questions().filter(q=>q.lesson==='13.11.2026').length"),17);
 for(const term of ['סמאדהי','סדהנה','ויבהוטי','קאיווליה']){
  assert.ok(app.run("questions().some(q=>q.id.startsWith('f13') && (q.q.includes("+JSON.stringify(term)+") || q.options.some(o=>o.includes("+JSON.stringify(term)+"))))"));
 }
});

test('Friday lesson can be practiced independently',()=>{
 const app=setup();
 app.run("begin('friday')");
 assert.equal(app.run("session.items.length"),10);
 assert.equal(app.run("session.items.every(q=>q.lesson==='13.11.2026')"),true);
});
