import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {emptyState,stateSchema} from '../lib/tempo.ts';
// Actual route handlers + real SQLite. Identity is injected only in this test.
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_fancy_nuke.sql',import.meta.url),'utf8'));
let identity={userId:'alice',email:'alice@example.test'};
const database=()=>({prepare(sql){let values=[];return{bind(...args){values=args;return this;},async first(){return db.prepare(sql).get(...values)||null},async run(){const r=db.prepare(sql).run(...values);return{meta:{changes:r.changes}}}}}});
const source=readFileSync(new URL('../app/api/state/route.ts',import.meta.url),'utf8').replace(/^import.*\n/gm,'');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports','getChatGPTUser','database','emptyState','stateSchema',code)(exports,async()=>identity,database,emptyState,stateSchema);
const put=(state,revision,origin='https://tempo.test')=>exports.PUT(new Request('https://tempo.test/api/state',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({state,revision})}));
test('API: identity, persistent round-trip, revision conflict, validation, origin, user isolation',async()=>{
 identity=null;assert.equal((await exports.GET()).status,401);assert.equal((await put(emptyState(),0)).status,401);
 identity={userId:'alice',email:'alice@example.test'};assert.equal((await (await exports.GET()).json()).revision,0);
 const state=emptyState();state.profile.focus=45;assert.equal((await put(state,0)).status,200);let got=await (await exports.GET()).json();assert.equal(got.revision,1);assert.equal(got.state.profile.focus,45);
 assert.equal((await put(emptyState(),0)).status,409);assert.equal((await put({invalid:true},1)).status,400);assert.equal((await put(state,1,'https://other.test')).status,403);
 state.profile.focus=30;assert.equal((await put(state,1)).status,200);got=await (await exports.GET()).json();assert.equal(got.revision,2);assert.equal(got.state.profile.focus,30);
 identity={userId:'bob',email:'bob@example.test'};got=await (await exports.GET()).json();assert.equal(got.revision,0);assert.equal(got.state.profile.focus,25);
});
