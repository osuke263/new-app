import { z } from 'zod';
export const RULE_VERSION = 'tempo-1.0';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v+'T00:00:00+09:00')) && new Date(Date.parse(v+'T00:00:00Z')).toISOString().slice(0,10)===v);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const stamp = z.string().refine(v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)&&date.safeParse(v.slice(0,10)).success&&time.safeParse(v.slice(11)).success);
const id = z.string().min(1).max(100);
export const profileSchema=z.object({focus:z.number().int().min(10).max(90),support:z.enum(['gentle','balanced','early']),bufferDays:z.number().int().min(0).max(7),reserve:z.number().int().min(0).max(40),dayStart:time,dayEnd:time,dailyMax:z.number().int().min(15).max(480),weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7),breakMinutes:z.number().int().min(0).max(30),blocked:z.array(z.object({id,title:z.string().max(80),weekdays:z.array(z.number().int().min(0).max(6)).min(1),start:time,end:time}).refine(b=>b.end>b.start)).max(30)}).refine(p=>p.dayStart<p.dayEnd,'終了時刻は開始時刻より後にしてください');
export const goalSchema=z.object({id,title:z.string().trim().min(1).max(120),category:z.enum(['study','work','life']),due:stamp,start:date,total:z.number().int().min(5).max(10000),firstStep:z.string().trim().min(1).max(200),cue:z.string().max(200),priority:z.enum(['high','normal']),createdAt:z.string(),color:z.number().int().min(0).max(4),milestones:z.array(z.object({id,title:z.string().trim().min(1).max(100),due:stamp,minutes:z.number().int().min(5).max(10000)})).min(1).max(12)}).refine(g=>g.start<=g.due.slice(0,10),'開始日は締切より前にしてください').refine(g=>g.milestones.reduce((a,m)=>a+m.minutes,0)===g.total&&g.milestones.every((m,i)=>m.due<=g.due&&m.due.slice(0,10)>=g.start&&(!i||m.due>=g.milestones[i-1].due)),'マイルストーンの時間と日付を確認してください');
const sessionSchema=z.object({id,goalId:id,milestoneId:id,start:stamp,minutes:z.number().int().min(1).max(480),title:z.string().max(200),status:z.enum(['planned','running','paused','done']),locked:z.boolean(),actual:z.number().min(0).max(1440).nullable(),runningAt:z.number().nullable(),elapsed:z.number().min(0),completedAt:z.string().nullable(),rule:z.string().max(40)});
const fixedSchema=z.object({id,title:z.string().trim().min(1).max(100),start:stamp,end:stamp}).refine(e=>e.end>e.start,'終了日時は開始日時より後にしてください');
const eventSchema=z.object({id,at:z.string(),kind:z.enum(['created','planned','started','paused','completed','postponed','settings','deleted']),goalId:z.string().optional(),reason:z.string().max(200).optional(),minutes:z.number().optional()});
export const stateSchema=z.object({schema:z.literal(1),assessment:z.object({answers:z.array(z.string().max(100)).length(6),completedAt:z.string()}).nullable(),profile:profileSchema,goals:z.array(goalSchema).max(100),sessions:z.array(sessionSchema).max(3000),fixed:z.array(fixedSchema).max(1000),events:z.array(eventSchema).max(2000)}).superRefine((s,ctx)=>{const gids=new Set(s.goals.map(g=>g.id)); if(gids.size!==s.goals.length||new Set(s.sessions.map(t=>t.id)).size!==s.sessions.length||new Set(s.fixed.map(t=>t.id)).size!==s.fixed.length)ctx.addIssue({code:'custom',message:'IDが重複しています'}); if(s.sessions.some(t=>!gids.has(t.goalId)||!s.goals.find(g=>g.id===t.goalId)?.milestones.some(m=>m.id===t.milestoneId)))ctx.addIssue({code:'custom',message:'予定の目標が見つかりません'});if(new Set(s.goals.flatMap(g=>g.milestones.map(m=>m.id))).size!==s.goals.reduce((a,g)=>a+g.milestones.length,0))ctx.addIssue({code:'custom',message:'区切りのIDが重複しています'});for(const g of s.goals){for(const m of g.milestones){if(s.sessions.filter(t=>t.milestoneId===m.id).reduce((a,t)=>a+t.minutes,0)>m.minutes)ctx.addIssue({code:'custom',message:'区切りの作業量を超えています'});}if(s.sessions.filter(t=>t.goalId===g.id).reduce((a,t)=>a+t.minutes,0)>g.total)ctx.addIssue({code:'custom',message:'作業量が目標を超えています'});}if(s.sessions.filter(t=>t.status==='running').length>1)ctx.addIssue({code:'custom',message:'同時に実行できるのは1件です'});});
export type Profile=z.infer<typeof profileSchema>; export type Goal=z.infer<typeof goalSchema>;export type Session=z.infer<typeof sessionSchema>;export type Fixed=z.infer<typeof fixedSchema>;export type State=z.infer<typeof stateSchema>;
export const defaultProfile:Profile={focus:25,support:'balanced',bufferDays:1,reserve:20,dayStart:'09:00',dayEnd:'20:00',dailyMax:180,weekdays:[1,2,3,4,5],breakMinutes:5,blocked:[{id:'lunch',title:'昼休み',weekdays:[0,1,2,3,4,5,6],start:'12:00',end:'13:00'}]};
export const emptyState=():State=>({schema:1,assessment:null,profile:{...defaultProfile},goals:[],sessions:[],fixed:[],events:[]});
export const uid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
export const epoch=(v:string)=>Date.parse(v+(v.length===10?'T00:00':'')+':00+09:00');
export const wall=(n=Date.now())=>new Date(n+9*3600000).toISOString().slice(0,16);
export const today=()=>wall().slice(0,10);
export const addDays=(d:string,n:number)=>wall(epoch(d)+n*86400000).slice(0,10);
export const weekday=(d:string)=>new Date(d+'T12:00:00+09:00').getUTCDay();
export const endOf=(s:Session)=>epoch(s.start)+s.minutes*60000;
export const dayLabel=(d:string)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(epoch(d.slice(0,10))));
export const duration=(m:number)=>m>=60?`${Math.floor(m/60)}時間${m%60?`${m%60}分`:''}`:`${m}分`;
export const doneMinutes=(s:State,gid:string)=>s.sessions.filter(t=>t.goalId===gid&&t.status==='done').reduce((a,t)=>a+t.minutes,0);
export const event=(s:State,kind:State['events'][number]['kind'],extra:Partial<State['events'][number]>={})=>({...s,events:[...s.events,{id:uid(),at:new Date().toISOString(),kind,...extra}].slice(-2000)});
export type Plan={sessions:Session[],warnings:string[],shortages:{goalId:string,title:string,minutes:number}[],conflicts:string[],targets:Record<string,string>};
export function plan(s:State,now=Date.now(),notBefore?:string):Plan {
 const p=s.profile;
 const keep=s.sessions.filter(t=>t.status!=='planned'||t.locked);
 const out=[...keep];
 const warnings:string[]=[], conflicts:string[]=[];
 const shortages:Plan['shortages']=[], targets:Record<string,string>={};
 const from=Math.max(now,notBefore?epoch(notBefore):now);
 const firstDay=wall(from).slice(0,10);
 const dailyLimit=Math.floor(p.dailyMax*(1-p.reserve/100));
 const predecessorEnds:Record<string,number>={};
 // Earliest milestone deadline first across ALL goals, with each goal's order retained.
 const stages=s.goals.flatMap(g=>g.milestones.map((m,i)=>({g,m,i}))).sort((a,b)=>
  epoch(a.m.due)-epoch(b.m.due)||((a.g.priority==='high'?0:1)-(b.g.priority==='high'?0:1))||a.i-b.i);
 for(const {g,m:milestone} of stages){
  const keptPhase=keep.filter(t=>t.goalId===g.id&&t.milestoneId===milestone.id);
  let remaining=milestone.minutes-keptPhase.reduce((a,t)=>a+t.minutes,0);
  const predecessor=predecessorEnds[g.id]??from;
  if(remaining<=0){predecessorEnds[g.id]=Math.max(predecessor,...keptPhase.filter(t=>t.status!=='done').map(endOf));continue;}
  const phaseFrom=Math.max(from,predecessor), deadline=epoch(milestone.due);
  const target=Math.max(phaseFrom,deadline-p.bufferDays*86400000);
  targets[milestone.id]=wall(target);
  const needsFirstStep=!out.some(t=>t.goalId===g.id);
  let isFirst=needsFirstStep, fallback=false;
  const phaseOut:Session[]=[];
  while(remaining>0){
   const desired=Math.min(remaining,isFirst&&p.support!=='gentle'?10:p.focus);
   const candidates:{start:number,minutes:number,score:number}[]=[];
   for(let di=0;di<=180;di++){
    const d=addDays(firstDay,di);
    if(epoch(d)>deadline)break;
    if(d<g.start||!p.weekdays.includes(weekday(d)))continue;
    const used=out.filter(t=>t.start.slice(0,10)===d).reduce((a,t)=>a+t.minutes,0);
    const allowance=dailyLimit-used;
    if(allowance<Math.min(5,remaining))continue;
    const min=Math.max(epoch(d+'T'+p.dayStart),Math.ceil(phaseFrom/300000)*300000);
    const max=Math.min(epoch(d+'T'+p.dayEnd),fallback?deadline:target);
    if(max<=min)continue;
    const busy=[
     ...p.blocked.filter(b=>b.weekdays.includes(weekday(d))).map(b=>[epoch(d+'T'+b.start),epoch(d+'T'+b.end)]),
     ...s.fixed.map(e=>[epoch(e.start),epoch(e.end)]),
     ...out.map(t=>[epoch(t.start)-p.breakMinutes*60000,endOf(t)+p.breakMinutes*60000]),
     [max,max]
    ].sort((a,b)=>a[0]-b[0]);
    let cursor=min;
    for(const [a,b] of busy){
     const minutes=Math.min(desired,allowance,Math.floor((Math.min(a,max)-cursor)/60000));
     if(minutes>=Math.min(5,remaining)){
      const factor=isFirst?10:p.support==='early'?0.8:p.support==='balanced'?0.2:0.025;
      candidates.push({start:cursor,minutes,score:di*factor+used/Math.max(1,dailyLimit)+(1-minutes/desired)*0.3});
      if(minutes===desired)break;
     }
     cursor=Math.max(cursor,b);
     if(cursor>=max)break;
    }
   }
   candidates.sort((a,b)=>a.score-b.score||a.start-b.start);
   if(!candidates.length){
    if(!fallback){fallback=true;continue;}
    shortages.push({goalId:g.id,title:g.title+' / '+milestone.title,minutes:remaining});break;
   }
   const chosen=candidates[0];
   const task:Session={id:uid(),goalId:g.id,milestoneId:milestone.id,start:wall(chosen.start),minutes:chosen.minutes,title:isFirst?g.firstStep:milestone.title,status:'planned',locked:false,actual:null,runningAt:null,elapsed:0,completedAt:null,rule:RULE_VERSION};
   out.push(task);phaseOut.push(task);remaining-=chosen.minutes;isFirst=false;
  }
  phaseOut.sort((a,b)=>a.start.localeCompare(b.start));
  if(phaseOut.length&&needsFirstStep){phaseOut[0].title=g.firstStep;for(let i=1;i<phaseOut.length;i++)phaseOut[i].title=milestone.title;}
  if(fallback&&phaseOut.some(t=>endOf(t)>target))warnings.push(`${milestone.title}：余裕を残す目標には収まらず、設定された締切までの枠を使います。`);
  predecessorEnds[g.id]=Math.max(predecessor,...phaseOut.map(endOf),...keptPhase.filter(t=>t.status!=='done').map(endOf));
 }
 if(s.goals.some(g=>epoch(g.due)>from+180*86400000))warnings.push('配置は今日から180日先までです。長期の目標は段階に分けてください。');
 for(const g of s.goals){let before=-Infinity;for(const m of g.milestones){const tasks=out.filter(t=>t.goalId===g.id&&t.milestoneId===m.id&&t.status!=='done');if(tasks.some(t=>epoch(t.start)<before))conflicts.push(`${g.title}：固定・実行中の作業とマイルストーンの順序が両立しません。固定を見直してください。`);before=Math.max(before,...tasks.map(endOf));}}
 return {sessions:out.sort((a,b)=>a.start.localeCompare(b.start)),warnings,shortages,conflicts:[...new Set(conflicts)],targets};
}
export function learning(s:State){
 const records=s.sessions.filter(t=>t.status==='done'&&t.actual!==null&&t.actual>=1&&t.actual<=240);
 const median=(n:number[])=>{const v=[...n].sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:0;};
 const ratio=median(records.map(t=>t.actual!/t.minutes));const focus=median(records.map(t=>t.actual!));
 const reluctant=new Set(s.events.filter(e=>e.kind==='postponed'&&e.reason==='取りかかりにくい').map(e=>e.goalId)).size;
 return {n:records.length,ratio:records.length>=3?Math.max(.75,Math.min(2,ratio)):1,focus:records.length>=3?Math.max(10,Math.min(60,Math.round(focus/5)*5)):s.profile.focus,reluctant};
}
export function demoState(now=Date.now()):State{
 const s=emptyState();s.profile.weekdays=[0,1,2,3,4,5,6];s.assessment={answers:['sometimes','25','unknown','normal','later','earlier'],completedAt:new Date(now).toISOString()};const d=wall(now).slice(0,10);s.goals=[
 {id:'demo-report',title:'研究発表のスライドを仕上げる',category:'study',due:addDays(d,5)+'T18:00',start:d,total:240,firstStep:'伝えたいことを3つ書き出す',cue:'飲み物を用意して、机に座ったら',priority:'high',createdAt:new Date(now).toISOString(),color:0,milestones:[{id:'demo-m1',title:'構成を決める',due:addDays(d,2)+'T18:00',minutes:60},{id:'demo-m2',title:'スライドを作成',due:addDays(d,4)+'T18:00',minutes:150},{id:'demo-m3',title:'通して確認する',due:addDays(d,5)+'T18:00',minutes:30}]},
 {id:'demo-english',title:'英語のプレゼン練習',category:'study',due:addDays(d,7)+'T18:00',start:d,total:120,firstStep:'冒頭の1分を声に出して読む',cue:'昼食後、イヤホンをつけたら',priority:'normal',createdAt:new Date(now).toISOString(),color:1,milestones:[{id:'demo-m4',title:'英語で通して練習',due:addDays(d,7)+'T18:00',minutes:120}]}];
 s.fixed=[{id:'demo-fixed',title:'ゼミ',start:addDays(d,1)+'T13:00',end:addDays(d,1)+'T14:30'}];s.sessions=plan(s,now).sessions;return s;
}
