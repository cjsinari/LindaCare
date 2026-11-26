// Usage:  node velocity-test.mjs <accessToken>
// Against the deployed service:  BASE_URL=https://<DOMAIN>/api node velocity-test.mjs <accessToken>
// (PowerShell:  $env:BASE_URL = "https://<DOMAIN>/api"; node velocity-test.mjs <accessToken>)
const token = process.argv[2];
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const counts = {}; let firstThrottle=null, firstFlag=null, firstEnded=null;
const t0 = Date.now();
for (let i=1;i<=170;i++){
  const r = await fetch(`${base}/profiles`,{headers:{Authorization:`Bearer ${token}`}});
  const b = await r.json().catch(()=>({}));
  const k = `${r.status} ${b.code||''}`.trim(); counts[k]=(counts[k]||0)+1;
  if (r.status===429 && !firstThrottle) firstThrottle=i;
  if (b.code==='SESSION_FLAGGED' && !firstFlag) firstFlag=i;
  if (b.code==='SESSION_ENDED' && !firstEnded) firstEnded=i;
}
console.table(counts);
console.log({firstThrottle, firstFlag, firstEnded, seconds:((Date.now()-t0)/1000).toFixed(1)});
