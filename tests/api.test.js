import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/api.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'').replace('export async function','async function');
function context(fetch){let expire,delay;const c=vm.createContext({API_URL:'https://example.test/api',AbortController,Error,TypeError,Promise,JSON,fetch,setTimeout:(fn,ms)=>{expire=fn;delay=ms;return 1;},clearTimeout(){}});vm.runInContext(source,c);return {c,expire:()=>expire(),delay:()=>delay};}
test('Deadline covers stalled getIdToken and prevents a late network write',async()=>{
  let resolve,calls=0;const {c,expire}=context(async()=>{calls++;});const promise=c.apiRequest({getIdToken:()=>new Promise(r=>resolve=r)},'createAdminAccount',{});expire();await assert.rejects(promise,e=>e.code==='REQUEST_TIMEOUT');resolve('late-token');await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
test('Deadline covers a stalled response body without retrying an uncertain write',async()=>{
  let calls=0,bodyStarted;const started=new Promise(r=>bodyStarted=r);const {c,expire,delay}=context(async()=>{calls++;return {ok:true,json:()=>{bodyStarted();return new Promise(()=>{});}};});const promise=c.apiRequest({getIdToken:async()=> 'token'},'createUnitAccountAdmin');await started;assert.equal(delay(),60000);expire();await assert.rejects(promise,e=>e.code==='REQUEST_TIMEOUT');assert.equal(calls,1);
});
test('Expired authentication is refreshed once; successful read has one request',async()=>{
  let calls=0;const refresh=[];const {c}=context(async()=>({ok:true,json:async()=>++calls===1?{success:false,code:'AUTH_EXPIRED'}:{success:true,units:[]}}));const value=await c.apiRequest({getIdToken:async force=>{refresh.push(force);return 'token';}},'getUnitAdminWorkspace');assert.equal(value.success,true);assert.deepEqual(refresh,[false,true]);assert.equal(calls,2);
});
