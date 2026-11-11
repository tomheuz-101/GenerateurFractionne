function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function api(url,method="GET",body){
  const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json()}catch(e){}
  return {ok:r.ok,status:r.status,j};
}
const fmtDate=s=>s?new Date(s+(/[zZ+]/.test(s)?"":"Z")).toLocaleDateString("fr-FR"):"";
document.addEventListener("DOMContentLoaded",()=>{

  // Déconnexion
  const o=document.getElementById("navOut");
  if(o)o.onclick=async e=>{e.preventDefault();await api("/api/logout","POST");location.href="/"};

    // Menu latéral repliable
  const sb=document.getElementById("sb");
  const t=document.getElementById("sbToggle");
  const ov=document.getElementById("sbOverlay");
  if(!sb||!t)return;

  let stored=null;
  try{stored=localStorage.getItem("sb")}catch(e){}
  let open=innerWidth>760&&stored!=="0";

  const apply=()=>{
    document.body.classList.toggle("sb-open",open);
    document.body.classList.toggle("sb-closed",!open);
    t.setAttribute("aria-expanded",String(open));
  };
  const save=v=>{try{localStorage.setItem("sb",v)}catch(e){}};

  apply();
  t.onclick=()=>{open=!open;save(open?"1":"0");apply();};
  if(ov)ov.onclick=()=>{open=false;save("0");apply();};
  sb.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
    if(innerWidth<=760){open=false;apply();}
  }));
});
