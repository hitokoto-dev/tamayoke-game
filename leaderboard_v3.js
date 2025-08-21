// === leaderboard_v3.js ===
const LB_API = 'https://script.google.com/macros/s/AKfycbwlrOafQsgNUHLpNyUK08ssegJvAeXvE8uJxQVerDBaEfifIH2txn3r0j4ps1PHdTwq/exec';
const SEND_ONLY_ON_BEST = true; // 新記録のみ送信（falseにすると毎回送信）

(function(){
  const g = (typeof window!=='undefined')?window:globalThis;
  if (g.__LBV3__) return; g.__LBV3__ = true;

  function ensurePanel(){
    if (document.getElementById('leaderboard')) return;
    const container = document.querySelector('.row') || document.body;
    const sec = document.createElement('section');
    sec.className = 'panel';
    sec.innerHTML = `
      <h3>ランキング TOP10</h3>
      <ol id="leaderboard" style="padding-left:18px;margin:6px 0;"></ol>
      <div id="mybest" style="opacity:.9;margin-top:6px;"></div>`;
    container.appendChild(sec);
  }
  function setMyBest(v){
    const el = document.getElementById('mybest');
    if (el) el.textContent = `あなたのベスト：${v|0}`;
  }

  let loading=false, lastJson='';
  async function fetchLB(){
    if(!LB_API.includes('/exec') || loading) return;
    loading = true;
    try{
      const res = await fetch(`${LB_API}?action=top`, {cache:'no-store'});
      const data = await res.json();
      const json = JSON.stringify(data);
      if (json===lastJson) return;
      lastJson = json;

      const el = document.getElementById('leaderboard');
      if (!el) return;
      el.innerHTML = '';
      const seen = new Set();
      let rank=0;
      (Array.isArray(data)?data:[]).forEach(r=>{
        const name = (r.name ?? r.Name ?? '??').toString();
        const score = (r.score ?? r.Score ?? 0)|0;
        const key = `${name}|${score}`;
        if (seen.has(key) || ++rank>10) return;
        seen.add(key);
        const li = document.createElement('li');
        li.textContent = `${rank}. ${name} — ${score}`;
        el.appendChild(li);
      });
    }catch(e){ console.warn('LB fetch error', e); }
    finally { loading=false; }
  }

  // ゲーム側から明示的に呼ぶ受付口
  let lastSubmitAt = 0;
  g.lbOnGameOver = async function(finalScore, hiscore){
    const s = Math.floor(Number(finalScore) || 0);
    const best = Math.floor(Number(hiscore) || 0);
    setMyBest(best);

    // 0点は送らない（誤送信防止）
    if (s <= 0) { fetchLB(); return; }

    if (SEND_ONLY_ON_BEST && s < best) { fetchLB(); return; }

    const now = Date.now();
    if (now - lastSubmitAt < 2000) { fetchLB(); return; }
    lastSubmitAt = now;

    let nick = '';
    try { nick = localStorage.getItem('dodge_nick') || ''; } catch(_){}
    nick = prompt('新記録！ニックネームを入力してください（20文字まで）', nick) || '';
    nick = nick.trim().slice(0,20);
    if (!nick) { fetchLB(); return; }
    try { localStorage.setItem('dodge_nick', nick); } catch(_){}

    const body = new URLSearchParams({ name:nick, score:String(s), _ua:navigator.userAgent.slice(0,60) });
    try {
      await fetch(LB_API, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
      fetchLB();
    } catch(e) {
      console.warn('LB submit error', e);
    }
  };

  function init(){
    ensurePanel();
    fetchLB();
    setInterval(fetchLB, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
