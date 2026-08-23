const guestName = process.argv.slice(2).join(" ").normalize("NFC").replace(/\s+/g, " ").trim();

if (!guestName) {
  console.error('Usage: npm run guest-code -- "Guest Name"');
  process.exitCode = 1;
} else {
  console.log(Buffer.from(guestName, "utf8").toString("base64url"));
}
