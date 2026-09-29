import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,csv,validTask,localDate,readLocal,writeLocal} from '../assets/js/portal-utils.js';
test('Vietnamese search handles accents, đ, casing and surrounding whitespace',()=>{
  assert.equal(normalize('  ĐIỂM RÈN LUYỆN  '),'diem ren luyen');
  assert.equal(normalize('Nguyễn Minh An'),'nguyen minh an');
});
test('CSV quotes commas, newlines, double quotes and neutralizes spreadsheet formulas',()=>{
  assert.equal(csv([['=HYPERLINK("x")','a,b','line\nnext']]),'\uFEFF"\'=HYPERLINK(""x"")","a,b","line\nnext"');
  assert.ok(csv([['  +123','@x','-2']]).includes("'  +123"));
});
test('Corrupt tasks and invalid values cannot enter planner rendering',()=>{
  const task={id:'task',title:'Chuẩn bị hồ sơ',done:false,due:'2026-09-20'};
  assert.equal(validTask(task),true);
  for(const bad of [{...task,title:' '},{...task,title:'x'.repeat(161)},{...task,done:'yes'},{...task,due:undefined}])assert.equal(Boolean(validTask(bad)),false);
});
test('Local date uses local calendar rather than UTC date slicing',()=>assert.equal(localDate(new Date(2026,8,19,0,1)),'2026-09-19'));
test('Storage corruption and denial do not crash the page',()=>{
  globalThis.localStorage={getItem:()=>'{broken',setItem:()=>{throw new Error('blocked');}};
  assert.deepEqual(readLocal('x',[]),[]);assert.equal(writeLocal('x',[]),false);
  delete globalThis.localStorage;
});
