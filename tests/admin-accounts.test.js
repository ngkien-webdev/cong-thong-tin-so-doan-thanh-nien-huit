import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../backend/deploy/Code.gs',import.meta.url),'utf8');
const owner={uid:'owner',email:'owner@example.test',emailVerified:true};
const admin={uid:'admin-uid',email:'staff@admins.huit-youth-portal.local',emailVerified:false};
function context(){
  const rows=[],writes=[];const c=vm.createContext({console,Date,JSON,Object,Number,Map,Set,Error});vm.runInContext(source,c);
  c.portalV4PrimeRows_=()=>{};c.isAdmin_=user=>user.uid===owner.uid;c.portalV3Rows_=()=>rows;c.portalV3Sheet_=()=>({});c.portalV3Lock_=fn=>fn();c.portalV3Append_=(name,data)=>({name,data});c.portalV3Update_=(name,data)=>({name,data});c.portalV3Batch_=batch=>writes.push(batch);
  return {c,rows,writes};
}
test('Unverified administrator alias requires an exact active Firebase UID grant',()=>{
  const {c,rows}=context();assert.equal(c.portalAdminAllowed_(admin),false);rows.push({...admin,active:true});assert.equal(c.portalAdminAllowed_(admin),true);assert.equal(c.portalAdminAllowed_({...admin,uid:'forged'}),false);rows[0].active=false;assert.equal(c.portalAdminAllowed_(admin),false);assert.equal(c.portalAdminAllowed_(owner),true);assert.equal(c.portalAdminAllowed_({...owner,emailVerified:false}),false);
});
test('Provisioned administrator cannot create, list or lock administrators',()=>{
  const {c,rows,writes}=context();rows.push({...admin,active:true});c.authenticate_=()=>admin;
  for(const action of ['listAdminAccounts','createAdminAccount','setAdminAccountActive'])assert.throws(()=>c.portalAdminRoute_(action,{}),e=>e.code==='OWNER_REQUIRED');assert.equal(writes.length,0);
});
test('Owner provisions username without email verification and never stores secret or token',()=>{
  const {c,writes}=context();c.portalV4FirebasePassword_=(method,email)=>({ok:true,data:{email,localId:'new-admin',idToken:'secret-token'}});
  const result=c.portalAdminCreate_(owner,{username:'staff.test',displayName:'Cán bộ thử nghiệm',password:'long-test-password'});
  assert.equal(result.account.uid,'new-admin');assert.equal(writes[0][0].name,'AdminAccounts');assert.equal(writes[0][0].data.email,'staff.test@admins.huit-youth-portal.local');assert.ok(!JSON.stringify(writes).includes('long-test-password'));assert.ok(!JSON.stringify(result).includes('secret-token'));
});
test('Failed account reconciliation and weak passwords never grant access',()=>{
  const {c,writes}=context();c.portalV4FirebasePassword_=method=>({ok:false,data:{error:{message:method==='signUp'?'EMAIL_EXISTS':'INVALID_PASSWORD'}}});
  assert.throws(()=>c.portalAdminCreate_(owner,{username:'staff',displayName:'Cán bộ',password:'short'}),e=>e.code==='INVALID_PASSWORD');
  assert.throws(()=>c.portalAdminCreate_(owner,{username:'staff',displayName:'Cán bộ',password:'long-test-password'}),e=>e.code==='ACCOUNT_EXISTS');assert.equal(writes.length,0);
});
test('Locking is server-side, preserves identity, and forbids self lock',()=>{
  const {c,rows,writes}=context();rows.push({...admin,username:'staff',active:true,_row:1});c.portalAdminSetActive_(owner,{uid:admin.uid,active:false});assert.equal(writes[0][0].data.active,false);assert.equal(writes[0][0].data.uid,admin.uid);rows.push({...owner,active:true});assert.throws(()=>c.portalAdminSetActive_(owner,{uid:owner.uid,active:false}),e=>e.code==='SELF_LOCK');
});
test('Combined faculty administration authenticates once and returns both lists',()=>{
  const {c}=context();let calls=0;c.authenticate_=(token,required)=>{calls++;assert.equal(required,true);return owner;};c.portalV3Rows_=name=>name==='PortalUnits'?[{id:'UNIT-A',name:'Khoa A',active:true}]:[];
  const result=c.portalV4Route_('getUnitAdminWorkspace',{});assert.equal(calls,1);assert.equal(result.units.length,1);assert.equal(result.members.length,0);assert.equal(result.canManageAdmins,true);
});
test('Batched reads preserve physical row indices, reject bad headers, and are request-scoped',()=>{
  const c=vm.createContext({console,Date,JSON,Object,Number,Map,Set,Error,encodeURIComponent});vm.runInContext(source,c);let calls=0,bad=false;
  c.requiredProperty_=()=> 'test';c.ScriptApp={getOAuthToken:()=> 'test'};c.UrlFetchApp={fetch:()=>{calls++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({valueRanges:[{values:[[bad?'wrong':'id','name','type','active','createdAt','updatedAt','updatedBy'],[],['UNIT-A','Khoa A','faculty',true]]}]})};}};
  c.portalV4BeginRequest_();c.portalV4PrimeRows_(['PortalUnits']);assert.equal(c.portalV3Rows_('PortalUnits')[0]._row,2);assert.equal(c.portalV3Rows_('PortalUnits')[0].active,true);c.portalV4PrimeRows_(['PortalUnits']);assert.equal(calls,1);c.portalV4BeginRequest_();bad=true;assert.throws(()=>c.portalV4PrimeRows_(['PortalUnits']),e=>e.code==='SCHEMA_MISMATCH');assert.equal(calls,2);
});
