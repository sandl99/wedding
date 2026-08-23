import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the wedding invitation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Lâm San &amp; Thu Trang — Thiệp cưới<\/title>/i);
  assert.match(html, /src="\/mirror\/index\.html"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("a Base64 URL suffix personalizes the invitation iframe", async () => {
  const guestName = "Nguyễn Văn An";
  const token = Buffer.from(guestName, "utf8").toString("base64url");
  const response = await render(`/${token}`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, new RegExp(`/mirror/index\\.html\\?guest=${encodeURIComponent(guestName)}`));
  assert.match(html, /Thiệp cưới gửi Nguyễn Văn An/);
});

test("local wishes create the ignored project CSV file when missing", async () => {
  const viteConfig = await fs.readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.match(viteConfig, /data["'], ["']wishes\.csv/);
  assert.match(viteConfig, /const wishesCsvHeader = "id,name,message,created_at\\n"/);
  assert.match(viteConfig, /async function ensureWishesCsv\(\)/);
  assert.match(viteConfig, /fs\.mkdir\(path\.dirname\(wishesCsvPath\), \{ recursive: true \}\)/);
  assert.match(viteConfig, /fs\.access\(wishesCsvPath\)/);
  assert.match(viteConfig, /fs\.writeFile\(wishesCsvPath, wishesCsvHeader, "utf8"\)/);
  assert.match(viteConfig, /fs\.appendFile\(wishesCsvPath/);
  assert.match(viteConfig, /name: "local-csv-wishes"/);
});

test("the mirrored invitation contains the requested sections and local assets", async () => {
  const mirrorUrl = new URL("../public/mirror/index.html", import.meta.url);
  const html = await fs.readFile(mirrorUrl, "utf8");

  assert.match(html, /THƯ MỜI CƯỚI/);
  assert.match(html, /#gate \[data-node-id="8xyuneo6iv"\] \{ left:10px!important; width:360px!important; text-align:center!important; \}/);
  assert.match(html, /Chạm để mở phong bì/);
  assert.match(html, /TRÂN TRỌNG KÍNH MỜI/);
  assert.match(html, /Đến dự buổi tiệc chung vui cùng gia đình chúng tôi/);
  assert.match(html, /@font-face \{ font-family:"Fz-Photograph\.ttf"/);
  assert.match(html, /data-node-id="sFbBuUpl0w"/);
  assert.match(html, /data-node-id="64rwt0Xui_"/);
  assert.match(html, /data-node-id="UE9pXAyPOC"/);
  assert.match(html, /new URLSearchParams\(window\.location\.search\)\.get\('guest'\)/);
  assert.match(html, /envelopeGuest\.textContent = guestName/);
  assert.match(html, /invitationGuest\.textContent = guestName/);
  assert.match(html, /data-node-id="orgfEFVujv"/);
  assert.match(html, /data-node-id="WF7EqqB5Pb"/);
  assert.doesNotMatch(html, /mirror-monogram/);
  assert.match(html, /#invitation \[data-node-id="cfIwsLHte3"\] \{ display:none!important/);
  assert.match(html, /#invitation \[data-node-id="64rwt0Xui_"\] \{ top:70px!important/);
  assert.match(html, />Lâm San<\/span>/);
  assert.match(html, />và<\/span>/);
  assert.match(html, />Thu Trang<\/span>/);
  assert.match(html, /Lễ Thành hôn được tổ chức vào ngày/);
  assert.match(html, /Lúc 11:00, Thứ Tư/);
  assert.match(html, /na01-date-part">30/);
  assert.match(html, /na01-date-part">09/);
  assert.match(html, /na01-date-year">2026/);
  assert.match(html, /na01-date-divider/);
  assert.match(html, /grid-template-columns:1fr 2px 1fr 2px 1fr;[^}]*column-gap:10px/);
  assert.match(html, /Sự hiện diện của quý khách là niềm vinh dự của gia đình chúng mình/);
  assert.doesNotMatch(html, /Hôn lễ được tổ chức vào lúc/i);
  assert.match(html, /data-node-id="6UaiRGcX3i"\], #invitation \[data-node-id="oSwXoiYKve"\], #invitation \[data-node-id="nIkhLt1nK3"\] \{ display:none!important/);
  assert.doesNotMatch(html, />Quang Huy<|>Mỹ\s+Linh</);
  assert.doesNotMatch(html, />Minh<\/span>|>Lan<\/span>|Minh &amp; Lan/);
  assert.match(html, /#invitation \[data-node-id="64rwt0Xui_"\] \{ top:70px!important; color:rgb\(146,131,98\)!important; font:22px\/1\.5 Philosopher/);
  assert.match(html, /#invitation \[data-node-id="UE9pXAyPOC"\] \{ top:112px!important; color:rgb\(160,123,123\)!important; font:30px\/1\.5 "Fz-Photograph\.ttf"/);
  assert.match(html, /#invitation \[data-node-id="orgfEFVujv"\] \{ top:206px!important; color:rgb\(146,131,98\)!important; font:50px\/1\.32 "Fz-Photograph\.ttf"/);
  assert.match(html, /#invitation \[data-node-id="PlsVrCAkz1"\] \{ top:303px!important; color:rgb\(146,131,98\)!important; font:50px\/1\.32 "Fz-Photograph\.ttf"/);
  assert.match(html, /#invitation \[data-node-id="t2OQVTOIuw"\] \{ top:393px!important;[^}]*font:18px\/1\.5 Philosopher/);
  assert.match(html, /#invitation \[data-node-id="WF7EqqB5Pb"\] \{ top:459px!important;[^}]*font:40px\/1\.5 Philosopher/);
  assert.match(html, /data-na01-enter="left"/);
  assert.match(html, /data-na01-enter="right"/);
  assert.match(html, /data-na01-enter="zoom"/);
  assert.match(html, /duration:2800/);
  assert.match(html, /easing:'cubic-bezier\(\.22,1,\.36,1\)'/);
  assert.match(html, /translateX\(-100px\)/);
  assert.match(html, /translateX\(100px\)/);
  assert.match(html, /gate-stage gate-closed-state/);
  assert.match(html, /@keyframes closedEnvelopeOpen/);
  assert.doesNotMatch(html, /gate-open-state|openedEnvelopeIn|invitationCardRise|a4WGJg9RAq/);
  assert.match(html, /gate\.classList\.add\('opening'\)/);
  assert.match(html, /gate\.classList\.add\('leaving'\)/);
  assert.match(html, /rel="preload" href="\/uploads\/lam-san-thu-trang-hero\.jpg" as="image" fetchpriority="high"/);
  assert.match(html, /src="\/uploads\/lam-san-thu-trang-hero\.jpg"/);
  assert.match(html, /alt="Lâm San và Thu Trang trong ngày cưới"/);
  assert.match(html, /#hero \[data-node-id="m5gLp11rTP"\] img \{[^}]*object-fit:cover!important/);
  assert.match(html, /object-position:right 42%!important; transform:translateX\(-40px\) scale\(1\.08\)!important/);
  assert.match(html, /@font-face \{ font-family:"UTM ViceroyJF\.ttf"/);
  assert.match(html, /@font-face \{ font-family:"Fz-MyEverything\.ttf"/);
  assert.match(html, /const crossfadeDelay = reduceMotion \? 0 : 260/);
  assert.match(html, /event\.animationName === 'gateToMain'/);
  assert.match(html, /scheduleAutoScroll\(\)/);
  assert.doesNotMatch(html, /const removeDelay/);
  assert.doesNotMatch(html, /id="countdown"/);
  assert.match(html, /id="calendar" data-section="calendar"/);
  assert.match(html, /Lịch cưới chúng mình!/);
  assert.match(html, /mirror-calendar-na02/);
  assert.match(html, /Tháng 09 \/ 2026/);
  assert.match(html, /mirror-calendar-day is-highlight is-eve">29</);
  assert.match(html, /mirror-calendar-day is-highlight is-wedding">30</);
  assert.match(html, /Beautiful/);
  assert.match(html, /Sự Kiện Cưới|Sự kiện cưới/i);
  assert.match(html, /id="wishes" data-section="wishes"/);
  assert.match(html, /data-node-id="jZoSO-0vz3"/);
  assert.match(html, /id="wish-form"/);
  assert.match(html, /id="wish-list"/);
  assert.match(html, /Tên của bạn \*/);
  assert.match(html, /Lời chúc của bạn \*/);
  assert.match(html, /fetch\('\/api\/wishes'/);
  assert.match(html, /method:'POST'/);
  assert.match(html, /createWishElement/);
  assert.match(html, /Only You/);
  assert.match(html, /\/uploads\/only-you-from-78s\.mp3/);
  assert.doesNotMatch(html, /Một Đời/);
  assert.doesNotMatch(html, /quick-menu|menu-button|Mở mục lục|>☰</);
  assert.match(html, /class="na01-music-control"/);
  assert.match(html, /\.na01-music-control \{[^}]*left:max\(15px,calc\(\(100vw - 480px\)\/2 \+ 15px\)\)[^}]*width:50px[^}]*animation:na01MusicSpin 4s linear infinite,na01MusicPulse 2s ease-in-out infinite/);
  assert.match(html, /id="music-button-icon" src="\/mirror\/assets\/[^"]+\.png"/);
  assert.match(html, /const musicPauseIcon = '\/mirror\/assets\/[^"]+\.jpg'/);
  assert.match(html, /const AUTO_SCROLL_SPEED_PX_PER_SECOND = 44/);
  assert.match(html, /const AUTO_SCROLL_START_DELAY_MS = 650/);
  assert.doesNotMatch(html, /AUTO_SCROLL_TICK_MS|setInterval\(\(\) => autoScrollStep/);
  assert.match(html, /autoScrollFrame = window\.requestAnimationFrame\(autoScrollStep\)/);
  assert.match(html, /cancelAnimationFrame\(autoScrollFrame\)/);
  assert.match(html, /window\.scrollTo\(0, autoScrollPosition\)/);
  assert.match(html, /document\.documentElement\.style\.scrollBehavior = 'auto'/);
  assert.match(html, /\['touchstart','wheel','pointerdown','keydown'\]/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /window\.addEventListener\('pagehide', handlePageExit/);
  assert.match(html, /window\.addEventListener\('beforeunload', handlePageExit/);
  assert.match(html, /document\.addEventListener\('freeze', handlePageExit/);
  assert.match(html, /FBAN\|FBAV\|FB_IAB\|Messenger\|Instagram/);
  assert.match(html, /pauseMusic\(true\)/);
  assert.match(html, /30\.09\.2026/);
  assert.match(html, /Tức ngày 19\/8 năm Bính Ngọ/);
  assert.match(html, /Nhà hàng Sông Lam Palace/);
  assert.match(html, /421 đường Phạm Nguyễn Du, phường Cửa Lò, tỉnh Nghệ An/);
  assert.match(html, /Ông Đặng Văn Trịnh<br>Bà Hoàng Thị Nhung/);
  assert.match(html, /Ông Nguyễn Văn Trinh<br>Bà Võ Thị Thanh An/);
  assert.doesNotMatch(html, /08\.11\.2026|08\/11\/2026|Nhà vườn An Nhiên|Trần Phú, Hội An/);
  assert.doesNotMatch(html, /id="(?:portrait|love|story|rsvp)"/);
  assert.doesNotMatch(html, /Fistmarried|all of me|all of you|Our love story/i);
  assert.doesNotMatch(html, /Đám cưới sẽ trọn vẹn và ý nghĩa hơn/);
  assert.doesNotMatch(html, /Xác [Nn]hận [Tt]ham [Dd]ự/);
  assert.doesNotMatch(html, /wish-modal/);
  assert.doesNotMatch(html, /https:\/\/na0[12]-vip\.mehappy\.info/);
  assert.doesNotMatch(html, /https:\/\/s3-hcm-r2\.s3cloud\.vn/);

  const localAssets = [...html.matchAll(/src="(\/mirror\/assets\/[^"?]+)"/g)].map((match) => match[1]);
  assert.ok(localAssets.length >= 20);
  for (const asset of new Set(localAssets)) {
    const assetUrl = new URL(`../public${asset}`, import.meta.url);
    await fs.access(assetUrl);
  }
  await fs.access(new URL("../public/uploads/lam-san-thu-trang-hero.jpg", import.meta.url));
});
