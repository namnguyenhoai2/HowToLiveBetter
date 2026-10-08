// Đóng gói index.html, README và book/*.md thành một HTML tự chứa: mở bằng
// cách nhấp đúp, không cần máy chủ hay kết nối mạng.
// Cách dùng: node tools/offline/build.mjs [đường-dẫn-đầu-ra]
// Mặc định xuất ra dist/HowToLiveBetter.html.
// Nội dung sách được nhúng vào window.__CORPUS__; init() trong index.html sẽ
// dùng biến này thay vì gửi yêu cầu tải tệp. Liên kết nội bộ được đổi sang bản
// trực tuyến, ảnh thanh bên được chuyển sang data URI; các phần khác giữ nguyên.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT, REPO, SITE, read, gitCommit, buildStamp } from '../lib/book.mjs';

const OUT = resolve(ROOT, process.argv[2] ?? 'dist/HowToLiveBetter.html');
const STAMP = buildStamp();
const COMMIT = gitCommit();

// ---------- Nội dung sách ----------
const readme = read('README.md');
// README là danh mục chuẩn; chỉ lấy các tệp được liên kết ở đây để thứ tự nội
// dung của bản ngoại tuyến khớp với các định dạng xuất bản khác.
const files = [...new Set([...readme.matchAll(/\]\((book\/[^)]+\.md)\)/g)].map(m => m[1]))].sort();
if (!files.length) throw new Error('README 目录里没找到 book/ 文件，离线版会是空的');
// Cũng kèm các bài dài (docs/*.md): hộp thoại bài dài của trang tìm kiếm hiển
// chúng ngay trong trang. Nếu bỏ chúng, bản ngoại tuyến chỉ còn liên kết GitHub
// không mở được. Danh sách này cũng được lấy từ README như bản EPUB và PDF.
const docs = [...new Set([...readme.matchAll(/\]\((docs\/[^)#/]+\.md)\)/g)].map(m => m[1]))].sort();
const corpus = {
  readme,
  parts: Object.fromEntries(files.map(f => [f, read(f)])),
  docs: Object.fromEntries(docs.map(f => [f, read(f)])),
};
// Chuỗi </script> sẽ đóng thẻ script sớm. Escape dấu / để dữ liệu vẫn giữ
// nguyên khi được chèn vào thẻ script.
const corpusJson = JSON.stringify(corpus).replace(/<\/script/gi, '<\\/script');

// ---------- Trang HTML ----------
let html = read('index.html');
// Báo lỗi sớm khi cấu trúc index.html thay đổi, thay vì âm thầm tạo một tệp
// ngoại tuyến thiếu chức năng.
const must = (needle, label) => {
  if (!html.includes(needle)) throw new Error(`index.html 里找不到${label}，离线版脚本要跟着改：${needle}`);
};

// Không đưa mã thống kê vào bản ngoại tuyến: tệp được mở bằng nhấp đúp không
// nên gửi yêu cầu ra ngoài hoặc chờ hết thời gian khi không có mạng.
const GA_START = '<!-- ga:start', GA_END = '<!-- ga:end -->';
must(GA_START, ' GA 片段的起始标记');
must(GA_END, ' GA 片段的结束标记');
html = html.slice(0, html.indexOf(GA_START)) + html.slice(html.indexOf(GA_END) + GA_END.length);
// Chỉ kiểm tra tên miền bên ngoài. track() trong mã chính có lớp bảo vệ typeof,
// nên việc không có gtag không phải là mã thống kê còn sót lại.
if (/googletagmanager|google-analytics/.test(html)) throw new Error('剥掉标记之间的内容后仍有统计域名残留，离线版会往外发请求');

// Liên kết tương đối không dùng được khi mở tệp cục bộ, nên đổi chúng sang URL trực tuyến.
must('href="README.md"', ' README.md 链接');
must('href="book/"', ' book/ 链接');
html = html
  .replaceAll('href="README.md"', `href="${REPO}/blob/main/README.md"`)
  .replaceAll('href="book/"', `href="${REPO}/tree/main/book"`)
  .replaceAll('<a class="title" href="./"', `<a class="title" href="${SITE}"`);

// Chuyển ảnh quảng cáo thanh bên và mã ủng hộ thành data URI; nếu không, ảnh
// sẽ bị vỡ khi tệp được mở ngoại tuyến.
for (const [img, mime] of [['ads/mcyyy-side.webp', 'image/webp'], ['ads/wechat-reward.png', 'image/png']]) {
  must(`src="${img}"`, `图片 ${img}`);
  const data = readFileSync(resolve(ROOT, img)).toString('base64');
  html = html.replace(`src="${img}"`, `src="data:${mime};base64,${data}"`);
}

// Ghi ở chân trang bản sao ngoại tuyến này được tạo từ phiên bản nào.
const foot = '<div class="foot">';
must(foot, '页脚');
const commitNote = COMMIT ? `，正文提交 ${COMMIT.slice(0, 7)}` : '';
html = html.replace(foot, `${foot}离线副本，生成于 ${STAMP}（北京时间）${commitNote}；正文会继续更新，以 <a href="${SITE}">在线版</a> 为准。<br>`);

// Dữ liệu sách phải có trước mã chính để init() có thể đọc ngay khi chạy.
const mainScript = '\n<script>\n/* ---------- 调试面板';
must(mainScript, '主脚本的开头');
html = html.replace(mainScript, `\n<script>window.__CORPUS__=${corpusJson}</script>${mainScript}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const kb = n => (n / 1024 | 0) + ' KB';
console.log(`已生成 ${OUT}：${files.length} 个正文文件，长文 ${docs.length} 篇，${kb(Buffer.byteLength(html))}（其中正文 ${kb(Buffer.byteLength(corpusJson))}）`);
