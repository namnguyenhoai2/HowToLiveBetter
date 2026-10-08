git clone https://github.com/eternity4719/HowToLiveBetter.git
cd HowToLiveBetter
python -m http.server 8000

cd tools/epub && npm ci && npm run build   # EPUB
node tools/offline/build.mjs               # 离线单文件 HTML
node tools/pdf/build.mjs                   # PDF，另需 pandoc ≥ 3.1 和 typst ≥ 0.13



Các từ sau phải dịch đúng như sau, dấu : viết liền ngay sau từ tiếng Việt
成本：Chi phí:
说人话：Nói đơn giản:
收益：Lợi ích:
证据等级：Mức độ bằng chứng:
来源：Nguồn:
备注：Ghi chú: