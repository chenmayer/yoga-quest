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
  assert.equal(app.run('questions().length'),28);
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
  app.run("session.items=[questions()[0]];session.index=0;session.chosen=null");
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
  app.run('chooseOrder(0);chooseOrder(1);chooseOrder(2)');
  assert.equal(app.run('special.feedback.ok'),true);
  app.run("startSpecial('image');special.items=[POSE_SCENARIOS[0]];special.index=0");
  app.run('choosePose(0)');
  assert.equal(app.run('special.feedback.ok'),true);
});
