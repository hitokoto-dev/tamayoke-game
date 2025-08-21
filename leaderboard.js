// ==============================
// Leaderboard Script for GitHub Pages Game
// ==============================

// あなたの Google Apps Script のデプロイ URL (/exec で終わるもの) を貼ってください
const LB_API = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOY_ID/exec";

// ランキングエリアを作成
function initLeaderboardUI() {
  let lb = document.getElementById("leaderboard");
  if (!lb) {
    lb = document.createElement("div");
    lb.id = "leaderboard";
    lb.style.position = "fixed";
    lb.style.top = "10px";
    lb.style.right = "10px";
    lb.style.width = "250px";
    lb.style.maxHeight = "400px";
    lb.style.overflowY = "auto";
    lb.style.background = "rgba(0,0,0,0.7)";
    lb.style.color = "#fff";
    lb.style.padding = "10px";
    lb.style.fontSize = "14px";
    lb.style.borderRadius = "8px";
    lb.innerHTML = "<b>ランキング TOP10</b><div id='lb-list'>読み込み中...</div>";
    document.body.appendChild(lb);
  }
}

// TOP10を取得して表示
async function fetchLeaderboard() {
  try {
    const res = await fetch(LB_API + "?action=top");
    const data = await res.json();
    const list = document.getElementById("lb-list");
    if (!list) return;
    list.innerHTML = data.map((row, i) => 
      (i+1) + ". " + row.Name + " - " + row.Score
    ).join("<br>");
  } catch (e) {
    console.error("Leaderboard fetch error", e);
  }
}

// スコア送信
async function submitScore(name, score) {
  try {
    await fetch(LB_API + "?action=submit", {
      method: "POST",
      body: new URLSearchParams({name, score})
    });
    fetchLeaderboard();
  } catch (e) {
    console.error("Score submit error", e);
  }
}

// ゲームオーバー時に呼ばれる関数を上書き/フック
function hookGameOver(originalFn) {
  return function(score) {
    // 元の処理
    if (originalFn) originalFn(score);
    // 新記録時に名前入力
    let nick = localStorage.getItem("dodge_nick") || "";
    if (!nick) {
      nick = prompt("ニックネームを入力してください", "player");
      if (!nick) return;
      localStorage.setItem("dodge_nick", nick);
    }
    submitScore(nick, score);
  }
}

// 初期化
window.addEventListener("load", () => {
  initLeaderboardUI();
  fetchLeaderboard();
  // 既存の gameOver をフック
  if (typeof window.gameOver === "function") {
    window.gameOver = hookGameOver(window.gameOver);
  }
});
