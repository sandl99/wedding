// Generates the English card from the Vietnamese one so the two cannot drift.
// Every entry below must match exactly once (or the declared count); a miss is a
// hard error, which is what stops a translation silently going stale.
import fs from "node:fs";
import path from "node:path";

const SRC = "public/mirror/index.html";
const OUT = "public/mirror/en/index.html";

let html = fs.readFileSync(SRC, "utf8");
const misses = [];

/** Replace an exact string, asserting how many times it should occur. */
function swap(from, to, expected = 1) {
  const count = html.split(from).length - 1;
  if (count !== expected) { misses.push(`${count}x (want ${expected}): ${from.slice(0, 64)}`); return; }
  html = html.split(from).join(to);
}

// ---- document ----------------------------------------------------------
swap('<html lang="vi">', '<html lang="en">');
swap('content="Thiệp cưới Lâm San và Thu Trang — 30.09.2026"',
     'content="Lâm San &amp; Thu Trang — Wedding Invitation, 30.09.2026"');
swap("<title>Lâm San &amp; Thu Trang — Thiệp cưới</title>",
     "<title>Lâm San &amp; Thu Trang — Wedding Invitation</title>");

// ---- envelope ----------------------------------------------------------
swap("THƯ MỜI CƯỚI", "WEDDING INVITATION");
swap("TỚI DỰ TIỆC MỪNG LỄ THÀNH HÔN CÙNG GIA ĐÌNH CHÚNG TÔI",
     "TO CELEBRATE OUR WEDDING WITH OUR FAMILIES");
swap(">Quý Khách<", ">Our guest<");
swap("Chạm để mở phong bì", "Tap to open the envelope");
swap('aria-label="Mở thiệp cưới Lâm San và Thu Trang"',
     'aria-label="Open Lâm San and Thu Trang\'s wedding invitation"');
swap("'Mở thiệp cưới dành cho '", "'Wedding invitation for '");

// ---- invitation letter -------------------------------------------------
swap("TRÂN TRỌNG KÍNH MỜI", "CORDIALLY INVITE");
swap("Đến dự buổi tiệc chung vui cùng gia đình chúng tôi", "to join the celebration with our families");
swap("Bạn và người thương", "You and your loved one");
swap("Lễ Thành hôn được tổ chức vào ngày", "Our wedding ceremony will be held on");
swap("Lúc 10:45, Thứ Tư", "At 10:45 AM, Wednesday");
swap("Địa điểm:", "Venue:");
swap("Sự hiện diện của quý khách là niềm vinh dự của gia đình chúng mình",
     "Your presence is the greatest honour for our families");
swap(">Chỉ đường<", ">Directions<");
swap(">Nhà Trai<", ">Groom&#39;s family<");
swap(">Nhà Gái<", ">Bride&#39;s family<");
swap("Ông Đặng Văn Trịnh", "Mr. Đặng Văn Trịnh");
swap("Bà Hoàng Thị Nhung", "Mrs. Hoàng Thị Nhung");
swap("Ông Nguyễn Văn Trinh", "Mr. Nguyễn Văn Trinh");
swap("Bà Võ Thị Thanh An", "Mrs. Võ Thị Thanh An");
swap(">và<", ">and<");
// The lunar date is dropped for English readers. Locate the block by its own
// text rather than a node id, and refuse to cut anything that holds more.
const lunarText = "(Tức ngày 19/8 năm Bính Ngọ)";
{
  const at = html.indexOf(lunarText);
  if (at === -1) misses.push("lunar-date text not found");
  else {
    const open = html.lastIndexOf('<div class="w-full">', at);
    const close = html.indexOf("</div></div>", at);
    const block = html.slice(open, close + "</div></div>".length);
    const visible = block.replace(/<[^>]*>/g, "").trim();
    if (open === -1 || close === -1 || visible !== lunarText) {
      misses.push(`lunar-date block held unexpected text: ${visible.slice(0, 70)}`);
    } else {
      html = html.slice(0, open) + html.slice(close + "</div></div>".length);
    }
  }
}

// ---- venues, shared by the letter and the event cards ------------------
swap("Nhà hàng Sông Lam Palace", "Song Lam Palace Restaurant", 2);
swap("Tầng 2, số 421 đường Phạm Nguyễn Du, phường Cửa Lò, tỉnh Nghệ An",
     "2nd Floor, 421 Phạm Nguyễn Du Street, Cửa Lò Ward, Nghệ An", 2);
swap("Số 194, đường Sào Nam, Nghi Thu 2, phường Cửa Lò, Nghệ An",
     "194 Sào Nam Street, Nghi Thu 2, Cửa Lò Ward, Nghệ An");
swap("Tư gia nhà Gái", "Bride&#39;s family home");

// ---- events ------------------------------------------------------------
swap("Sự Kiện Cưới", "Wedding Events");
swap(">Lễ Nạp Tài<", ">Engagement Ceremony<");
swap(">Lễ Thành Hôn<", ">Wedding Ceremony<");
swap('aria-label="Xem bản đồ Lễ Nạp Tài"', 'aria-label="View map for the Engagement Ceremony"');
swap('aria-label="Xem bản đồ Lễ Thành Hôn"', 'aria-label="View map for the Wedding Ceremony"');
swap('alt="Lễ Nạp Tài"', 'alt="Engagement Ceremony"');
swap('alt="Lễ Thành Hôn"', 'alt="Wedding Ceremony"');
swap("10h30 Thứ 3, ngày 29/09/2026", "10:30 AM, Tuesday 29 September 2026");
swap("10h45 Thứ 4, ngày 30/09/2026", "10:45 AM, Wednesday 30 September 2026");
swap(">Xem bản đồ<", ">View map<", 3);

// ---- countdown ---------------------------------------------------------
swap(">Đếm ngược<", ">Countdown<");
swap(">Ngày trọng đại</h2>", ">The Big Day</h2>");
swap("<span>Ngày</span>", "<span>Days</span>");
swap("<span>Giờ</span>", "<span>Hours</span>");
swap("<span>Phút</span>", "<span>Minutes</span>");
swap("<span>Giây</span>", "<span>Seconds</span>");
swap(">10:45 · Thứ Tư · 30.09.2026<", ">10:45 AM · Wednesday · 30 September 2026<");
swap("'<p class=\"cd-done\">Hôm nay là ngày trọng đại!</p>'", "'<p class=\"cd-done\">Today is the big day!</p>'");

// ---- album -------------------------------------------------------------
swap(">Album cưới<", ">Wedding album<");
swap(">Khoảnh khắc<", ">Moments<");
swap("40 khoảnh khắc của chúng mình", "40 of our favourite moments");
swap("Chạm vào ảnh để xem lớn hơn", "Tap a photo to view it larger");
swap("<span>Xem ảnh</span>", "<span>View photo</span>", 40);
swap('aria-label="Album ảnh cưới"', 'aria-label="Wedding photo album"');
swap('alt="Album cưới phóng lớn"', 'alt="Wedding photo, enlarged"');
swap('aria-label="Trang album"', 'aria-label="Album pages"');
swap('aria-label="Trang trước"', 'aria-label="Previous page"', 2);
swap('aria-label="Trang sau"', 'aria-label="Next page"', 2);
swap('aria-label="Đóng"', 'aria-label="Close"');
swap(">1–10 của 40 ảnh<", ">1–10 of 40 photos<");
swap("' của ' + albumTotal + ' ảnh'", "' of ' + albumTotal + ' photos'");
html = html.replace(/aria-label="Xem ảnh (\d+) phóng lớn"/g, 'aria-label="View photo $1 enlarged"');
html = html.replace(/alt="Ảnh cưới Lâm San và Thu Trang (\d+)"/g, 'alt="Lâm San and Thu Trang wedding photo $1"');
swap("'Ảnh cưới Lâm San và Thu Trang '", "'Lâm San and Thu Trang wedding photo '");

// ---- wishes ------------------------------------------------------------
swap(">Gửi lời chúc</span>", ">Send your wishes</span>");
swap(">Gửi lời chúc</button>", ">Send wish</button>");
swap('aria-label="Gửi lời chúc đến cô dâu chú rể"', 'aria-label="Send a wish to the bride and groom"');
swap("Cảm ơn mọi người rất nhiều vì đã gửi những lời chúc mừng tốt đẹp nhất đến đám cưới của hai vợ chồng ạ ♥",
     "Thank you so much for sending your warmest wishes to our wedding ♥");
swap('placeholder="Tên của bạn *"', 'placeholder="Your name *"');
swap('placeholder="Lời chúc của bạn *"', 'placeholder="Your wish *"');
swap('title="Lời chúc gợi ý"', 'title="Suggested wish"');
swap('aria-label="Chọn một lời chúc gợi ý"', 'aria-label="Pick a suggested wish"');
swap("Đang tải lời chúc...", "Loading wishes...");
swap("'Đang gửi lời chúc...'", "'Sending your wish...'");
swap("'Bạn vui lòng nhập tên và lời chúc nhé.'", "'Please enter your name and a wish.'");
swap("'Cảm ơn bạn! Lời chúc đã được gửi ♥'", "'Thank you! Your wish has been sent ♥'");
swap("'Chưa gửi được lời chúc. Bạn vui lòng thử lại nhé.'", "'We could not send your wish. Please try again.'");
swap("'Hãy là người đầu tiên gửi lời chúc đến Lâm San và Thu Trang nhé!'",
     "'Be the first to send Lâm San and Thu Trang a wish!'");
swap("Chưa thể tải lời chúc. Vui lòng thử lại sau.", "Wishes could not be loaded. Please try again later.");
swap("'Không thể gửi lời chúc'", "'Could not send the wish'");
swap("'Không thể tải lời chúc'", "'Could not load wishes'");
swap("'Chúc hai bạn trăm năm hạnh phúc, mãi luôn yêu thương và đồng hành cùng nhau!'",
     "'Wishing you a lifetime of happiness, always loving and walking side by side!'");
swap("'Chúc Lâm San và Thu Trang một đời bình an, ngập tràn niềm vui và tiếng cười!'",
     "'Wishing Lâm San and Thu Trang a peaceful life, full of joy and laughter!'");
swap("'Chúc mừng ngày trọng đại! Chúc hai bạn mãi hạnh phúc và sớm đón thật nhiều tin vui!'",
     "'Congratulations on your big day! May you always be happy and hear plenty of good news soon!'");

// ---- thank you ---------------------------------------------------------
swap("Sự hiện diện của quý khách là niềm vinh hạnh cho gia đình chúng tôi",
     "Your presence is an honour for our family");
swap('alt="Lâm San và Thu Trang"', 'alt="Lâm San and Thu Trang"');
swap('alt="Lâm San và Thu Trang trong ngày cưới"', 'alt="Lâm San and Thu Trang on their wedding day"');

// ---- music + language toggle -------------------------------------------
swap('aria-label="Phát bài Only You"', 'aria-label="Play Only You"');
swap('"Phát bài Only You"', '"Play Only You"');
swap('"Tắt bài Only You"', '"Turn off Only You"');
swap('alt="Nhạc đang tắt"', 'alt="Music is off"');
swap("'Nhạc đang tắt'", "'Music is off'");
swap("'Nhạc đang bật'", "'Music is on'");
swap('href="/en" target="_top" hreflang="en">English</a>', 'href="/" target="_top" hreflang="vi">Tiếng Việt</a>');

// English runs longer than the Vietnamese it replaces, and this template pins
// text to fixed boxes. Nudge only the few that would otherwise collide.
const enOverrides = `
    /* English-only layout corrections */
    #invitation [data-node-id="hNdJYzjrnS"] { font-size:17px!important; }
    #invitation [data-node-id="wEMxdNSL-C"], #invitation [data-node-id="GiB_2IUSzI"] { font-size:13px!important; }
    #events [data-node-id="gafH64GJMv"], #events [data-node-id="70aRKc0M6x"] { width:166px!important; font-size:16px!important; }\n    #countdown .cd-unit span { font-size:9px!important; letter-spacing:.1em!important; }
  </style>`;
if (!html.includes("</style>")) misses.push("no </style> to append English overrides to");
else html = html.replace("</style>", enOverrides);

if (misses.length) {
  console.error("build-en: these strings did not match the source as expected:");
  for (const m of misses) console.error("  - " + m);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`build-en: wrote ${OUT} (${html.length} bytes)`);
