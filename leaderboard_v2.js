(function(){
  // ========= 設定 =========
  // ★必ず、あなたの GAS Webアプリ URL（/exec で終わる）に置き換えてください
  const LB_API = 'https://hitokoto-dev.github.io/tamayoke-game/exec';

  // ========= 内部状態 =========
  const g = (typeof window !== 'undefined') ? window : globalThis;
  let _lastSubmitAt = 0;
  let _hookInstalled = false;

  // ========= UI =========
  function ensureLeaderboardPanel(){
    if (document.getElementById('leaderboard')) return;
    const container = document.querySelector('.row') || document.body;
    const sec = document.createElement('section');
    sec.className = 'panel';
    sec.innerHTML = [
      '<h3>ランキング TOP10</h3>',
      '<ol id="leaderboard" style="padding-left:18px;margin:6px 0;"></ol>',
      '<div id="mybest" style="opacity:.9;margin-top:6px;"></div>'
    ].join('');
    container.appendChild(sec);
  }
  function renderLeaderboard(list){
    const el = document.getElementById('leaderboard');
    if(!el) return;
    el.innerHTML = '';
    (list || []).forEach((row, i)=>{
      const li = document.createElement('li');
      // GAS 側は {name, score, date} 形式を返す想定
      const name = row.name ?? row.Name ?? '??';
      const score = (row.score ?? row.Score ?? 0) | 0;
      li.textContent = `${i+1}. ${name} — ${score}`;
      el.appendChild(li);
    });
  }
  async function fetchLeaderboard(){
    if(!LB_API.includes('/exec')) return;
    try{
      const res = await fetch(`${LB_API}?action=top`, { method:'GET' });
      const data = await res.json();
      renderLeaderboard(Array.isArray(data) ? data : []);
    }catch(e){
      console.warn('LB fetch error', e);
    }
  }
  function updateMyBestLabel(){
    try{
      const bestLabel = document.getElementById('mybest');
      if (bestLabel && typeof g.hiscore !== 'undefined') {
        bestLabel.textContent = `あなたのベスト：${g.hiscore | 0}`;
      }
    }catch(_){}
  }

  // ========= 送信 =========
  async function submitScore(name, score){
    if(!LB_API.includes('/exec')) return;
    const now = Date.now();
    if(now - _lastSubmitAt < 3000) return; // 3秒レート制限
    _lastSubmitAt = now;

    name = String(name || '').replace(/[<>]/g,'').slice(0,20);
    const body = new URLSearchParams({
      name,
      score: Math.floor(score || 0).toString(),
      _ua: navigator.userAgent.slice(0,60)
    });
    try{
      await fetch(LB_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      fetchLeaderboard();
    }catch(e){
      console.warn('LB submit error', e);
    }
  }

  // ========= gameOver フック =========
  function tryInstallHook(){
    if(_hookInstalled) return true;
    if(typeof g.gameOver !== 'function') return false;

    const orig = g.gameOver;
    const wrapped = function(reason){
      try{
        // 既存の gameOver を先に実行（UI更新やhiscore保存など）
        orig.apply(this, arguments);
      } finally {
        // 表示更新
        updateMyBestLabel();
        // 新記録なら名前入力して送信
        try{
          const finalScore = Math.floor(g.score || 0);
          const best = Math.floor(g.hiscore || 0);
          if(finalScore >= best){
            let nick = '';
            try { nick = localStorage.getItem('dodge_nick') || ''; } catch(_){}
            nick = prompt('新記録！ニックネームを入力してください（20文字まで）', nick || '');
            if(nick){
              nick = String(nick).trim().slice(0,20);
              try { localStorage.setItem('dodge_nick', nick); } catch(_){}
              submitScore(nick, finalScore);
            }
          }
        }catch(e){
          console.warn('nickname submit skipped', e);
        }
      }
    };
    wrapped.__wrapped__ = true;
    g.gameOver = wrapped;
    _hookInstalled = true;
    return true;
  }

  // ========= 初期化 =========
  function init(){
    ensureLeaderboardPanel();
    fetchLeaderboard();
    setTimeout(updateMyBestLabel, 300);

    // gameOver が後から定義される可能性に備えてリトライ
    let retries = 40; // 約20秒
    (function waitHook(){
      if (tryInstallHook()) return;
      if (--retries <= 0) return;
      setTimeout(waitHook, 500);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();