function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function api(url,method="GET",body){
  const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json()}catch(e){}
  return {ok:r.ok,status:r.status,j};
}
const fmtDate=s=>s?new Date(s+(/[zZ+]/.test(s)?"":"Z")).toLocaleDateString("fr-FR"):"";
document.addEventListener("DOMContentLoaded",()=>{
  const o=document.getElementById("navOut");
  if(o)o.onclick=async e=>{e.preventDefault();await api("/api/logout","POST");location.href="/"};
});
