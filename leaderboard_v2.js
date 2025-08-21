(function(){
  // ========= 設定 =========
  // ★必ず、あなたの GAS Webアプリ URL（/exec で終わる）に置き換えてください
  const LB_API = 'https://script.google.com/macros/s/AKfycbwlrOafQsgNUHLpNyUK08ssegJvAeXvE8uJxQVerDBaEfifIH2txn3r0j4ps1PHdTwq/exec';

  // ========= 内部状態 =========
  const g = (typeof window !== 'undefined') ? window : globalThis;

  // 二重読み込み・多重フック防止（グローバルにフラグ）
  if (g.__LB_INSTALLED__) return;
  g.__LB_INSTALLED__ = true;

  let _lastSubmitAt = 0;
  let _lbLoading = false, _lastJSON = '';

  // ========= UI =========
  function ensureLeaderboardPanel(){
    // 既に #leaderboard があれば作らない（自前設置にも対応）
    if (document.getElementById('leaderboard')) return;
    if (document.querySelector('[data-lb-panel="1"]')) return;

    const container = document.querySelector('.row') || document.body;
    const sec = document.createElement('section');
    sec.className = 'panel';
    sec.setAttribute('data-lb-panel','1');
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

    // 同一 (name, score) の重複を抑止（見た目の重複対策）
    const seen = new Set();
    let rank = 0;
    (list || []).forEach(row=>{
      const name = row.name ?? row.Name ?? '??';
      const score = (row.score ?? row.Score ?? 0) | 0;
      const key = `${name}|${score}`;
      if (seen.has(key)) return;
      seen.add(key);
      rank++;
      if (rank > 10) return;

      const li = document.createElement('li');
      li.textContent = `${rank}. ${name} — ${score}`;
      el.appendChild(li);
    });
  }

  // ======== ランキング取得（重複防止つき） ========
  async function fetchLeaderboard(){
    if(!LB_API.includes('/exec')) return;
    if(_lbLoading) return;              // 多重呼び出し防止
    _lbLoading = true;
    try{
      const res = await fetch(`${LB_API}?action=top`, { method:'GET', cache:'no-store' });
      const data = await res.json();
      const json = JSON.stringify(data);
      if (json !== _lastJSON) {         // 前回と同じなら再描画しない
        renderLeaderboard(Array.isArray(data) ? data : []);
        _lastJSON = json;
      }
    }catch(e){
      console.warn('LB fetch error', e);
    }finally{
      _lbLoading = false;
    }
  }

  function updateMyBestLabel(){
    try{
      const bestLabel = document.getElementById('mybest');
      // hiscore は let で定義されている可能性があるので両対応
      let best = 0;
      try { best = Math.floor(Number((typeof hiscore !== 'undefined' ? hiscore : (g.hiscore ?? 0)))); } catch(_){}
      if (bestLabel && !Number.isNaN(best)) {
        bestLabel.textContent = `あなたのベスト：${best}`;
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
      fetchLeaderboard(); // 送信後に更新
    }catch(e){
      console.warn('LB submit error', e);
    }
  }

  // ========= gameOver フック =========
  function tryInstallHook(){
    if (g.__LB_HOOK_INSTALLED__) return true;
    if (typeof g.gameOver !== 'function') return false;

    const orig = g.gameOver;
    const wrapped = function(reason){
      // ★ スコアを先にスナップショット（元の処理で0にされるのを防ぐ）
      let finalScoreSnap = 0, bestSnap = 0;
      try { finalScoreSnap = Math.floor(Number((typeof score   !== 'undefined' ? score   : (g.score   ?? 0)))); } catch(_){}
      try { bestSnap       = Math.floor(Number((typeof hiscore !== 'undefined' ? hiscore : (g.hiscore ?? 0)))); } catch(_){}

      try{
        // ゲーム側の処理（UI更新・hiscore保存など）
        orig.apply(this, arguments);
      } finally {
        updateMyBestLabel();
        try{
          if(finalScoreSnap >= bestSnap){
            let nick = '';
            try { nick = localStorage.getItem('dodge_nick') || ''; } catch(_){}
            nick = prompt('新記録！ニックネームを入力してください（20文字まで）', nick || '');
            if(nick){
              nick = String(nick).trim().slice(0,20);
              try { localStorage.setItem('dodge_nick', nick); } catch(_){}
              submitScore(nick, finalScoreSnap); // ★ スナップショットを送信
            }
          }
        }catch(e){
          console.warn('nickname submit skipped', e);
        }
      }
    };
    wrapped.__wrapped__ = true;
    g.gameOver = wrapped;
    g.__LB_HOOK_INSTALLED__ = true;
    return true;
  }

  // ========= 初期化 =========
  function init(){
    ensureLeaderboardPanel();
    fetchLeaderboard();
    setTimeout(updateMyBestLabel, 300);

    // gameOver が後から定義されるケースに備えてリトライ
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
