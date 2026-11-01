// Run with: node --experimental-strip-types scripts/reconcile-card-bills.cjs --user-id=1 [--apply]
const fs=require('fs'),path=require('path')
const {planCardBillLinks}=require('../src/lib/utils/card-bill-links.ts')
for(const line of fs.readFileSync(path.join(__dirname,'../.env.local'),'utf8').split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'')}
const {sql}=require('@vercel/postgres')
const userId=Number(process.argv.find(a=>a.startsWith('--user-id='))?.split('=')[1])
const apply=process.argv.includes('--apply')
const overrides=Object.fromEntries((process.argv.find(a=>a.startsWith('--mapping='))?.slice(10)||'').split(',').filter(Boolean).map(pair=>{const [bill,card]=pair.split(':').map(Number);if(!Number.isInteger(bill)||bill<1||!Number.isInteger(card)||card<1)throw Error('Invalid mapping');return [bill,card]}))
const approvedHistory=new Set((process.argv.find(a=>a.startsWith('--archive-history='))?.slice(18)||'').split(',').filter(Boolean).map(Number))
if(!Number.isInteger(userId)||userId<1)throw Error('A positive --user-id is required')
;(async()=>{const client=await sql.connect();try{
 await client.query(apply?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
 if(apply)await client.query('LOCK TABLE budget_bills IN SHARE ROW EXCLUSIVE MODE')
 const bills=(await client.query('SELECT * FROM budget_bills WHERE user_id=$1 ORDER BY id',[userId])).rows
 const cards=(await client.query('SELECT id,name,last_four,owner FROM budget_credit_cards WHERE user_id=$1 ORDER BY id',[userId])).rows
 const plan=planCardBillLinks(bills,cards,overrides)
 console.log(JSON.stringify({mode:apply?'apply':'preview',cardCount:cards.length,billCount:bills.length,plan},null,2))
 if(plan.some(g=>g.protectedBillIds.some(id=>!approvedHistory.has(id))))throw Error('Conflicting payment history or bill details need explicit archive approval: nothing changed')
 if(apply){
  const backup='/home/rich/site-backups/card-bill-links-20261101/records-before-'+Date.now()+'.json'
  fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700})
  const reserves=(await client.query('SELECT * FROM budget_reserves WHERE user_id=$1',[userId])).rows
  fs.writeFileSync(backup,JSON.stringify({createdAt:new Date().toISOString(),userId,bills,cards,reserves,plan},null,2),{mode:0o600})
  await client.query(`CREATE TABLE IF NOT EXISTS budget_card_bill_history (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, credit_card_id INTEGER NOT NULL,
    canonical_bill_id INTEGER NOT NULL, original_bill_id INTEGER NOT NULL,
    original_bill JSONB NOT NULL, archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id,original_bill_id))`)
  for(const group of plan){
   for(const id of [...group.removeBillIds,...group.protectedBillIds]){
    const original=bills.find(b=>b.id===id)
    if(!original)throw Error('Original bill missing')
    await client.query('INSERT INTO budget_card_bill_history (user_id,credit_card_id,canonical_bill_id,original_bill_id,original_bill) VALUES ($1,$2,$3,$4,$5::jsonb)',[userId,group.cardId,group.keepBillId,id,JSON.stringify(original)])
    await client.query('UPDATE budget_reserves SET bill_id=$1 WHERE user_id=$2 AND bill_id=$3',[group.keepBillId,userId,id])
    const result=await client.query('DELETE FROM budget_bills WHERE user_id=$1 AND id=$2',[userId,id])
    if(result.rowCount!==1)throw Error('Duplicate changed during cleanup; rolling back')
   }
   const kept=bills.find(b=>b.id===group.keepBillId)
   const card=cards.find(c=>c.id===group.cardId)
   const label=overrides[group.keepBillId] && card.last_four
     ? kept.payee_name.replace(/(?<!\d)\d{4}(?!\d)/g,card.last_four) : kept.payee_name
   await client.query('UPDATE budget_bills SET credit_card_id=$1,payee_name=$2 WHERE user_id=$3 AND id=$4',[group.cardId,label,userId,group.keepBillId])
  }
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS budget_one_recurring_bill_per_card ON budget_bills (user_id,credit_card_id) WHERE credit_card_id IS NOT NULL AND is_recurring=1')
  console.log('Recoverable record snapshot:',backup)
 }
 await client.query('COMMIT');console.log(apply?'Cleanup committed; card records and canonical payment fields unchanged.':'Preview only; no records changed.')
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await sql.end()}})().catch(error=>{console.error(error.message);process.exit(1)})
