import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function fetchWorker(pathname = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render(pathname = "/") {
  return fetchWorker(pathname, { headers: { accept: "text/html" } });
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

test("production wishes API creates and updates the local CSV", async (context) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wedding-wishes-"));
  const csvPath = path.join(temporaryDirectory, "data", "wishes.csv");
  process.env.WISHES_CSV_PATH = csvPath;
  context.after(async () => {
    delete process.env.WISHES_CSV_PATH;
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  const emptyResponse = await fetchWorker("/api/wishes", {
    headers: { accept: "application/json" },
  });
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), { wishes: [] });
  assert.equal(await fs.readFile(csvPath, "utf8"), "id,name,message,created_at\n");

  const createResponse = await fetchWorker("/api/wishes", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name: " San  ", message: " Trăm năm  hạnh phúc! " }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.wish.id, 1);
  assert.equal(created.wish.name, "San");
  assert.equal(created.wish.message, "Trăm năm hạnh phúc!");

  const listResponse = await fetchWorker("/api/wishes", {
    headers: { accept: "application/json" },
  });
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.wishes.length, 1);
  assert.deepEqual(listed.wishes[0], created.wish);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /^id,name,message,created_at\n"1","San","Trăm năm hạnh phúc!","[^"]+"\n$/);
});

test("the link preview points at the couple's own card", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /<meta property="og:image" content="[^"]*\/og\.jpg">/);
  assert.match(html, /<meta property="og:image:width" content="1731">/);
  assert.match(html, /<meta property="og:image:height" content="909">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  // The venue is Cửa Lò; the template's description said Hội An.
  assert.match(html, /Nhà hàng Sông Lam Palace, Cửa Lò, Nghệ An/);
  assert.doesNotMatch(html, /Hội An/);
  assert.doesNotMatch(html, /og\.png/);

  await fs.access(new URL("../public/og.jpg", import.meta.url));
  await assert.rejects(fs.access(new URL("../public/og.png", import.meta.url)));
});

test("the English invitation is served at /en and stays in step with the Vietnamese", async () => {
  const root = await render("/en");
  assert.equal(root.status, 200);
  const rootHtml = await root.text();
  assert.match(rootHtml, /src="\/mirror\/en\/index\.html"/);
  assert.match(rootHtml, /<title>Lâm San &amp; Thu Trang — Wedding Invitation<\/title>/);

  const guestName = "Nguyễn Văn An";
  const token = Buffer.from(guestName, "utf8").toString("base64url");
  const guest = await render(`/en/${token}`);
  assert.equal(guest.status, 200);
  const guestHtml = await guest.text();
  assert.match(guestHtml, new RegExp(`/mirror/en/index\\.html\\?guest=${encodeURIComponent(guestName)}`));
  assert.match(guestHtml, /Wedding invitation for Nguyễn Văn An/);

  const en = await fs.readFile(new URL("../public/mirror/en/index.html", import.meta.url), "utf8");
  assert.match(en, /<html lang="en">/);
  for (const phrase of [
    "WEDDING INVITATION", "CORDIALLY INVITE", "to join the celebration with our families",
    "Our wedding ceremony will be held on", "At 10:45 AM, Wednesday",
    "Engagement Ceremony", "Wedding Ceremony", "Wedding Events",
    "11:00 AM, Tuesday 29 September 2026", "10:45 AM, Wednesday 30 September 2026",
    "Song Lam Palace Restaurant", "Bride&#39;s family home", "Send your wishes",
    "View map", "Tap a photo to view it larger", "Your presence is an honour for our family",
  ]) {
    assert.ok(en.includes(phrase), `English card is missing: ${phrase}`);
  }
  // Nothing Vietnamese should survive except the couple's and families' names.
  for (const phrase of [
    "Xem bản đồ", "Gửi lời chúc", "Khoảnh khắc", "Lễ Nạp Tài", "Lễ Thành Hôn", "Sự Kiện Cưới",
    "Chạm để mở", "Quý Khách", "Nhà Trai", "Nhà Gái", "lời chúc", "phóng lớn", "Album cưới",
    "Chỉ đường", "Tư gia", "Thiệp cưới", "Đang tải",
  ]) {
    assert.ok(!en.includes(phrase), `English card still contains: ${phrase}`);
  }
  // The lunar date is dropped for English readers but kept in Vietnamese.
  const vi = await fs.readFile(new URL("../public/mirror/index.html", import.meta.url), "utf8");
  assert.ok(!en.includes("Bính Ngọ"));
  assert.ok(vi.includes("Bính Ngọ"));

  // Each card links to the other language, carrying the guest token.
  assert.match(vi, /id="lang-switch"[^>]*hreflang="en">English<\/a>/);
  assert.match(en, /id="lang-switch"[^>]*hreflang="vi">Tiếng Việt<\/a>/);
  for (const card of [vi, en]) {
    assert.match(card, /const isEnglish = path === '\/en' \|\| path\.startsWith\('\/en\/'\)/);
    assert.match(card, /langSwitch\.href = isEnglish \? \(path\.slice\(3\) \|\| '\/'\) : \('\/en' \+ \(path === '\/' \? '' : path\)\)/);
  }
  // English runs longer than Vietnamese; these boxes needed retuning.
  for (const phrase of ["Countdown", ">The Big Day</h2>", "<span>Days</span>", "<span>Hours</span>",
                        "<span>Minutes</span>", "<span>Seconds</span>",
                        "10:45 AM · Wednesday · 30 September 2026", "Today is the big day!"]) {
    assert.ok(en.includes(phrase), `English countdown is missing: ${phrase}`);
  }
  assert.ok(!en.includes("Ngày trọng đại") && !en.includes("<span>Giây</span>"));
  assert.match(en, /English-only layout corrections/);
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
  assert.match(html, /Lúc 10:45, Thứ Tư/);

  // Landing photo is chosen at random from five shots on each visit.
  assert.match(html, /window\.__heroPhotos = \["\/uploads\/hero-KOA_7920\.webp"(,"\/uploads\/hero-KOA_\d+\.webp"){4}\]/);
  assert.match(html, /window\.__heroPhoto = window\.__heroPhotos\[Math\.floor\(Math\.random\(\) \* window\.__heroPhotos\.length\)\]/);
  assert.match(html, /<img id="hero-photo"(?![^>]*\ssrc=)/);
  assert.match(html, /document\.getElementById\("hero-photo"\)\.src = window\.__heroPhoto/);
  assert.doesNotMatch(html, /lam-san-thu-trang-hero\.jpg/);
  assert.doesNotMatch(html, /Save the date/i);
  // Hero carries only the names now; the date lives in the envelope and the letter.
  assert.doesNotMatch(html, /data-node-id="(aY30A0HdPl|tnX45_TaYG)"/);
  assert.match(html, /src="\/uploads\/thanks-KOA_8013\.webp"/);
  // Thank you, after mehappy template 7: script word, message, then the names.
  assert.match(html, /class="thanks-shell"/);
  assert.match(html, /<p class="thanks-script[^"]*"[^>]*>Thank you!<\/p>/);
  assert.match(html, /<p class="thanks-note[^"]*"[^>]*>Sự hiện diện của quý khách là niềm vinh hạnh cho gia đình chúng tôi<\/p>/);
  assert.doesNotMatch(html, /Cảm ơn Quý khách đã dành tình cảm|món quà ý nghĩa nhất/);
  assert.doesNotMatch(html, /thanks-names/);
  assert.match(html, /\.thanks-script \{[^}]*52px\/1\.15 "Fz-Photograph\.ttf"/);
  // The section is exactly the photo: no forced height, nothing cropped.
  assert.match(html, /\.thanks-shell \{ position:relative; overflow:hidden; \}/);
  assert.match(html, /\.thanks-photo \{ display:block; width:100%; height:auto; \}/);
  assert.match(html, /\.thanks-body \{ position:absolute; z-index:2; inset:0;[^}]*justify-content:center;[^}]*transform:translateY\(26px\); \}/);
  // A cream section revealing with translateY left a strip of white shell above it.
  assert.match(html, /#album, #thanks \{ transform:none; \}/);
  assert.match(html, /#album \.album-shell, #thanks \.thanks-shell \{ transform:translateY\(24px\)/);
  assert.match(html, /#album\.is-visible \.album-shell, #thanks\.is-visible \.thanks-shell \{ transform:none; \}/);
  assert.doesNotMatch(html, /\.thanks-shell \{[^}]*min-height/);
  assert.doesNotMatch(html, /ofyUvfIiIG|YN9Yog1AwS|CbotDpkgUD/);
  assert.match(html, /src="\/uploads\/event-nap-tai-KOA_8295\.webp"/);
  assert.match(html, /src="\/uploads\/event-thanh-hon-KOA_8578\.webp"/);
  // "Lịch cưới chúng mình" section removed.
  assert.doesNotMatch(html, /Lịch cưới chúng mình|id="calendar"|mirror-calendar/);
  assert.match(html, /na01-date-part">30/);
  assert.match(html, /na01-date-part">09/);
  assert.match(html, /na01-date-year">2026/);
  assert.match(html, /na01-date-divider/);
  assert.match(html, /grid-template-columns:1fr 2px 1fr 2px 1fr;[^}]*column-gap:10px/);
  assert.match(html, /Sự hiện diện của quý khách là niềm vinh dự của gia đình chúng mình/);

  // Sự Kiện Cưới now lists two events: Lễ Nạp Tài (29/09) then Lễ Thành Hôn (30/09).
  assert.match(html, />Lễ Nạp Tài<\/span>/);
  assert.match(html, /11h00 Thứ 3, ngày 29\/09\/2026/);
  assert.match(html, /Số 194, đường Sào Nam, Nghi Thu 2, phường Cửa Lò, Nghệ An/);
  assert.match(html, />Lễ Thành Hôn<\/span>/);
  assert.match(html, /10h45 Thứ 4, ngày 30\/09\/2026/);
  assert.doesNotMatch(html, /Tiệc Trà Nhà (Trai|Gái)/);
  assert.doesNotMatch(html, /Tư gia nhà Trai|Nhuệ Giang, Đào Dương/);
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
  // The chosen landing photo is preloaded at runtime, not from static markup.
  assert.match(html, /link\.rel = "preload"; link\.as = "image";/);
  assert.match(html, /link\.href = window\.__heroPhoto; link\.fetchPriority = "high"/);
  assert.match(html, /alt="Lâm San và Thu Trang trong ngày cưới"/);
  assert.match(html, /#hero \[data-node-id="m5gLp11rTP"\] img \{[^}]*object-fit:cover!important; object-position:center 38%!important/);
  assert.match(html, /@font-face \{ font-family:"UTM ViceroyJF\.ttf"/);
  assert.match(html, /@font-face \{ font-family:"Fz-MyEverything\.ttf"/);
  assert.match(html, /const crossfadeDelay = reduceMotion \? 0 : 260/);
  assert.match(html, /event\.animationName === 'gateToMain'/);
  assert.match(html, /scheduleAutoScroll\(\)/);
  assert.doesNotMatch(html, /const removeDelay/);
  // Album: two columns of raw photos; the three landscape frames span both.
  // Countdown sits between the letter and the album.
  assert.match(html, /id="countdown" data-section="countdown"/);
  assert.ok(html.indexOf('id="countdown"') > html.indexOf('id="invitation"'));
  assert.ok(html.indexOf('id="countdown"') < html.indexOf('id="album"'));
  assert.equal([...html.matchAll(/<b data-cd="(days|hours|minutes|seconds)">/g)].length, 4);
  for (const label of ["Ngày", "Giờ", "Phút", "Giây"]) {
    assert.ok(html.includes(`<span>${label}</span>`), `countdown is missing ${label}`);
  }
  assert.match(html, /10:45 · Thứ Tư · 30\.09\.2026/);
  // An absolute instant, so guests abroad count to the real moment.
  assert.match(html, /const CEREMONY_AT = Date\.parse\('2026-09-30T10:45:00\+07:00'\)/);
  assert.match(html, /setInterval\(drawCountdown, 1000\)/);
  assert.match(html, /document\.hidden \? stopCountdown\(\) : startCountdown\(\)/);
  assert.match(html, /Hôm nay là ngày trọng đại!/);
  // The dividers reuse the letter's gold rule so both date treatments match.
  assert.match(html, /\.cd-sep \{[^}]*background:rgb\(146,131,98\)/);
  // Eyebrow and title share one face and size, so they read as a single heading.
  const cdFont = /font:400 34px\/1\.35 "Dancing Script",cursive;/;
  assert.match(html.match(/\.cd-eyebrow \{[^}]*\}/)[0], cdFont);
  assert.match(html.match(/\.cd-title \{[^}]*\}/)[0], cdFont);
  assert.match(html, /\.cd-when \{[^}]*font:14px\/1\.5 Philosopher/);

  // Album tiles must not animate before their photo has decoded, and page one
  // must be left to the observer or it would appear without animating at all.
  assert.match(html, /function revealTile\(tile, position\)/);
  assert.match(html, /photo\.addEventListener\('load', show, \{ once: true \}\)/);
  assert.match(html, /photo\.addEventListener\('error', show, \{ once: true \}\)/);
  assert.match(html, /tiles\.forEach\(\(tile, position\) => revealTile\(tile, position\)\)/);
  assert.match(html, /showPage\(1, \{ animate: false, reveal: false \}\)/);
  assert.match(html, /if \(!reveal\) return;/);
  assert.match(html, /\.na01-date-divider \{ width:2px;[^}]*background:rgb\(146,131,98\); \}/);

  assert.match(html, /id="album" data-section="album"/);
  assert.match(html, />Khoảnh khắc<\/h2>/);
  assert.match(html, /40 khoảnh khắc của chúng mình/);
  assert.match(html, /Chạm vào ảnh để xem lớn hơn/);
  assert.doesNotMatch(html, /Từng tấm ảnh|album-note/);
  // Two-column mosaic of mixed shapes, after mehappy template 8, paginated 10 a page.
  const tiles = [...html.matchAll(/class="album-tile (ratio-\w+)(?: is-off)?" data-page-group="(\d)"/g)]
    .map((m) => ({ shape: m[1], page: Number(m[2]) }));
  assert.equal(tiles.length, 40);
  assert.equal(tiles.filter((t) => t.shape === "ratio-wide").length, 3);
  for (let page = 1; page <= 4; page += 1) {
    assert.equal(tiles.filter((t) => t.page === page).length, 10, `page ${page} holds 10 photos`);
  }
  // Only page one is in flow at first paint.
  assert.equal([...html.matchAll(/class="album-tile ratio-\w+ is-off"/g)].length, 30);

  // Page one is the requested set, in a shuffled order rather than numeric.
  const pageOne = [...html.matchAll(/data-photo="([^"]+)"[^]*?data-page-group/g)];
  const grouped = [...html.matchAll(/data-page-group="(\d)"[^]*?data-photo="([^"]+)"/g)];
  const firstTen = [...html.matchAll(/<figure class="album-tile [^"]*" data-page-group="1">.*?data-photo="([^"]+)"/g)]
    .map((m) => m[1]);
  assert.deepEqual([...firstTen].sort(), [
    "KOA_7798", "KOA_7882", "KOA_7926", "KOA_7942", "KOA_7962",
    "KOA_8295", "KOA_8303", "KOA_8340", "KOA_8451", "KOA_8544",
  ]);
  assert.notDeepEqual(firstTen, [...firstTen].sort(), "page one is shuffled, not numeric");

  // Pager: prev, four numbered pages, next, and a range counter.
  assert.equal([...html.matchAll(/class="album-page-btn" data-goto="\d"/g)].length, 4);
  assert.match(html, /<button type="button" class="album-page-btn" data-goto="1" aria-current="page">1<\/button>/);
  assert.match(html, /id="album-prev"/);
  assert.match(html, /id="album-next"/);
  assert.match(html, /<p class="album-count" id="album-count">1–10 của 40 ảnh<\/p>/);
  assert.match(html, /const PAGE_SIZE = 10;/);
  // Switching pages replays the cascade rather than showing the set flat.
  assert.match(html, /void albumGrid\.offsetWidth;/);
  assert.match(html, /\.album-tile\.is-off \{ display:none; \}/);
  assert.match(html, /\.album-grid \{ columns:2; column-gap:10px; padding:0 30px; \}/);
  assert.match(html, /\.album-tile \{ position:relative; margin:0 0 10px; break-inside:avoid; \}/);
  assert.match(html, /\.album-tile\.ratio-tall \.album-open \{ aspect-ratio:2 \/ 3; \}/);
  assert.doesNotMatch(html, /is-wide/);
  // Rounded edges, in the spirit of linhntt.tanhm.org.
  assert.match(html, /\.album-open \{[^}]*border-radius:14px/);
  assert.match(html, /\.lightbox img \{ max-width:min\(100%,860px\)[^}]*border-radius:14px/);
  // 96vw ignored the overlay padding and pushed the zoomed photo off-centre.
  assert.doesNotMatch(html, /96vw/);
  // Reveal is armed from script so a failed observer leaves photos visible.
  assert.match(html, /albumGrid\.setAttribute\('data-reveal', ''\)/);
  // Reveal mirrors the reference: pop from scale(.8) over .6s, cascading 100ms.
  assert.match(html, /\.album-grid\[data-reveal\] \.album-tile \{ opacity:0; transform:scale\(\.8\);/);
  assert.match(html, /transition:opacity \.6s ease-out, transform \.6s ease-out;/);
  assert.match(html, /\.album-grid\[data-reveal\] \{ opacity:0; transition:opacity \.8s ease \.2s; \}/);
  assert.match(html, /const STAGGER_MS = 100;/);
  assert.match(html, /const MAX_STAGGER_STEPS = 5;/);
  assert.match(html, /\.album-open:hover \{ transform:scale\(1\.05\)/);
  assert.match(html, /\.album-open:active \{ transform:scale\(\.95\); \}/);
  assert.match(html, /\.album-open:hover img \{ transform:scale\(1\.1\); \}/);
  assert.equal([...html.matchAll(/<span class="album-veil"><span>Xem ảnh<\/span><\/span>/g)].length, 40);
  // The script face needs a line box tall enough for its glyphs.
  assert.match(html, /\.album-title \{[^}]*56px\/1\.92 "Fz-MyEverything\.ttf"/);
  assert.match(html, /class="lightbox-nav lightbox-prev"/);
  assert.match(html, /class="lightbox-nav lightbox-next"/);
  assert.match(html, /'\/uploads\/gal-' \+ albumPhotos\[albumIndex\] \+ '-lg\.webp'/);
  // The modal must sit above the floating music control (z-index 9999).
  assert.match(html, /\.overlay \{ position:fixed; inset:0; z-index:10000;/);
  assert.doesNotMatch(html, /Beautiful chapter|XEM THÊM|album-stack|album-swipe|Vuốt để lật trang|class="album-page[ "]|uploads\/album-/);
  assert.match(html, /Sự Kiện Cưới|Sự kiện cưới/i);
  assert.match(html, /id="wishes" data-section="wishes"/);
  assert.match(html, /data-node-id="jZoSO-0vz3"/);
  assert.match(html, /id="wish-form"/);
  assert.match(html, /id="wish-list"/);
  assert.match(html, /Tên của bạn \*/);
  assert.match(html, /Lời chúc của bạn \*/);
  assert.match(html, /fetch\('\/api\/wishes'/);

  // "Xem bản đồ" used to be a div with no link at all.
  assert.equal([...html.matchAll(/class="mirror-map-link"/g)].length, 2);
  assert.match(html, /class="mirror-map-link" href="https:\/\/maps\.app\.goo\.gl\/L5DeBjU28QDr6jky9\?g_st=ifm"[^>]*aria-label="Xem bản đồ Lễ Nạp Tài"/);
  assert.match(html, /class="mirror-map-link" href="https:\/\/www\.google\.com\/maps\/search\/[^"]*S%C3%B4ng%20Lam%20Palace[^"]*"[^>]*aria-label="Xem bản đồ Lễ Thành Hôn"/);
  assert.match(html, /\.mirror-map-link \{ position:absolute; inset:0;/);

  // The wish list was a fixed 401px box; it now grows to its content and caps
  // at roughly six wishes, then scrolls.
  assert.match(html, /class="wish-list-container[^"]*"[^>]*style="width: 366px; max-height: 401px;/);
  assert.match(html, /\.wish-list-scroll \{ width:100%; max-height:401px; overflow:auto;/);
  assert.doesNotMatch(html, /style="width: 366px; height: 401px;/);
  assert.match(html, /function fitWishSection\(\)/);
  assert.match(html, /new ResizeObserver\(fitWishSection\)\.observe\(wishListBox\)/);
  assert.match(html, /method:'POST'/);
  assert.match(html, /createWishElement/);
  assert.match(html, /Only You/);
  assert.match(html, /\/uploads\/only-you-from-78s\.mp3/);
  assert.doesNotMatch(html, /Một Đời/);
  assert.doesNotMatch(html, /quick-menu|menu-button|Mở mục lục|>☰</);
  assert.match(html, /class="na01-music-control"/);
  assert.match(html, /\.na01-music-control \{[^}]*left:max\(15px,calc\(\(100vw - 480px\)\/2 \+ 15px\)\)[^}]*width:50px[^}]*animation:na01MusicSpin 4s linear infinite; \}/);
  // The pulse animated box-shadow on a fixed element, repainting every frame
  // while scrolling. It now animates opacity on a glow instead.
  assert.match(html, /@keyframes na01MusicPulse \{ 0%,100% \{ opacity:\.35; \} 50% \{ opacity:1; \} \}/);
  assert.match(html, /\.na01-music-control::before \{[^}]*animation:na01MusicPulse 2s ease-in-out infinite;/);

  // Falling hearts, after quiet-vip.mehappy.info. That site redraws a canvas
  // every frame; this animates transform/opacity so the compositor owns it.
  assert.equal([...html.matchAll(/<span style="--x:/g)].length, 16);
  assert.match(html, /\.heart-fall \{ position:fixed; inset:0; z-index:30; pointer-events:none; overflow:hidden; display:none; \}/);
  assert.match(html, /body:not\(\.gate-active\) \.heart-fall \{ display:block; \}/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\) \{ \.heart-fall \{ display:none!important; \} \}/);
  // The keyframes must not touch anything that would force a repaint.
  const heartKeyframes = html.match(/@keyframes heartFall \{[\s\S]*?\n    \}/)[0];
  for (const prop of heartKeyframes.matchAll(/(?:^|[{;\s])([a-z-]+):/g)) {
    assert.ok(["transform", "opacity"].includes(prop[1]),
      `heartFall animates ${prop[1]}; only transform/opacity stay on the compositor`);
  }
  // Backdrop images used a filter chain that was identity apart from opacity.
  assert.doesNotMatch(html, /filter: contrast\(100%\)[^;]*opacity\(35%\)/);
  // The .png is plain notes (sound on); the .jpg is notes with a slash (sound off).
  // The button starts stopped, so it must start on the slashed icon.
  assert.match(html, /id="music-button-icon" src="\/mirror\/assets\/[^"]+\.jpg" alt="Nhạc đang tắt"/);
  assert.match(html, /const musicOnIcon = '\/mirror\/assets\/[^"]+\.png'/);
  assert.match(html, /const musicOffIcon = '\/mirror\/assets\/[^"]+\.jpg'/);
  assert.match(html, /await music\.play\(\);[\s\S]{0,200}?musicButtonIcon\.src = musicOnIcon/);
  assert.match(html, /music\.pause\(\);[\s\S]{0,300}?musicButtonIcon\.src = musicOffIcon/);
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
  assert.ok(localAssets.length >= 8);
  for (const asset of new Set(localAssets)) {
    const assetUrl = new URL(`../public${asset}`, import.meta.url);
    await fs.access(assetUrl);
  }
  const uploads = [
    ...[...html.matchAll(/"(\/uploads\/[^"?]+)"/g)].map((match) => match[1]),
  ];
  assert.equal(new Set(uploads).size, 49, "5 landing + thank-you + 2 events + song + 40 gallery photos");
  for (const asset of new Set(uploads)) {
    await fs.access(new URL(`../public${asset}`, import.meta.url));
  }
  // Full-size photos are referenced only from JS, so check them explicitly.
  const photoNames = [...html.matchAll(/data-photo="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(photoNames).size, 40);
  for (const name of photoNames) {
    await fs.access(new URL(`../public/uploads/gal-${name}-lg.webp`, import.meta.url));
  }
});
