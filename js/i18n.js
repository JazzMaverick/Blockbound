// Language support: English (source text) and Traditional Chinese.
// tl('English text', { name: 'x' }) returns the translation, with {name} placeholders filled in.
// Missing translations fall back to English.
export const LANG_NAMES = { en: 'English', 'zh-Hant': '繁體中文' };
let cur = 'en';
export function detectLang() {
  const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return /^zh/i.test(l) ? 'zh-Hant' : 'en';
}
export function setLang(l) { cur = l === 'zh-Hant' ? 'zh-Hant' : 'en'; return cur; }
export const getLang = () => cur;
export function tl(key, p) {
  let s = (cur === 'zh-Hant' && ZH[key]) || EN[key] || key;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] ?? m));
  return s;
}

// Keys with a |context suffix share an English word but need different translations.
const EN = { 'Open|file': 'Open' };

const ZH = {
  'Open|file': '開啟',
  // ---- title, identity, platform ----
  'Ashvale': '灰谷', 'Ashvale RTS': '灰谷 · 即時戰略', 'Raising the banners…': '正在升起旗幟…',
  'Real-time strategy for 1–4 players. Gather gold and lumber, raise an army, lead your hero.': '1–4 人即時戰略遊戲。採集黃金與木材，組建軍隊，率領你的英雄。',
  'Rendering with WebGPU': '使用 WebGPU 繪製', 'WebGPU unavailable here, using WebGL 2': '此處無法使用 WebGPU，改用 WebGL 2',
  'This browser cannot start WebGPU or WebGL 2. Try a recent Chrome, Edge or Safari.': '此瀏覽器無法啟動 WebGPU 或 WebGL 2，請改用新版 Chrome、Edge 或 Safari。',
  'Host online game': '建立線上對戰', 'Join': '加入', 'Room code': '房間代碼', 'Play vs computer': '與電腦對戰', 'Map editor': '地圖編輯器',
  'Settings': '設定', 'How to play': '遊戲說明', 'Ladder': '天梯排名', 'Language': '語言',
  'Sign in with Google': '使用 Google 帳號登入', 'Sign out': '登出', 'Sign-in failed': '登入失敗',
  'Signed in': '已登入', 'Not signed in': '尚未登入', 'Guest': '訪客', 'You': '你',
  'Signed in with Google': '已使用 Google 帳號登入', 'Sign in with Google to play online': '使用 Google 帳號登入即可線上對戰',
  'Signed in with your Claude account': '已使用 Claude 帳號登入', 'Offline · open on claude.ai to sign in': '離線 · 請在 claude.ai 開啟以登入',
  'Online play is not set up on this site yet': '本網站尚未設定線上對戰',
  'Host a game and send friends the room code. They sign in on this site and join.': '建立遊戲後把房間代碼傳給朋友，他們在本網站登入即可加入。',
  'Sign in to host or join online games. Playing the computer and the editor work without signing in.': '登入後即可建立或加入線上對戰。不登入也能與電腦對戰及使用地圖編輯器。',
  'Add your Firebase settings to firebase-config.js to turn on online play (see README).': '在 firebase-config.js 填入你的 Firebase 設定即可啟用線上對戰（請參閱 README）。',
  'Share this page with friends (Contributor access), host a game, then send them the room code.': '把此頁面分享給朋友（給予「參與者」權限），建立遊戲後再把房間代碼傳給他們。',
  'Online play needs this page open on claude.ai while signed in. You can still play against the computer.': '線上對戰需要在 claude.ai 登入後開啟此頁面。你仍然可以與電腦對戰。',
  'Could not connect directly to a player. Their network may need a TURN server (see README).': '無法直接連線到某位玩家，對方的網路可能需要 TURN 伺服器（請參閱 README）。',

  // ---- lobby ----
  'Copy code': '複製代碼', 'Copied': '已複製', 'Copy blocked here. Select the text and copy it.': '此處無法自動複製，請選取文字後手動複製。',
  'Map': '地圖', 'Library': '地圖庫', 'Fog of war': '戰爭迷霧', 'Ranked match': '積分賽', '(players only, counts on the ladder)': '（僅限玩家，計入天梯）',
  'Leave': '離開', 'Start game': '開始遊戲', 'Looking for the host…': '正在尋找主機…',
  'Player': '玩家', 'Computer': '電腦', 'Open': '開放', 'Closed': '關閉', 'Not on this map': '此地圖無此位置',
  'host': '主機', 'you': '你', 'left': '已離開', 'Team {n}': '第 {n} 隊', '{n} start locations': '{n} 個出生點', '{slot} player': '{slot}玩家',
  'Random hero': '隨機英雄',
  'Put at least two teams in the game to start.': '至少需要兩支隊伍才能開始。',
  'Friends join with the code above. Open slots stay empty if nobody joins.': '朋友輸入上方代碼即可加入。無人加入的開放位置會保持空缺。',
  'Game in progress, joining…': '遊戲進行中，正在加入…', 'You are {slot}. Waiting for the host to start.': '你是{slot}，等待主機開始遊戲。',
  'The room is full. You will watch as a spectator.': '房間已滿，你將以觀戰者身分觀看。',
  'No host found in room {code} yet. Check the code with the host.': '房間 {code} 目前找不到主機，請向主機確認代碼。',
  'Enter the room code from the host': '請輸入主機提供的房間代碼', 'Could not open a room': '無法開啟房間', 'Could not join that room': '無法加入該房間',
  'Ranked matches are for players only. Close the computer slots.': '積分賽僅限玩家參加，請關閉電腦位置。',
  'Every player must be signed in for a ranked match.': '所有玩家都必須登入才能進行積分賽。',
  'Ranked matches need at least two teams.': '積分賽至少需要兩支隊伍。',
  'Could not record the ranked match': '無法記錄這場積分賽',
  'This account cannot send game updates here. Ask the page owner for Contributor access.': '此帳號無法在這裡傳送遊戲資料，請向頁面擁有者申請「參與者」權限。',
  'You need Contributor access to this page to send orders. Ask the owner to share it with you.': '你需要此頁面的「參與者」權限才能下達指令，請要求擁有者與你分享。',

  // ---- host migration ----
  'The host left': '主機已離開', 'The host left. Moving the game to a new host…': '主機已離開，正在轉移到新主機…',
  'Game resumed with a new host': '遊戲已由新主機接手繼續', 'No one could take over hosting': '沒有玩家能接手主機',
  'You are now hosting this game. A computer took over the old host’s side.': '你現在是這場遊戲的主機，原主機的陣營改由電腦接手。',

  // ---- HUD ----
  'Menu': '選單', 'Cancel': '取消', 'Send': '傳送', 'Message': '訊息', 'All': '全體', 'Team': '隊伍', '[Team]': '[隊伍]',
  'Chat': '聊天', 'Box': '框選', 'Add': '加選', 'Army': '軍隊', 'Idle': '閒置', 'Hero': '英雄', 'Clear': '取消選取', 'Zoom +': '放大', 'Zoom −': '縮小',
  'Sound on': '音效開啟', 'Sound off': '音效關閉',
  'Spectating': '觀戰中', 'Your forces': '你的部隊', 'Spectator': '觀戰者',
  'Tap a unit to select it. Tap the ground, a mine, a tree or an enemy to command. Drag to scroll, pinch to zoom. Use BOX to select many.': '點一下單位即可選取。點地面、金礦、樹木或敵人即可下達指令。拖曳可捲動畫面，雙指縮放。使用「框選」可一次選取多個單位。',
  'Click or drag to select. Right-click to move, attack or gather. Hold Alt to show all health bars.': '點擊或拖曳框選單位。按右鍵可移動、攻擊或採集。按住 Alt 顯示所有生命條。',
  'Neutral': '中立', 'Neutral hostile': '中立敵對', '{name} · Level {n}': '{name} · 等級 {n}', '{n} gold left': '剩餘 {n} 黃金',
  '{a} / {b} mana': '{a} / {b} 法力', 'XP {a} / {b}': '經驗 {a} / {b}', 'Max level': '已達最高等級', 'Rallied': '集結中', 'Frenzied': '狂暴中',
  'Attack {n}': '攻擊 {n}', 'Armor {n}': '護甲 {n}', 'Ranged {n}': '遠程 {n}', 'Melee': '近戰', 'Speed {n}': '速度 {n}',
  'Carrying 10 gold': '攜帶 10 黃金', 'Carrying 10 lumber': '攜帶 10 木材', 'Bounty {n} gold': '賞金 {n} 黃金',
  'Under construction · {n}%': '建造中 · {n}%', '{n} selected': '已選取 {n} 個', '{n} gold': '{n} 黃金', '{n} lumber': '{n} 木材', '{n} food': '{n} 糧食',
  'Group {n} set': '已設定編組 {n}', 'Your hero is reviving': '你的英雄正在復活', 'No idle workers': '沒有閒置的工人', 'Drag to select a group': '拖曳以框選單位',
  'Rally point set': '已設定集結點', 'Choose a gold mine or a tree': '請選擇金礦或樹木', 'Not enough mana': '法力不足',
  'Already at the highest level': '已達最高等級', 'Already researching': '正在研究中',
  'Your base is under attack!': '你的基地正遭受攻擊！', 'Your forces are under attack!': '你的部隊正遭受攻擊！',
  'You are {slot}. Build up and destroy the enemy.': '你是{slot}。發展經濟，摧毀敵人！', 'Watching as a spectator': '以觀戰者身分觀看',
  'Chat works in online games': '聊天僅能在線上對戰中使用', 'Chat needs Contributor access to this page': '聊天需要此頁面的「參與者」權限', 'Message not sent': '訊息未送出',

  // ---- command card ----
  'Move': '移動', 'Stop': '停止', 'Attack': '攻擊', 'Gather': '採集', 'Build': '建造', 'Back': '返回', 'Set rally point': '設定集結點', 'Cancel last in queue': '取消最後一項',
  'Attack a unit, or attack-move to a spot and fight along the way.': '攻擊一個單位，或攻擊移動到某處並沿途作戰。',
  'Mine gold from a mine or chop lumber from trees.': '從金礦開採黃金，或砍伐樹木取得木材。', 'Open the build menu.': '開啟建造選單。', 'New units walk here.': '新單位會走到這裡。',
  'Train {name}': '訓練{name}', 'Research {name}': '研究{name}', 'Weapons fully upgraded': '武器已完全強化', 'Armor fully upgraded': '護甲已完全強化',
  'Damage {n}.': '傷害 {n}。', 'Heals {n}.': '治療 {n}。', '{mana} mana, {cd} s cooldown.': '消耗 {mana} 法力，冷卻 {cd} 秒。', 'Unlocks at hero level {n}.': '英雄等級 {n} 解鎖。',
  '{name} unlocks at hero level {n}': '{name}在英雄等級 {n} 解鎖', '{name} is recharging': '{name}冷卻中',
  'Attack: choose a target or spot': '攻擊：選擇目標或地點', 'Move: choose a destination': '移動：選擇目的地', 'Gather: choose a gold mine or tree': '採集：選擇金礦或樹木',
  'Rally: choose a point': '集結：選擇地點', '{name}: choose a spot': '{name}：選擇施放地點',
  'Place {name} (Shift to place more)': '放置{name}（按住 Shift 可連續放置）', 'Place {name} — tap to position, tap again to build': '放置{name} — 點一下定位，再點一次建造',

  // ---- errors and events ----
  "Can't build there": '無法在此建造', 'Not enough gold': '黃金不足', 'Not enough lumber': '木材不足', 'Not enough food. Build a Farm.': '糧食不足，請建造糧食建築。',
  'Training queue is full': '訓練佇列已滿', 'Cannot do that': '無法執行', '{name} complete': '{name}建造完成', 'Building': '建築', '{name} researched': '{name}研究完成', 'Upgrade': '升級',
  'You have been defeated': '你已被擊敗', '{slot} has been defeated': '{slot}已被擊敗',
  'Victory': '勝利', 'Defeat': '戰敗', 'Game over': '遊戲結束', 'Your enemies have fallen.': '敵人已全數倒下。', 'The battle is decided.': '勝負已分。',
  'Your banners have fallen.': '你的旗幟已倒下。', 'Game time {t}.': '遊戲時間 {t}。', 'Back to title': '返回標題畫面',
  'Ranked: sending the result…': '積分賽：正在送出結果…', 'Ranked: waiting for every player to confirm…': '積分賽：等待所有玩家確認…',
  'Rating {a} → {b} ({d})': '積分 {a} → {b}（{d}）', 'Ranked result not counted.': '本場積分賽結果不計。',
  'The match record does not match this game.': '比賽紀錄與這場遊戲不符。', 'Not every player confirmed the result.': '並非所有玩家都確認了結果。',
  'Players reported different results.': '玩家回報的結果不一致。', 'The ladder rejected this result.': '天梯拒絕了這個結果。', 'Could not read the reports.': '無法讀取回報。',

  // ---- menus ----
  'Paused': '已暫停', 'Resume': '繼續遊戲', 'Leave game': '離開遊戲', 'Online games keep running while this menu is open.': '開啟此選單時，線上遊戲仍會持續進行。',
  'If you leave, another player takes over hosting and a computer plays your side.': '如果你離開，會由其他玩家接手主機，你的陣營改由電腦操控。',
  'Shadows': '陰影', 'Glow and light effects': '光暈與光影效果', 'Resolution': '解析度', 'Interface': '介面', 'Automatic': '自動', 'Desktop': '桌機', 'Tablet': '平板',
  'Scroll at screen edges': '滑鼠移到畫面邊緣時捲動', 'Name for others': '顯示給他人的名稱', 'Your name': '你的名稱',
  'Leave the name empty to show your account name to other players.': '留空則向其他玩家顯示你的帳號名稱。',
  'Music': '音樂', 'Sound effects': '音效', 'Mute all sound': '全部靜音', 'Save': '儲存', 'Got it': '我知道了',
  'Destroy every enemy building. Workers mine gold and chop lumber. Spend it on food buildings, soldiers, towers and Forge upgrades. Your hero levels up from kills; a second ability unlocks at level 3. Neutral monster camps guard the map and pay gold bounties. With fog of war on, you only see what your team can see.':
    '摧毀所有敵方建築即可獲勝。工人負責開採黃金與砍伐木材，資源可用來建造糧食建築、訓練士兵、建造防禦塔及研究鍛造升級。英雄擊殺敵人會升級，等級 3 時解鎖第二個技能。地圖上的中立怪物營地守護著資源，擊敗牠們可獲得黃金賞金。開啟戰爭迷霧時，你只能看到己方隊伍視野內的事物。',
  'Left click / drag': '左鍵點擊／拖曳', 'Select, box select': '選取、框選', 'Shift + click': 'Shift + 點擊', 'Add or remove from selection': '加入或移出選取',
  'Double-click': '連點兩下', 'Select all of that type on screen': '選取畫面上所有同類單位', 'Right click': '右鍵', 'Move, attack, gather, set rally': '移動、攻擊、採集、設定集結點',
  'A then click': '按 A 再點擊', 'Attack-move': '攻擊移動', 'Arrows / screen edge': '方向鍵／畫面邊緣', 'Scroll': '捲動畫面', 'Wheel': '滑鼠滾輪', 'Zoom': '縮放',
  'Ctrl+1–9, 1–9': 'Ctrl+1–9、1–9', 'Control groups': '部隊編組', 'Hero abilities': '英雄技能', 'F1 / Space': 'F1／空白鍵', 'Select hero / center on selection': '選取英雄／畫面移到選取單位',
  'Alt': 'Alt', 'Show all health bars': '顯示所有生命條', 'Enter': 'Enter', 'Chat (online games)': '聊天（線上對戰）',
  'Speaker button': '喇叭按鈕', 'Sound on or off (volumes in Settings)': '開關聲音（音量可在設定中調整）',
  'Tap': '點一下', 'Select a unit, or command the selection': '選取單位，或對已選單位下指令', 'Drag / pinch': '拖曳／雙指縮放', 'Scroll / zoom': '捲動／縮放',
  'Long press': '長按', 'Select all of that type': '選取所有同類單位', 'BOX, then drag': '按「框選」後拖曳', 'Select a group': '框選一群單位',
  'ADD': '加選', 'Tap units to add them': '點單位加入選取', 'Tap to place the outline, tap it again to build': '點一下放置輪廓，再點一次開始建造',
  'Mode': '模式', 'Start': '開始', '1 vs 1 computer': '1 對 1 電腦', '2 vs 2 · you and a computer ally': '2 對 2 · 你與電腦盟友', 'Free-for-all · {n} computers': '混戰 · {n} 個電腦',
  'Pick from the map library': '從地圖庫選擇',

  // ---- ladder and library ----
  'Loading…': '載入中…', 'Ranked matches move ratings. Everyone starts at 1200; a result counts once every player confirms it.': '積分賽會改變積分。每位玩家從 1200 分開始；所有玩家確認後結果才會計入。',
  'Rating': '積分', 'Wins': '勝場', 'Games': '場數', 'No ranked players yet.': '目前還沒有積分賽玩家。', 'Close': '關閉',
  'Map library': '地圖庫', 'Newest': '最新', 'Most played': '最多人玩', 'Search by name': '依名稱搜尋', 'Search maps': '搜尋地圖', 'Use': '使用', 'Delete': '刪除',
  'No maps match.': '找不到符合的地圖。', 'No maps published yet. Publish one from the editor.': '目前還沒有已發布的地圖，可以從編輯器發布一張。',
  '{size}×{size} · {starts} starts · {camps} camps · by {author} · played {plays}×': '{size}×{size} · {starts} 個出生點 · {camps} 個營地 · 作者 {author} · 遊玩 {plays} 次',
  'That map is damaged': '這張地圖已損毀', 'Delete failed': '刪除失敗', 'Could not load the library': '無法載入地圖庫',

  // ---- editor ----
  'New': '新地圖', 'Export': '匯出', 'Import': '匯入', 'Publish': '發布', 'Test vs computer': '與電腦測試', 'Exit': '離開', 'Map name': '地圖名稱',
  'Paint with left drag · pan with right drag or arrow keys · wheel zooms': '左鍵拖曳繪製 · 右鍵拖曳或方向鍵移動 · 滾輪縮放',
  'Terrain': '地形', 'Objects': '物件', 'Start locations': '出生點', 'Monster camps': '怪物營地', 'Brush': '筆刷', 'View': '檢視',
  'Trees': '樹木', 'Clear trees': '清除樹木', 'Gold mine': '金礦', 'Remove mine': '移除金礦', 'Easy camp': '簡單營地', 'Medium camp': '中等營地', 'Hard camp': '困難營地',
  'Remove camp': '移除營地', 'Small': '小', 'Medium': '中', 'Large': '大', 'Pan (touch)': '平移（觸控）',
  '{w} × {h} · {s} starts · {m} mines · {c} camps · {t} trees': '{w} × {h} · {s} 個出生點 · {m} 座金礦 · {c} 個營地 · {t} 棵樹',
  'Gold mines need open ground, away from other mines and starts': '金礦需要放在空地上，並遠離其他金礦與出生點', 'Up to 16 gold mines': '最多 16 座金礦',
  'Camps need open ground, at least 9 tiles from start locations': '營地需要放在空地上，並與出生點相距至少 9 格', 'Up to 24 camps': '最多 24 個營地',
  'Place start {n} first': '請先放置出生點 {n}', 'Start locations need open ground away from mines and other starts': '出生點需要放在空地上，並遠離金礦與其他出生點',
  'Draft kept': '已保留草稿', 'New map': '新地圖', 'Untitled': '未命名',
  'Saved “{name}”. Pick it in the lobby or vs computer.': '已儲存「{name}」，可在大廳或電腦對戰中選用。', 'This browser blocked saving. Use Export to keep a copy.': '此瀏覽器封鎖了儲存，請使用「匯出」保留副本。',
  'Open map': '開啟地圖', 'Ashvale Crossing (built in)': '灰谷十字路口（內建）', 'Export map': '匯出地圖', 'Map code': '地圖代碼', 'Copy': '複製',
  'Send this code to a friend; they can paste it into Import.': '把這段代碼傳給朋友，他們可以貼到「匯入」中。', 'Import map': '匯入地圖', 'Load': '載入',
  'Paste a map code (starts with A1|)': '貼上地圖代碼（以 A1| 或 A2| 開頭）', "That map code isn't valid": '這段地圖代碼無效',
  'Publish to the map library': '發布到地圖庫', '“{name}” will be visible to everyone who signs in on this site, with your name as the author.': '所有在本網站登入的人都能看到「{name}」，作者會顯示你的名稱。',
  'Published': '已發布', 'Publishing failed': '發布失敗', 'Place at least 2 start locations.': '請至少放置 2 個出生點。', 'Place at least 1 gold mine.': '請至少放置 1 座金礦。',

  // ---- world: factions, colours, tiles, map ----
  'Ashvale Crown': '灰谷王國', 'Thornwild Clans': '荊野部族', 'Red': '紅方', 'Blue': '藍方', 'Teal': '青方', 'Violet': '紫方',
  'Grass': '草地', 'Dirt': '泥土', 'Cobble': '石板路', 'Water': '水域', 'Rock': '岩石', 'Ashvale Crossing': '灰谷十字路口',

  // ---- units and buildings ----
  'Town Hall': '城鎮大廳', 'Barracks': '兵營', 'Farm': '農場', 'Guard Tower': '守衛塔', 'Forge': '鍛造廠',
  'Worker': '工人', 'Footman': '步兵', 'Archer': '弓箭手',
  'Great Lodge': '大長屋', 'War Camp': '戰營', 'Burrow': '地穴', 'Thorn Spire': '荊棘尖塔', 'Bonecraft Hut': '骨匠小屋',
  'Gatherer': '採集者', 'Brute': '蠻兵', 'Spearthrower': '擲矛手', 'Gold Mine': '金礦',
  'Warden': '守望騎士', 'Lumen Sage': '光明賢者', 'Bloodreaver': '嗜血劫掠者', 'Thornseer': '荊棘先知',
  'Ashwolf': '灰燼狼', 'Hollow Hexer': '空洞咒術師', 'Stonehide': '石膚巨獸', 'Spirit Wolf': '靈狼',
  'Weapons I': '武器強化 I', 'Weapons II': '武器強化 II', 'Armor I': '護甲強化 I', 'Armor II': '護甲強化 II',
  'Trains workers. Workers drop gold and lumber here. +10 food.': '訓練工人。工人在此繳交黃金與木材。糧食上限 +10。',
  'Trains Footmen and Archers.': '訓練步兵與弓箭手。', 'Raises your food limit by 6.': '糧食上限 +6。', 'Shoots nearby enemies.': '射擊附近的敵人。',
  'Researches weapon and armor upgrades for soldiers.': '為士兵研究武器與護甲升級。', 'Gathers gold and lumber, and builds.': '採集黃金與木材，並負責建造。',
  'Sturdy melee soldier.': '堅韌的近戰士兵。', 'Ranged attacker.': '遠程攻擊單位。',
  'Trains gatherers. Resources are dropped here. +10 food.': '訓練採集者。資源在此繳交。糧食上限 +10。', 'Trains Brutes and Spearthrowers.': '訓練蠻兵與擲矛手。',
  'Raises your food limit by 7.': '糧食上限 +7。', 'Hurls thorns at nearby enemies.': '向附近的敵人投射荊棘。',
  'Researches weapon and armor upgrades for warriors.': '為戰士研究武器與護甲升級。', 'Tough melee warrior with a heavy club.': '手持重棍的強悍近戰戰士。',
  'Throws spears from range.': '從遠處投擲長矛。', 'Send workers here to mine gold.': '派工人來此開採黃金。',
  'Armored champion of the Crown.': '王國的重裝勇士。', 'Healer and caster of the Crown.': '王國的治療者與施法者。',
  'Axe-wielding warlord of the clans.': '揮舞雙斧的部族戰爭領主。', 'Shaman who commands brambles and spirits.': '操控荊棘與靈體的薩滿。',
  'Summoned. Fades after a while.': '召喚單位，一段時間後消散。',
  '+2 attack for your soldiers.': '士兵攻擊力 +2。', '+2 more attack for your soldiers.': '士兵攻擊力再 +2。', '+2 armor for your soldiers.': '士兵護甲 +2。', '+2 more armor for your soldiers.': '士兵護甲再 +2。',

  // ---- abilities ----
  'Stormclap': '雷霆震擊', 'Rallying Cry': '集結戰吼', 'Mend': '治癒之光', 'Sunburst': '日光爆發', 'Whirling Axes': '旋風斧', 'Frenzy': '狂暴', 'Bramble Snare': '荊棘纏繞', 'Spirit Wolves': '召喚靈狼',
  'Damages nearby enemies and slows them for 3 s.': '對附近敵人造成傷害，並使其減速 3 秒。',
  'Nearby allies deal 25% more damage and gain 3 armor for 10 s.': '附近友軍 10 秒內傷害提高 25%，護甲 +3。',
  'Heals the Sage and nearby allied units.': '治療賢者與附近的友方單位。', 'Calls down light on a spot, damaging enemies there.': '在指定地點降下光芒，傷害該處的敵人。',
  'Spins and strikes every enemy nearby.': '旋轉攻擊附近所有敵人。', '60% faster attacks and 20% faster movement for 8 s.': '8 秒內攻擊速度提高 60%，移動速度提高 20%。',
  'Roots enemies in an area in place for 3 s.': '將區域內的敵人定身 3 秒。', 'Summons two spirit wolves for 35 s.': '召喚兩隻靈狼，持續 35 秒。',
};
