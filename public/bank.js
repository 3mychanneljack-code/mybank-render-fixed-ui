const PI_URL = "http://YOUR_PI_IP:4000";

async function restore(){
  try{
    const r = await fetch(PI_URL + "/restore");
    const d = await r.json();
    if(d.length) localStorage.mybank_users = JSON.stringify(d);
  }catch{}
}

setInterval(async ()=>{
  try{
    const u = JSON.parse(localStorage.mybank_users || "[]");
    await fetch(PI_URL + "/backup",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(u)
    });
  }catch{}
},20000);

restore();
